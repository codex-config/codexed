package codex

import (
	"bufio"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"os/exec"
	"sync"
	"sync/atomic"
)

// RPCError is an error that Codex returned for a request.
type RPCError struct {
	Code    int             `json:"code"`
	Message string          `json:"message"`
	Data    json.RawMessage `json:"data,omitempty"`
}

func (e *RPCError) Error() string { return e.Message }

// WriteCode returns the reason of a failed config write, such as "configVersionConflict".
func (e *RPCError) WriteCode() string {
	var data struct {
		Code string `json:"config_write_error_code"`
	}
	json.Unmarshal(e.Data, &data)
	return data.Code
}

// Client talks to `codex app-server` over stdin and stdout, one JSON message per
// line. It starts the server on the first request, and again if it stops.
type Client struct {
	binary  string
	home    string
	version string

	mu   sync.Mutex
	proc *process
}

// NewClient runs the app server of binary. A non-empty home replaces CODEX_HOME.
func NewClient(binary, home, version string) *Client {
	return &Client{binary: binary, home: home, version: version}
}

type process struct {
	cmd    *exec.Cmd
	stdin  io.WriteCloser
	write  sync.Mutex
	nextID atomic.Int64

	mu      sync.Mutex
	pending map[int64]chan reply
	done    chan struct{}
	err     error
}

type reply struct {
	Result json.RawMessage
	Error  *RPCError
}

// Call sends a request and decodes its result into result, which may be nil.
func (c *Client) Call(ctx context.Context, method string, params, result any) error {
	p, err := c.start(ctx)
	if err != nil {
		return err
	}
	raw, err := p.call(ctx, method, params)
	if err != nil {
		return err
	}
	if result == nil {
		return nil
	}
	return json.Unmarshal(raw, result)
}

// Close stops the app server.
func (c *Client) Close() {
	c.mu.Lock()
	defer c.mu.Unlock()
	if c.proc != nil {
		c.proc.stdin.Close()
		c.proc.cmd.Process.Kill()
		c.proc = nil
	}
}

func (c *Client) start(ctx context.Context) (*process, error) {
	c.mu.Lock()
	defer c.mu.Unlock()
	if c.proc != nil {
		select {
		case <-c.proc.done:
		default:
			return c.proc, nil
		}
	}

	cmd := exec.Command(c.binary, "app-server")
	cmd.Env = childEnv(c.binary, c.home)
	hideWindow(cmd)
	stdin, err := cmd.StdinPipe()
	if err != nil {
		return nil, err
	}
	stdout, err := cmd.StdoutPipe()
	if err != nil {
		return nil, err
	}
	if err := cmd.Start(); err != nil {
		return nil, fmt.Errorf("start codex app-server: %w", err)
	}

	p := &process{cmd: cmd, stdin: stdin, pending: map[int64]chan reply{}, done: make(chan struct{})}
	go p.read(stdout)

	params := map[string]any{"clientInfo": map[string]string{"name": "codexed", "title": "Codexed", "version": c.version}}
	if _, err := p.call(ctx, "initialize", params); err != nil {
		stdin.Close()
		cmd.Process.Kill()
		return nil, fmt.Errorf("start codex app-server: %w", err)
	}
	if err := p.send(map[string]any{"method": "initialized", "params": map[string]any{}}); err != nil {
		return nil, err
	}
	c.proc = p
	return p, nil
}

func (p *process) call(ctx context.Context, method string, params any) (json.RawMessage, error) {
	id := p.nextID.Add(1)
	ch := make(chan reply, 1)
	p.mu.Lock()
	if p.err != nil {
		p.mu.Unlock()
		return nil, p.err
	}
	p.pending[id] = ch
	p.mu.Unlock()

	if params == nil {
		params = map[string]any{}
	}
	if err := p.send(map[string]any{"id": id, "method": method, "params": params}); err != nil {
		p.forget(id)
		return nil, err
	}

	select {
	case r := <-ch:
		if r.Error != nil {
			return nil, r.Error
		}
		return r.Result, nil
	case <-p.done:
		return nil, p.err
	case <-ctx.Done():
		p.forget(id)
		return nil, ctx.Err()
	}
}

func (p *process) send(message any) error {
	data, err := json.Marshal(message)
	if err != nil {
		return err
	}
	p.write.Lock()
	defer p.write.Unlock()
	_, err = p.stdin.Write(append(data, '\n'))
	return err
}

func (p *process) forget(id int64) {
	p.mu.Lock()
	delete(p.pending, id)
	p.mu.Unlock()
}

// read hands each response to its request. Notifications and requests from the
// server are not needed, so they are dropped.
func (p *process) read(stdout io.Reader) {
	reader := bufio.NewReaderSize(stdout, 1<<20)
	for {
		line, err := reader.ReadBytes('\n')
		if len(line) > 0 {
			var message struct {
				ID     *int64          `json:"id"`
				Method string          `json:"method"`
				Result json.RawMessage `json:"result"`
				Error  *RPCError       `json:"error"`
			}
			if json.Unmarshal(line, &message) == nil && message.ID != nil && message.Method == "" {
				p.mu.Lock()
				ch := p.pending[*message.ID]
				delete(p.pending, *message.ID)
				p.mu.Unlock()
				if ch != nil {
					ch <- reply{Result: message.Result, Error: message.Error}
				}
			}
		}
		if err != nil {
			p.mu.Lock()
			p.err = errors.New("codex app-server stopped")
			p.mu.Unlock()
			p.cmd.Wait()
			close(p.done)
			return
		}
	}
}

package codex

import (
	"context"
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"sync"
)

// InvalidConfigError is a config that Codex rejects, with its message.
type InvalidConfigError struct{ Message string }

func (e *InvalidConfigError) Error() string { return e.Message }

// Edit sets the value at a key path. A nil value removes the key.
type Edit struct {
	Path  []string `json:"path"`
	Value any      `json:"value"`
}

// Editor changes config text with the TOML editor of Codex, which keeps comments
// and checks every value. Codex only writes the user config itself, so the editor
// runs a second app server in a scratch CODEX_HOME. That way it can edit project
// configs too.
type Editor struct {
	mu     sync.Mutex
	dir    string
	client *Client
}

func NewEditor(binary, version string) (*Editor, error) {
	dir, err := os.MkdirTemp("", "codexed-editor-")
	if err != nil {
		return nil, err
	}
	return &Editor{dir: dir, client: NewClient(binary, dir, version)}, nil
}

func (e *Editor) Close() {
	e.client.Close()
	os.RemoveAll(e.dir)
}

// Apply returns text with the edits made.
func (e *Editor) Apply(ctx context.Context, text string, edits []Edit) (string, error) {
	e.mu.Lock()
	defer e.mu.Unlock()

	file := filepath.Join(e.dir, "config.toml")
	if err := os.WriteFile(file, []byte(text), 0o600); err != nil {
		return "", err
	}
	changes := make([]map[string]any, 0, len(edits))
	for _, edit := range edits {
		if len(edit.Path) == 0 {
			return "", &InvalidConfigError{Message: "An edit has no key."}
		}
		changes = append(changes, map[string]any{"keyPath": KeyPath(edit.Path), "value": edit.Value, "mergeStrategy": "replace"})
	}
	if err := e.client.Call(ctx, "config/batchWrite", map[string]any{"edits": changes}, nil); err != nil {
		return "", e.explain(err)
	}
	data, err := os.ReadFile(file)
	return string(data), err
}

// Check returns an InvalidConfigError when Codex cannot load text.
func (e *Editor) Check(ctx context.Context, text string) error {
	e.mu.Lock()
	defer e.mu.Unlock()

	if err := os.WriteFile(filepath.Join(e.dir, "config.toml"), []byte(text), 0o600); err != nil {
		return err
	}
	return e.explain(e.client.Call(ctx, "config/read", map[string]any{}, nil))
}

var layerPrefix = regexp.MustCompile(`^failed to read configuration layers: `)

// explain turns an error about the scratch file into one about config.toml.
func (e *Editor) explain(err error) error {
	var rpc *RPCError
	if !errors.As(err, &rpc) {
		return err
	}
	message := rpc.Message
	// On macOS the temporary folder also has a path under /private, which is longer.
	for _, dir := range []string{"/private" + e.dir, e.dir} {
		message = strings.ReplaceAll(message, filepath.Join(dir, "config.toml"), "config.toml")
	}
	message = strings.TrimSpace(layerPrefix.ReplaceAllString(message, ""))
	return &InvalidConfigError{Message: message}
}

var bareKey = regexp.MustCompile(`^[A-Za-z0-9_-]+$`)

// KeyPath joins keys the way TOML writes them: bare when it can, quoted when not.
func KeyPath(keys []string) string {
	parts := make([]string, len(keys))
	for i, key := range keys {
		if bareKey.MatchString(key) {
			parts[i] = key
			continue
		}
		quoted, _ := json.Marshal(key)
		parts[i] = string(quoted)
	}
	return strings.Join(parts, ".")
}

package server

import (
	"context"
	"encoding/json"
	"errors"
	"io/fs"
	"log"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"codexed/internal/codex"
)

// Header must be sent with every API request. Browsers do not let other sites
// set custom headers on cross-origin requests without a preflight, which this
// server never approves.
const Header = "X-Codexed"

type Server struct {
	paths      codex.Paths
	folders    *folders
	schemas    *codex.SchemaLoader
	version    string
	pickFolder func(context.Context) (string, error)
	picking    sync.Mutex

	mu      sync.Mutex
	binary  codex.Binary
	found   bool
	checked time.Time
	live    *codex.Client
	stale   bool
	editor  *codex.Editor
}

func New(paths codex.Paths, version string) (*Server, error) {
	f, err := newFolders()
	if err != nil {
		return nil, err
	}
	schemas, err := codex.NewSchemaLoader()
	if err != nil {
		return nil, err
	}
	return &Server{
		paths:      paths,
		folders:    f,
		schemas:    schemas,
		version:    version,
		pickFolder: pickFolder,
	}, nil
}

// Close stops the Codex app servers.
func (s *Server) Close() {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.closeClients()
}

// Handler serves the API and passes other requests to ui.
// Only requests for the given port on loopback host names are accepted.
func (s *Server) Handler(port string, ui http.Handler) http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /api/health", s.health)
	mux.HandleFunc("GET /api/projects", s.listProjects)
	mux.HandleFunc("POST /api/projects", s.addProject)
	mux.HandleFunc("DELETE /api/projects", s.removeProject)
	mux.HandleFunc("POST /api/pick-folder", s.selectFolder)
	mux.HandleFunc("GET /api/files", s.readFile)
	mux.HandleFunc("PUT /api/files", s.writeFile)
	mux.HandleFunc("PATCH /api/config", s.editConfig)
	mux.HandleFunc("GET /api/schema", s.configSchema)
	mux.HandleFunc("GET /api/models", s.listModels)
	mux.HandleFunc("GET /api/features", s.listFeatures)
	mux.HandleFunc("GET /api/skills", s.listSkills)
	mux.HandleFunc("PUT /api/skills/enabled", s.enableSkill)
	mux.HandleFunc("GET /api/plugins", s.listPlugins)
	mux.HandleFunc("POST /api/plugins/install", s.installPlugin)
	mux.HandleFunc("POST /api/plugins/uninstall", s.uninstallPlugin)
	mux.HandleFunc("POST /api/marketplaces", s.addMarketplace)
	mux.HandleFunc("DELETE /api/marketplaces", s.removeMarketplace)
	mux.HandleFunc("POST /api/marketplaces/upgrade", s.upgradeMarketplace)
	mux.Handle("/api/", http.NotFoundHandler())
	mux.Handle("/", ui)

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !allowedHost(r.Host, port) {
			http.Error(w, "forbidden host", http.StatusForbidden)
			return
		}
		if isAPI(r) && r.Header.Get(Header) == "" {
			http.Error(w, "missing "+Header+" header", http.StatusForbidden)
			return
		}
		mux.ServeHTTP(w, r)
	})
}

// allowedHost blocks DNS rebinding, where a remote site resolves its own name to 127.0.0.1.
func allowedHost(host, port string) bool {
	name, p, err := net.SplitHostPort(host)
	if err != nil || p != port {
		return false
	}
	return name == "localhost" || name == "127.0.0.1"
}

func isAPI(r *http.Request) bool {
	return strings.HasPrefix(r.URL.Path, "/api/")
}

var errNoCodex = errors.New("Codexed could not find the Codex CLI. Install it, and Codexed finds it within a minute")

// codex returns the installed Codex. It looks again every minute, so that an
// install or an update is noticed without a restart.
func (s *Server) codex() (codex.Binary, bool) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if !s.checked.IsZero() && time.Since(s.checked) < time.Minute {
		return s.binary, s.found
	}
	binary, err := codex.FindBinary()
	s.checked = time.Now()
	if binary != s.binary {
		s.closeClients()
	}
	s.binary, s.found = binary, err == nil
	return s.binary, s.found
}

// liveClient runs Codex with your real config. It restarts after a config change,
// so that it reads the new file.
func (s *Server) liveClient() (*codex.Client, error) {
	binary, ok := s.codex()
	if !ok {
		return nil, errNoCodex
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.live != nil && s.stale {
		s.live.Close()
		s.live = nil
	}
	if s.live == nil {
		s.live = codex.NewClient(binary.Path, "", s.version)
		s.stale = false
	}
	return s.live, nil
}

func (s *Server) configEditor() (*codex.Editor, error) {
	binary, ok := s.codex()
	if !ok {
		return nil, errNoCodex
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.editor == nil {
		editor, err := codex.NewEditor(binary.Path, s.version)
		if err != nil {
			return nil, err
		}
		s.editor = editor
	}
	return s.editor, nil
}

func (s *Server) configChanged() {
	s.mu.Lock()
	s.stale = true
	s.mu.Unlock()
}

func (s *Server) closeClients() {
	if s.live != nil {
		s.live.Close()
		s.live = nil
	}
	if s.editor != nil {
		s.editor.Close()
		s.editor = nil
	}
}

func (s *Server) health(w http.ResponseWriter, r *http.Request) {
	home, _ := os.UserHomeDir()
	body := map[string]any{"app": "codexed", "version": s.version, "home": home, "codexHome": s.paths.Home}
	if binary, ok := s.codex(); ok {
		body["codex"] = binary
	}
	writeJSON(w, http.StatusOK, body)
}

func (s *Server) listProjects(w http.ResponseWriter, r *http.Request) {
	saved, err := s.folders.list()
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, s.paths.Projects(saved, s.sessions(r.Context())))
}

// sessions maps the folder of each recent Codex session to its newest session.
// Without Codex, the list only has the config and the saved folders.
func (s *Server) sessions(ctx context.Context) map[string]time.Time {
	client, err := s.liveClient()
	if err != nil {
		return nil
	}
	ctx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()
	var result struct {
		Data []struct {
			Cwd       string `json:"cwd"`
			UpdatedAt int64  `json:"updatedAt"`
		} `json:"data"`
	}
	params := map[string]any{"limit": 500, "sortKey": "updated_at", "sortDirection": "desc"}
	if err := client.Call(ctx, "thread/list", params, &result); err != nil {
		log.Printf("list sessions: %v", err)
		return nil
	}
	folders := map[string]time.Time{}
	for _, thread := range result.Data {
		if thread.Cwd == "" {
			continue
		}
		used := time.Unix(thread.UpdatedAt, 0)
		path := filepath.Clean(thread.Cwd)
		if used.After(folders[path]) {
			folders[path] = used
		}
	}
	return folders
}

func (s *Server) addProject(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Path string `json:"path"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, errBadRequest)
		return
	}
	dir, err := s.paths.ProjectDir(body.Path)
	if err != nil {
		writeError(w, err)
		return
	}
	if err := s.folders.add(dir); err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, codex.Project{Path: dir, Name: filepath.Base(dir), Saved: true})
}

func (s *Server) removeProject(w http.ResponseWriter, r *http.Request) {
	if err := s.folders.remove(r.URL.Query().Get("path")); err != nil {
		writeError(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (s *Server) filePath(r *http.Request) (string, codex.Kind, error) {
	q := r.URL.Query()
	kind := codex.Kind(q.Get("kind"))
	if kind == codex.KindSkill {
		path, err := s.paths.SkillFile(q.Get("dir"), q.Get("name"))
		return path, kind, err
	}
	path, err := s.paths.File(q.Get("dir"), kind)
	return path, kind, err
}

func (s *Server) readFile(w http.ResponseWriter, r *http.Request) {
	path, _, err := s.filePath(r)
	if err != nil {
		writeError(w, err)
		return
	}
	file, err := codex.ReadFile(path)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, file)
}

// writeFile saves a whole file. Codex checks a config first, so that a file it
// cannot load is never written.
func (s *Server) writeFile(w http.ResponseWriter, r *http.Request) {
	path, kind, err := s.filePath(r)
	if err != nil {
		writeError(w, err)
		return
	}
	var body struct {
		Content string `json:"content"`
		Version string `json:"version"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, errBadRequest)
		return
	}
	if kind == codex.KindConfig {
		editor, err := s.configEditor()
		if err != nil {
			writeError(w, err)
			return
		}
		ctx, cancel := context.WithTimeout(r.Context(), 20*time.Second)
		defer cancel()
		if err := editor.Check(ctx, body.Content); err != nil {
			writeError(w, err)
			return
		}
	}
	file, err := codex.WriteFile(path, body.Content, body.Version)
	if err != nil {
		writeError(w, err)
		return
	}
	if kind == codex.KindConfig {
		s.configChanged()
	}
	writeJSON(w, http.StatusOK, file)
}

// editConfig changes keys in a config.toml with the TOML editor of Codex, which
// keeps the comments and the order of the file.
func (s *Server) editConfig(w http.ResponseWriter, r *http.Request) {
	path, err := s.paths.File(r.URL.Query().Get("dir"), codex.KindConfig)
	if err != nil {
		writeError(w, err)
		return
	}
	var body struct {
		Version string       `json:"version"`
		Edits   []codex.Edit `json:"edits"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, errBadRequest)
		return
	}
	current, err := codex.ReadFile(path)
	if err != nil {
		writeError(w, err)
		return
	}
	if current.Version != body.Version {
		writeError(w, codex.ErrConflict)
		return
	}
	editor, err := s.configEditor()
	if err != nil {
		writeError(w, err)
		return
	}
	ctx, cancel := context.WithTimeout(r.Context(), 20*time.Second)
	defer cancel()
	content, err := editor.Apply(ctx, current.Content, body.Edits)
	if err != nil {
		writeError(w, err)
		return
	}
	file, err := codex.WriteFile(path, content, body.Version)
	if err != nil {
		writeError(w, err)
		return
	}
	s.configChanged()
	writeJSON(w, http.StatusOK, file)
}

func (s *Server) configSchema(w http.ResponseWriter, r *http.Request) {
	binary, _ := s.codex()
	writeJSON(w, http.StatusOK, s.schemas.Load(binary.Version))
}

var errBadRequest = errors.New("invalid request body")

func writeError(w http.ResponseWriter, err error) {
	status := http.StatusInternalServerError
	var invalid *codex.InvalidConfigError
	var rpc *codex.RPCError
	switch {
	case errors.Is(err, errBadRequest),
		errors.Is(err, codex.ErrBadDir),
		errors.Is(err, codex.ErrGlobalDir),
		errors.Is(err, codex.ErrBadSkillName),
		errors.Is(err, codex.ErrUnknownKind):
		status = http.StatusBadRequest
	case errors.Is(err, fs.ErrNotExist):
		status = http.StatusNotFound
	case errors.Is(err, codex.ErrConflict):
		status = http.StatusConflict
	case errors.Is(err, errNoCodex):
		status = http.StatusServiceUnavailable
	case errors.As(err, &invalid), errors.As(err, &rpc):
		status = http.StatusUnprocessableEntity
	case errors.Is(err, context.DeadlineExceeded):
		status = http.StatusGatewayTimeout
		err = errors.New("Codex took too long to answer")
	default:
		log.Printf("api error: %v", err)
	}
	writeJSON(w, status, map[string]string{"error": err.Error()})
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(v)
}

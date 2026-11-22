package server

import (
	"context"
	"encoding/json"
	"net/http"
	"os"
	"time"
)

// These handlers ask the running Codex. Its answers pass through unchanged, and
// the web app reads the fields that it needs.

const (
	quick = 20 * time.Second
	// Installing a plugin or adding a marketplace can clone a git repository.
	slow = 2 * time.Minute
)

// call sends one request to the live Codex and writes its result.
func (s *Server) call(w http.ResponseWriter, r *http.Request, method string, params any, timeout time.Duration, changesConfig bool) {
	client, err := s.liveClient()
	if err != nil {
		writeError(w, err)
		return
	}
	ctx, cancel := context.WithTimeout(r.Context(), timeout)
	defer cancel()
	var result json.RawMessage
	if err := client.Call(ctx, method, params, &result); err != nil {
		writeError(w, err)
		return
	}
	if changesConfig {
		s.configChanged()
	}
	w.Header().Set("Content-Type", "application/json")
	w.Write(result)
}

// list follows the pages of a method whose result has data and nextCursor.
func (s *Server) list(w http.ResponseWriter, r *http.Request, method string, params map[string]any) {
	client, err := s.liveClient()
	if err != nil {
		writeError(w, err)
		return
	}
	ctx, cancel := context.WithTimeout(r.Context(), quick)
	defer cancel()

	all := []json.RawMessage{}
	for page := 0; page < 20; page++ {
		var result struct {
			Data       []json.RawMessage `json:"data"`
			NextCursor string            `json:"nextCursor"`
		}
		if err := client.Call(ctx, method, params, &result); err != nil {
			writeError(w, err)
			return
		}
		all = append(all, result.Data...)
		if result.NextCursor == "" {
			break
		}
		params["cursor"] = result.NextCursor
	}
	writeJSON(w, http.StatusOK, all)
}

func (s *Server) listModels(w http.ResponseWriter, r *http.Request) {
	s.list(w, r, "model/list", map[string]any{})
}

func (s *Server) listFeatures(w http.ResponseWriter, r *http.Request) {
	s.list(w, r, "experimentalFeature/list", map[string]any{})
}

// listSkills returns the skills that Codex sees in a folder: the project skills
// there, and the user, system and admin skills.
func (s *Server) listSkills(w http.ResponseWriter, r *http.Request) {
	dir := r.URL.Query().Get("dir")
	if dir == "" {
		dir, _ = os.UserHomeDir()
	} else if _, err := s.paths.ProjectDir(dir); err != nil {
		writeError(w, err)
		return
	}
	client, err := s.liveClient()
	if err != nil {
		writeError(w, err)
		return
	}
	ctx, cancel := context.WithTimeout(r.Context(), quick)
	defer cancel()
	var result struct {
		Data []json.RawMessage `json:"data"`
	}
	if err := client.Call(ctx, "skills/list", map[string]any{"cwds": []string{dir}, "forceReload": true}, &result); err != nil {
		writeError(w, err)
		return
	}
	if len(result.Data) == 0 {
		writeJSON(w, http.StatusOK, map[string]any{"cwd": dir, "skills": []any{}, "errors": []any{}})
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.Write(result.Data[0])
}

// enableSkill turns a skill on or off in the user config.
func (s *Server) enableSkill(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Path    string `json:"path"`
		Enabled bool   `json:"enabled"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.Path == "" {
		writeError(w, errBadRequest)
		return
	}
	s.call(w, r, "skills/config/write", map[string]any{"path": body.Path, "enabled": body.Enabled}, quick, true)
}

func (s *Server) listPlugins(w http.ResponseWriter, r *http.Request) {
	params := map[string]any{}
	if dir := r.URL.Query().Get("dir"); dir != "" {
		if _, err := s.paths.ProjectDir(dir); err != nil {
			writeError(w, err)
			return
		}
		params["cwds"] = []string{dir}
	}
	s.call(w, r, "plugin/list", params, quick, false)
}

func (s *Server) installPlugin(w http.ResponseWriter, r *http.Request) {
	var body struct {
		MarketplacePath string `json:"marketplacePath"`
		PluginName      string `json:"pluginName"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.PluginName == "" {
		writeError(w, errBadRequest)
		return
	}
	params := map[string]any{"pluginName": body.PluginName}
	if body.MarketplacePath != "" {
		params["marketplacePath"] = body.MarketplacePath
	}
	s.call(w, r, "plugin/install", params, slow, true)
}

func (s *Server) uninstallPlugin(w http.ResponseWriter, r *http.Request) {
	var body struct {
		PluginID string `json:"pluginId"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.PluginID == "" {
		writeError(w, errBadRequest)
		return
	}
	s.call(w, r, "plugin/uninstall", map[string]any{"pluginId": body.PluginID}, slow, true)
}

func (s *Server) addMarketplace(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Source  string `json:"source"`
		RefName string `json:"refName"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.Source == "" {
		writeError(w, errBadRequest)
		return
	}
	params := map[string]any{"source": body.Source}
	if body.RefName != "" {
		params["refName"] = body.RefName
	}
	s.call(w, r, "marketplace/add", params, slow, true)
}

func (s *Server) removeMarketplace(w http.ResponseWriter, r *http.Request) {
	name := r.URL.Query().Get("name")
	if name == "" {
		writeError(w, errBadRequest)
		return
	}
	s.call(w, r, "marketplace/remove", map[string]any{"marketplaceName": name}, quick, true)
}

// upgradeMarketplace updates one marketplace, or all of them without a name.
func (s *Server) upgradeMarketplace(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Name string `json:"name"`
	}
	json.NewDecoder(r.Body).Decode(&body)
	params := map[string]any{}
	if body.Name != "" {
		params["marketplaceName"] = body.Name
	}
	s.call(w, r, "marketplace/upgrade", params, slow, true)
}

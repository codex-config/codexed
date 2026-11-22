package codex

import (
	"os"
	"path/filepath"
	"slices"
	"strings"
	"time"

	"github.com/pelletier/go-toml/v2"
)

type Project struct {
	Path string `json:"path"`
	Name string `json:"name"`
	// Saved is true for folders that were added in Codexed rather than found by Codex.
	Saved bool `json:"saved"`
	// Trust is the trust_level of the folder in config.toml, such as "trusted".
	Trust string `json:"trust,omitempty"`

	lastUsed time.Time
}

// Projects lists the folders in the projects table of config.toml, the folders of
// recent sessions that have Codex files, and the saved folders. sessions maps a
// folder to its newest session. The most recently used folders come first.
func (p Paths) Projects(saved []string, sessions map[string]time.Time) []Project {
	byPath := map[string]Project{}
	for path, trust := range p.trust() {
		byPath[path] = Project{Path: path, Trust: trust}
	}
	for path := range sessions {
		if _, ok := byPath[path]; !ok && hasCodexFiles(path) {
			byPath[path] = Project{Path: path}
		}
	}
	for _, path := range saved {
		project := byPath[path]
		project.Path, project.Saved = path, true
		byPath[path] = project
	}

	// The same folder can be listed under a symlink and under its real path.
	// Keep one, with the shorter path, which is usually the one people type.
	byReal := map[string]Project{}
	for path, project := range byPath {
		if _, err := p.ProjectDir(path); err != nil {
			continue
		}
		real, err := filepath.EvalSymlinks(path)
		if err != nil {
			real = path
		}
		if other, ok := byReal[real]; ok {
			project.Saved = project.Saved || other.Saved
			project.Trust = cmpOr(project.Trust, other.Trust)
			if len(other.Path) <= len(path) {
				project.Path = other.Path
			}
		}
		byReal[real] = project
	}

	projects := make([]Project, 0, len(byReal))
	for real, project := range byReal {
		project.Name = filepath.Base(project.Path)
		project.lastUsed = latest(sessions[project.Path], sessions[real])
		projects = append(projects, project)
	}
	slices.SortFunc(projects, func(a, b Project) int {
		if c := b.lastUsed.Compare(a.lastUsed); c != 0 {
			return c
		}
		return strings.Compare(strings.ToLower(a.Path), strings.ToLower(b.Path))
	})
	return projects
}

// trust reads the projects table of the user config. A config that does not
// parse lists no folders, and the config view shows the error.
func (p Paths) trust() map[string]string {
	data, err := os.ReadFile(filepath.Join(p.Home, "config.toml"))
	if err != nil {
		return nil
	}
	var config struct {
		Projects map[string]struct {
			TrustLevel string `toml:"trust_level"`
		} `toml:"projects"`
	}
	if toml.Unmarshal(data, &config) != nil {
		return nil
	}
	trust := make(map[string]string, len(config.Projects))
	for path, project := range config.Projects {
		if filepath.IsAbs(path) {
			trust[filepath.Clean(path)] = project.TrustLevel
		}
	}
	return trust
}

func hasCodexFiles(dir string) bool {
	return slices.ContainsFunc([]string{
		filepath.Join(dir, ".codex"),
		filepath.Join(dir, "AGENTS.md"),
	}, exists)
}

func latest(a, b time.Time) time.Time {
	if a.After(b) {
		return a
	}
	return b
}

func cmpOr(a, b string) string {
	if a != "" {
		return a
	}
	return b
}

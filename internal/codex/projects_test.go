package codex

import (
	"os"
	"path/filepath"
	"testing"
	"time"
)

func TestProjects(t *testing.T) {
	home := t.TempDir()
	trusted := t.TempDir()
	session := t.TempDir()
	bare := t.TempDir()
	saved := t.TempDir()
	os.WriteFile(filepath.Join(session, "AGENTS.md"), []byte("# rules"), 0o644)
	config := "[projects.\"" + trusted + "\"]\ntrust_level = \"trusted\"\n"
	os.WriteFile(filepath.Join(home, "config.toml"), []byte(config), 0o644)

	now := time.Now()
	sessions := map[string]time.Time{session: now, bare: now, trusted: now.Add(-time.Hour)}
	projects := Paths{Home: home}.Projects([]string{saved}, sessions)

	got := map[string]Project{}
	for _, p := range projects {
		got[p.Path] = p
	}
	if got[trusted].Trust != "trusted" {
		t.Errorf("trusted folder = %+v, want trust_level trusted", got[trusted])
	}
	if _, ok := got[session]; !ok {
		t.Error("a session folder with AGENTS.md is missing")
	}
	if _, ok := got[bare]; ok {
		t.Error("a session folder without Codex files is listed")
	}
	if !got[saved].Saved {
		t.Error("the saved folder is missing")
	}
	if projects[0].Path != session {
		t.Errorf("first project = %s, want the most recent session", projects[0].Path)
	}
}

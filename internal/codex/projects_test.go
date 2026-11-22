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

func TestSkillFile(t *testing.T) {
	user, home, project := t.TempDir(), t.TempDir(), t.TempDir()
	paths := Paths{Home: home, User: user}

	created, err := paths.SkillFile(project, "review", "")
	if err != nil || created != filepath.Join(project, ".agents", "skills", "review", "SKILL.md") {
		t.Errorf("new project skill = %s, %v", created, err)
	}
	legacy := filepath.Join(home, "skills", "old", "SKILL.md")
	if got, err := paths.SkillFile("", "", legacy); err != nil || got != legacy {
		t.Errorf("legacy user skill = %s, %v", got, err)
	}
	for _, path := range []string{
		filepath.Join(user, ".agents", "skills", "x", "notes.md"),
		filepath.Join(user, "Documents", "x", "SKILL.md"),
		filepath.Join(user, ".agents", "skills", "a", "b", "SKILL.md"),
	} {
		if _, err := paths.SkillFile("", "", path); err == nil {
			t.Errorf("SkillFile accepted %s", path)
		}
	}
}

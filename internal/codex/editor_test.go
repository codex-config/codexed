package codex

import (
	"context"
	"errors"
	"strings"
	"testing"
)

func TestKeyPath(t *testing.T) {
	cases := map[string][]string{
		"model":                                {"model"},
		"mcp_servers.my-docs.command":          {"mcp_servers", "my-docs", "command"},
		`projects."/Users/me/a.b".trust_level`: {"projects", "/Users/me/a.b", "trust_level"},
	}
	for want, keys := range cases {
		if got := KeyPath(keys); got != want {
			t.Errorf("KeyPath(%q) = %s, want %s", keys, got, want)
		}
	}
}

// newTestEditor runs the editor with the installed Codex, or skips the test.
func newTestEditor(t *testing.T) *Editor {
	binary, err := FindBinary()
	if err != nil {
		t.Skip("Codex is not installed")
	}
	editor, err := NewEditor(binary.Path, "test")
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(editor.Close)
	return editor
}

func TestEditorKeepsComments(t *testing.T) {
	editor := newTestEditor(t)
	before := "# my config\nmodel = \"gpt-5\" # main model\n\n[tui]\nnotifications = true\n"
	after, err := editor.Apply(context.Background(), before, []Edit{
		{Path: []string{"model_reasoning_effort"}, Value: "high"},
		{Path: []string{"tui", "notifications"}, Value: nil},
		{Path: []string{"mcp_servers", "docs", "command"}, Value: "npx"},
	})
	if err != nil {
		t.Fatal(err)
	}
	for _, want := range []string{"# my config", "# main model", `model_reasoning_effort = "high"`, "[mcp_servers.docs]"} {
		if !strings.Contains(after, want) {
			t.Errorf("result has no %q:\n%s", want, after)
		}
	}
	if strings.Contains(after, "notifications") {
		t.Errorf("notifications was not removed:\n%s", after)
	}
}

func TestEditorRejectsInvalidValues(t *testing.T) {
	editor := newTestEditor(t)
	_, err := editor.Apply(context.Background(), "", []Edit{{Path: []string{"sandbox_mode"}, Value: "nonsense"}})
	var invalid *InvalidConfigError
	if !errors.As(err, &invalid) || !strings.Contains(invalid.Message, "sandbox_mode") {
		t.Fatalf("got %v, want an InvalidConfigError about sandbox_mode", err)
	}

	err = editor.Check(context.Background(), "model = \n[broken")
	if !errors.As(err, &invalid) || !strings.HasPrefix(invalid.Message, "config.toml:") {
		t.Fatalf("got %v, want an error that names config.toml", err)
	}
	if err := editor.Check(context.Background(), "model = \"gpt-5\"\n"); err != nil {
		t.Fatalf("valid config: %v", err)
	}
}

// Package codex reads and changes the files of the Codex CLI. Config changes go
// through Codex itself, so that they keep comments and pass its own checks.
package codex

import (
	"errors"
	"os"
	"path/filepath"
	"regexp"
	"slices"
)

// Paths locates the files that Codex reads.
type Paths struct {
	// Home is CODEX_HOME, usually ~/.codex.
	Home string
	// User is the home folder, where ~/.agents/skills lives.
	User string
}

func DefaultPaths() (Paths, error) {
	home, err := os.UserHomeDir()
	if err != nil {
		return Paths{}, err
	}
	if dir := os.Getenv("CODEX_HOME"); dir != "" {
		return Paths{Home: dir, User: home}, nil
	}
	return Paths{Home: filepath.Join(home, ".codex"), User: home}, nil
}

type Kind string

const (
	KindConfig Kind = "config"
	KindAgents Kind = "agents-md"
	KindSkill  Kind = "skill"
)

var (
	ErrUnknownKind  = errors.New("unknown file kind")
	ErrBadDir       = errors.New("folder must be an absolute path to an existing directory")
	ErrGlobalDir    = errors.New("this folder holds the global Codex config, so use Global instead")
	ErrBadSkillName = errors.New("skill names may only contain letters, digits, dots, dashes and underscores")
)

// File returns the path of a config file. An empty dir selects the user scope.
func (p Paths) File(dir string, kind Kind) (string, error) {
	if dir == "" {
		switch kind {
		case KindConfig:
			return filepath.Join(p.Home, "config.toml"), nil
		case KindAgents:
			return filepath.Join(p.Home, "AGENTS.md"), nil
		}
		return "", ErrUnknownKind
	}

	dir, err := p.ProjectDir(dir)
	if err != nil {
		return "", err
	}
	switch kind {
	case KindConfig:
		return filepath.Join(dir, ".codex", "config.toml"), nil
	case KindAgents:
		return filepath.Join(dir, "AGENTS.md"), nil
	}
	return "", ErrUnknownKind
}

var (
	skillName       = regexp.MustCompile(`^[A-Za-z0-9][A-Za-z0-9._-]*$`)
	ErrNotSkillFile = errors.New("this file is not the SKILL.md of a skill in a skills folder")
)

// SkillRoots are the folders where Codex finds the skills of a scope. New skills go
// into the first one. Codex still reads the older .codex/skills folders.
func (p Paths) SkillRoots(dir string) ([]string, error) {
	if dir == "" {
		return []string{filepath.Join(p.User, ".agents", "skills"), filepath.Join(p.Home, "skills")}, nil
	}
	project, err := p.ProjectDir(dir)
	if err != nil {
		return nil, err
	}
	return []string{filepath.Join(project, ".agents", "skills"), filepath.Join(project, ".codex", "skills")}, nil
}

// SkillFile returns the SKILL.md of a skill. An existing skill is found by its path,
// which must be in a skills folder of the scope. A new skill only has a name.
func (p Paths) SkillFile(dir, name, path string) (string, error) {
	roots, err := p.SkillRoots(dir)
	if err != nil {
		return "", err
	}
	if path == "" {
		if !skillName.MatchString(name) {
			return "", ErrBadSkillName
		}
		return filepath.Join(roots[0], name, "SKILL.md"), nil
	}
	path = filepath.Clean(path)
	if filepath.Base(path) == "SKILL.md" && slices.Contains(roots, filepath.Dir(filepath.Dir(path))) {
		return path, nil
	}
	return "", ErrNotSkillFile
}

// ProjectDir rejects the folder whose .codex is the Codex home, usually the home
// folder, because its project files are the global files.
func (p Paths) ProjectDir(dir string) (string, error) {
	if !filepath.IsAbs(dir) {
		return "", ErrBadDir
	}
	dir = filepath.Clean(dir)
	if info, err := os.Stat(dir); err != nil || !info.IsDir() {
		return "", ErrBadDir
	}
	if sameFile(filepath.Join(dir, ".codex"), p.Home) {
		return "", ErrGlobalDir
	}
	return dir, nil
}

func exists(path string) bool {
	_, err := os.Stat(path)
	return err == nil
}

func sameFile(a, b string) bool {
	infoA, errA := os.Stat(a)
	infoB, errB := os.Stat(b)
	if errA != nil || errB != nil {
		return filepath.Clean(a) == filepath.Clean(b)
	}
	return os.SameFile(infoA, infoB)
}

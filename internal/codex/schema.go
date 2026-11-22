package codex

import (
	"context"
	_ "embed"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"slices"
	"sync"
	"time"
)

// bundledSchema is the config schema of one Codex release, written by
// `make config-schema`. It is used until the schema of the installed version loads.
//
//go:embed config-schema.json
var bundledSchema []byte

// Schema is the config schema, with its references resolved for the form.
type Schema struct {
	// Version is the Codex version that the schema comes from.
	Version string `json:"version"`
	// Matches is false while the schema of the installed version is still loading.
	Matches bool            `json:"matches"`
	Schema  json.RawMessage `json:"schema"`
}

type snapshot struct {
	Version string          `json:"version"`
	Schema  json.RawMessage `json:"schema"`
}

// SchemaURL is where each Codex release publishes the schema of config.toml.
func SchemaURL(version string) string {
	return fmt.Sprintf("https://raw.githubusercontent.com/openai/codex/rust-v%s/codex-rs/core/config.schema.json", version)
}

// SchemaLoader returns the schema of the installed Codex. It downloads the
// schema of a version once, keeps it in the cache folder, and uses the bundled
// schema until then.
type SchemaLoader struct {
	mu       sync.Mutex
	cacheDir string
	bundled  Schema
	loaded   map[string]Schema
	fetching map[string]bool
}

func NewSchemaLoader() (*SchemaLoader, error) {
	var snap snapshot
	if err := json.Unmarshal(bundledSchema, &snap); err != nil {
		return nil, fmt.Errorf("read the bundled config schema: %w", err)
	}
	resolved, err := Resolve(snap.Schema)
	if err != nil {
		return nil, err
	}
	dir, err := os.UserCacheDir()
	if err == nil {
		dir = filepath.Join(dir, "codexed", "config-schema")
	}
	return &SchemaLoader{
		cacheDir: dir,
		bundled:  Schema{Version: snap.Version, Schema: resolved},
		loaded:   map[string]Schema{},
		fetching: map[string]bool{},
	}, nil
}

var versionPattern = regexp.MustCompile(`^\d+\.\d+\.\d+([-.][0-9A-Za-z.]+)?$`)

// Load returns the schema for version. An empty version gives the bundled schema.
func (l *SchemaLoader) Load(version string) Schema {
	l.mu.Lock()
	defer l.mu.Unlock()

	if version == "" || version == l.bundled.Version || !versionPattern.MatchString(version) {
		return Schema{Version: l.bundled.Version, Matches: version == l.bundled.Version, Schema: l.bundled.Schema}
	}
	if schema, ok := l.loaded[version]; ok {
		return schema
	}
	if data, err := os.ReadFile(l.cachePath(version)); err == nil {
		if resolved, err := Resolve(data); err == nil {
			schema := Schema{Version: version, Matches: true, Schema: resolved}
			l.loaded[version] = schema
			return schema
		}
	}
	if !l.fetching[version] {
		l.fetching[version] = true
		go l.fetch(version)
	}
	return Schema{Version: l.bundled.Version, Schema: l.bundled.Schema}
}

func (l *SchemaLoader) cachePath(version string) string {
	return filepath.Join(l.cacheDir, version+".json")
}

// fetch downloads the schema of version. After a failure, the bundled schema stays
// in use until Codexed restarts.
func (l *SchemaLoader) fetch(version string) {
	data, err := FetchSchema(context.Background(), version)
	if err != nil {
		log.Printf("config schema for Codex %s: %v", version, err)
		return
	}
	resolved, err := Resolve(data)
	if err != nil {
		log.Printf("config schema for Codex %s: %v", version, err)
		return
	}
	if l.cacheDir != "" && os.MkdirAll(l.cacheDir, 0o755) == nil {
		os.WriteFile(l.cachePath(version), data, 0o644)
	}
	l.mu.Lock()
	l.loaded[version] = Schema{Version: version, Matches: true, Schema: resolved}
	l.mu.Unlock()
}

// FetchSchema downloads the config schema of a Codex release.
func FetchSchema(ctx context.Context, version string) ([]byte, error) {
	ctx, cancel := context.WithTimeout(ctx, 20*time.Second)
	defer cancel()
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, SchemaURL(version), nil)
	if err != nil {
		return nil, err
	}
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("download the schema: %s", resp.Status)
	}
	data, err := io.ReadAll(io.LimitReader(resp.Body, 16<<20))
	if err != nil {
		return nil, err
	}
	if !json.Valid(data) {
		return nil, fmt.Errorf("download the schema: not JSON")
	}
	return data, nil
}

// Resolve replaces references with what they point to, so that the form can read
// every setting directly. It also writes "oneOf" as "anyOf" and drops "null" from
// types, because a missing key already means "not set".
func Resolve(raw []byte) (json.RawMessage, error) {
	var doc map[string]any
	if err := json.Unmarshal(raw, &doc); err != nil {
		return nil, err
	}
	defs, _ := doc["definitions"].(map[string]any)
	if defs == nil {
		defs, _ = doc["$defs"].(map[string]any)
	}
	out := resolve(doc, defs, nil).(map[string]any)
	delete(out, "definitions")
	delete(out, "$defs")
	delete(out, "$schema")
	return json.Marshal(out)
}

// A definition that refers to itself is cut off, and so is very deep nesting.
const maxDepth = 12

func resolve(node any, defs map[string]any, stack []string) any {
	switch v := node.(type) {
	case []any:
		out := make([]any, len(v))
		for i, item := range v {
			out[i] = resolve(item, defs, stack)
		}
		return out
	case map[string]any:
		if ref, ok := v["$ref"].(string); ok {
			name := filepath.Base(ref)
			merged := map[string]any{}
			if target, ok := defs[name]; ok && !slices.Contains(stack, name) && len(stack) < maxDepth {
				if m, ok := resolve(target, defs, append(stack, name)).(map[string]any); ok {
					merged = m
				}
			}
			for key, value := range v {
				if key != "$ref" {
					merged[key] = resolve(value, defs, stack)
				}
			}
			return simplify(merged)
		}
		out := make(map[string]any, len(v))
		for key, value := range v {
			out[key] = resolve(value, defs, stack)
		}
		return simplify(out)
	}
	return node
}

func simplify(node map[string]any) map[string]any {
	if types, ok := node["type"].([]any); ok {
		kept := slices.DeleteFunc(slices.Clone(types), func(t any) bool { return t == "null" })
		if len(kept) == 1 {
			node["type"] = kept[0]
		} else {
			node["type"] = kept
		}
	}
	if one, ok := node["oneOf"]; ok && node["anyOf"] == nil {
		node["anyOf"] = one
		delete(node, "oneOf")
	}
	if options, ok := node["anyOf"].([]any); ok {
		options = slices.DeleteFunc(slices.Clone(options), func(o any) bool {
			m, ok := o.(map[string]any)
			return ok && m["type"] == "null" && len(m) == 1
		})
		if len(options) == 1 {
			delete(node, "anyOf")
			node = mergeInto(node, options[0])
		} else {
			node["anyOf"] = options
		}
	}
	if all, ok := node["allOf"].([]any); ok && len(all) == 1 {
		delete(node, "allOf")
		node = mergeInto(node, all[0])
	}
	return node
}

// mergeInto adds the keys of part that node does not set, such as the type of a
// referenced definition under the description of the property.
func mergeInto(node map[string]any, part any) map[string]any {
	m, ok := part.(map[string]any)
	if !ok {
		return node
	}
	for key, value := range m {
		if _, set := node[key]; !set {
			node[key] = value
		}
	}
	return node
}

package codex

import (
	"encoding/json"
	"testing"
)

func TestResolve(t *testing.T) {
	raw := `{
		"definitions": {
			"Mode": {"type": "string", "enum": ["read-only", "workspace-write"]},
			"Node": {"type": "object", "properties": {"child": {"$ref": "#/definitions/Node"}}}
		},
		"properties": {
			"sandbox_mode": {"description": "Sandbox", "anyOf": [{"$ref": "#/definitions/Mode"}, {"type": "null"}]},
			"model": {"type": ["string", "null"]},
			"tree": {"$ref": "#/definitions/Node"},
			"either": {"oneOf": [{"type": "string"}, {"type": "boolean"}]}
		}
	}`
	out, err := Resolve([]byte(raw))
	if err != nil {
		t.Fatal(err)
	}
	var doc struct {
		Properties map[string]map[string]any `json:"properties"`
	}
	if err := json.Unmarshal(out, &doc); err != nil {
		t.Fatal(err)
	}
	mode := doc.Properties["sandbox_mode"]
	if mode["description"] != "Sandbox" || mode["type"] != "string" || len(mode["enum"].([]any)) != 2 {
		t.Errorf("sandbox_mode = %v, want the enum under the description", mode)
	}
	if doc.Properties["model"]["type"] != "string" {
		t.Errorf("model type = %v, want string", doc.Properties["model"]["type"])
	}
	if _, ok := doc.Properties["either"]["anyOf"]; !ok {
		t.Errorf("either = %v, want anyOf", doc.Properties["either"])
	}
	if _, ok := doc.Properties["tree"]["properties"]; !ok {
		t.Errorf("tree = %v, want its properties, cut off where it repeats", doc.Properties["tree"])
	}
}

func TestBundledSchemaLoads(t *testing.T) {
	loader, err := NewSchemaLoader()
	if err != nil {
		t.Fatal(err)
	}
	schema := loader.Load("")
	var doc struct {
		Properties map[string]any `json:"properties"`
	}
	if err := json.Unmarshal(schema.Schema, &doc); err != nil {
		t.Fatal(err)
	}
	if len(doc.Properties) < 50 {
		t.Errorf("bundled schema has %d settings, want more than 50", len(doc.Properties))
	}
}

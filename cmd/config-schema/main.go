// Command config-schema prints the config schema of the installed Codex, with its
// version, for the bundled schema of the app and the docs homepage.
package main

import (
	"context"
	"encoding/json"
	"log"
	"os"

	"codexed/internal/codex"
)

func main() {
	binary, err := codex.FindBinary()
	if err != nil {
		log.Fatal(err)
	}
	data, err := codex.FetchSchema(context.Background(), binary.Version)
	if err != nil {
		log.Fatal(err)
	}
	out := json.NewEncoder(os.Stdout)
	out.SetIndent("", "  ")
	if err := out.Encode(map[string]any{"version": binary.Version, "schema": json.RawMessage(data)}); err != nil {
		log.Fatal(err)
	}
}

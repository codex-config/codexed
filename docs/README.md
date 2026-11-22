# docs

The Codexed landing page and docs, made with [Fumadocs](https://fumadocs.dev) and Next.js. The site is at https://codexconfig.com.

```bash
npm run dev     # dev server on http://localhost:3000
npm run build   # static site in out/
npm run start   # serves out/ to check the build
```

The site is a [static export](https://nextjs.org/docs/app/guides/static-exports), so any file host can serve `out/`. To serve it from a folder, such as `/codexed` on GitHub Pages, build it with `NEXT_PUBLIC_BASE_PATH=/codexed`. The Docs workflow sets it for you. Search runs in the browser from an index that the build writes to `/api/search`. The Markdown of each page is at `/llms.mdx/docs/<page>.md`, and `/llms.txt` and `/llms-full.txt` list all pages.

## Where things are

| Path                             | What it is                                                           |
| -------------------------------- | -------------------------------------------------------------------- |
| `content/docs`                   | The pages, in MDX. `meta.json` sets their order.                      |
| `app/(home)`                     | The homepage: every setting of `config.toml` with a control to set it, a TOML editor that copies and downloads the file, and the Codexed card. |
| `app/(home)/categories.ts`       | The groups of settings on the homepage, and the examples.             |
| `app/(home)/presets.ts`          | Common values to pick from, such as the model names. The schema does not list them, so update them when Codex changes. |
| `app/(home)/config-schema.json`  | The config schema of Codex. Run `make config-schema` in the repository after you update Codex. |
| `app/(home)/settings-data.ts`    | Reads the schema, as the app does, and turns it into the list of settings. |
| `app/(home)/toml.ts`             | Reads and writes TOML with [smol-toml](https://github.com/squirrelchat/smol-toml). |
| `app/docs`                       | The docs layout and pages.                                            |
| `lib/shared.ts`                  | The app name, the routes, and the GitHub repository for the links.   |
| `lib/source.ts`                  | Loads the pages, with the [Macro API](https://fumadocs.dev/docs/mdx/macro). |
| `lib/layout.shared.tsx`          | Options for all layouts, such as the title and the GitHub link.      |

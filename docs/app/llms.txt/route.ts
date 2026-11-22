import { count } from '@/app/(home)/settings/reference';
import { docsLlms } from '@/lib/source';
import { absoluteUrl } from '@/lib/shared';

export const revalidate = false;

export async function GET() {
  // The docs index starts with its own title, which this file replaces.
  const docs = (await docsLlms.index()).replace(/^# .*\n+/, '');
  const text = `# Codex CLI settings and Codexed

> ${absoluteUrl('/')} explains each of the ${count} Codex CLI settings in plain English. It also makes Codexed, a small open-source app that edits your Codex config.toml, AGENTS.md, MCP servers, skills and plugins.

## Codex CLI settings

- [All Codex CLI settings](${absoluteUrl('/settings.md')}): every setting in config.toml, with its type, values, default and an example.

## Codexed docs

${docs}

## Optional

- [Everything in one file](${absoluteUrl('/llms-full.txt')}): the Codexed docs and the settings reference.
`;
  return new Response(text, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}

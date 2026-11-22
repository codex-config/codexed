import { absoluteUrl } from '@/lib/shared';
import type { Setting } from '../fields';
import { codexVersion } from '../settings-data';
import { categories, count, exampleOf, rangeOf, settingUrl, typeOf, valuesOf } from './reference';

// The settings reference as one Markdown file, for agents and AI search.
export function settingsMarkdown(): string {
  const out = [
    '# Codex CLI settings',
    '',
    `All ${count} settings that Codex ${codexVersion} reads from config.toml, by group. Each setting also has a page at ${absoluteUrl('/settings')}/<name>.`,
    '',
    'Codex reads settings from `~/.codex/config.toml` (all of your projects) and from `.codex/config.toml` in a project, which Codex reads only when you trust the project. When a setting is in both, the project file wins. Command-line flags, such as `--config`, win over both.',
  ];

  for (const category of categories) {
    out.push('', `## ${category.label}`, '', category.intro);
    for (const setting of category.settings) {
      out.push('', `### ${setting.key}`, '');
      if (setting.description) out.push(setting.description, '');
      out.push(...facts(setting));
      if (category.id === 'experimental') out.push('- Status: experimental. Codex may change or remove it in any version.');
      out.push(`- Page: ${absoluteUrl(settingUrl(setting.key))}`);
      const example = exampleOf(setting);
      if (example) out.push('', '```toml', example, '```');
      if (setting.field.kind === 'object') out.push('', ...children(setting.field.settings, setting.key, 0));
    }
  }
  return out.join('\n') + '\n';
}

function facts(setting: Setting): string[] {
  const lines = [`- Type: ${typeOf(setting.field)}`];
  const range = rangeOf(setting.field);
  if (range) lines.push(`- Range: ${range}`);
  const { values, complete } = valuesOf(setting);
  if (values.length > 0) {
    const list = values.map(({ value, hint }) => `\`${value}\`${hint ? ` (${hint})` : ''}`).join(', ');
    lines.push(`- ${complete ? 'Values' : 'Common values'}: ${list}`);
  }
  if (setting.fallback !== undefined) lines.push(`- Default: \`${setting.fallback}\``);
  return lines;
}

function children(settings: Setting[], parent: string, depth: number): string[] {
  const indent = '  '.repeat(depth);
  return settings.flatMap((setting) => {
    const path = `${parent}.${setting.key}`;
    const details = [typeOf(setting.field), setting.description].filter(Boolean).join('. ');
    const lines = [`${indent}- \`${path}\`: ${details}`];
    if (setting.field.kind === 'object') lines.push(...children(setting.field.settings, path, depth + 1));
    return lines;
  });
}

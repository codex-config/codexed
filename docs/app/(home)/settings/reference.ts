import type { Field, Setting } from '../fields';
import { type Category, getSettings } from '../settings-data';
import { snippetOf } from '../toml';

export type Entry = { setting: Setting; category: Category };

export const { categories, count } = getSettings();

export const entries: Entry[] = categories.flatMap((category) =>
  category.settings.map((setting) => ({ setting, category })),
);

export const findEntry = (key: string) => entries.find((entry) => entry.setting.key === key);

export const settingUrl = (key: string) => `/settings/${key}`;

// The first sentence. A sentence longer than max is cut at a word.
export function summary(text: string, max = 160): string {
  const trimmed = text.trim();
  const first = /^[\s\S]+?[.!?](?=\s+[A-Z(`"]|$)/.exec(trimmed)?.[0] ?? trimmed;
  if (first.length <= max) return first;
  const cut = first.slice(0, max - 1);
  return `${cut.slice(0, cut.lastIndexOf(' ')).replace(/[,;:(]$/, '')}…`;
}

// For the meta description: the first sentence, with more words when it is short.
export function describe({ key, description }: Setting): string {
  const first = summary(description, 155).replace(/(?<=[^.!?…])$/, '.');
  if (!first) return `How to set ${key} in your Codex config.toml, with an example.`;
  return first.length < 90 ? `${first} How to set ${key} in your Codex config.toml.` : first;
}

export function typeOf(field: Field): string {
  switch (field.kind) {
    case 'boolean':
      return 'true or false';
    case 'enum':
      return 'Text, one of the values below';
    case 'string':
      return 'Text';
    case 'number':
      return field.integer ? 'Whole number' : 'Number';
    case 'list':
      return 'List of text values';
    case 'map':
      return 'Table, with a text value for each name';
    case 'object':
      return `Table with ${field.settings.length} ${field.settings.length === 1 ? 'setting' : 'settings'}`;
    case 'toml':
      return 'TOML value';
  }
}

export function rangeOf(field: Field): string | undefined {
  if (field.kind !== 'number') return undefined;
  // The schema gives the largest safe integer when there is no real limit.
  const real = (bound?: number) => (bound !== undefined && Math.abs(bound) < Number.MAX_SAFE_INTEGER ? bound : undefined);
  const [min, max] = [real(field.min), real(field.max)];
  if (min !== undefined && max !== undefined) return `From ${min} to ${max}`;
  if (min !== undefined) return `${min} or more`;
  if (max !== undefined) return `${max} or less`;
  return undefined;
}

// Values from the schema are the only ones allowed. Presets are common choices.
export function valuesOf({ field, presets }: Setting): { values: { value: string; hint?: string }[]; complete: boolean } {
  if (field.kind === 'enum') return { values: field.options.map((value) => ({ value })), complete: true };
  if (field.kind === 'list' && field.options.length > 0) {
    return { values: field.options.map((value) => ({ value })), complete: true };
  }
  return { values: presets ?? [], complete: false };
}

// A config.toml with only this setting, when there is a useful value to show.
export function exampleOf(setting: Setting, path = [setting.key]): string | undefined {
  const value = setting.example !== undefined ? JSON.parse(setting.example) : sample(setting);
  return value === undefined ? undefined : snippetOf(path, value);
}

function sample({ field, presets, fallback }: Setting): unknown {
  switch (field.kind) {
    case 'boolean':
      return fallback !== true;
    case 'enum':
      return field.options[0];
    case 'string':
      return presets?.[0]?.value;
    case 'list': {
      const first = field.options[0] ?? presets?.[0]?.value;
      return first === undefined ? undefined : [first];
    }
  }
  return undefined;
}

// The settings after this one in its group, so that every page gets links from others.
export function neighbors({ setting, category }: Entry, limit = 8): Setting[] {
  const others = category.settings.filter((each) => each.key !== setting.key);
  const start = category.settings.findIndex((each) => each.key === setting.key);
  return [...others.slice(start), ...others.slice(0, start)].slice(0, limit);
}

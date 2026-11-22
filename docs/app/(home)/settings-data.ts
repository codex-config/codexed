import { categories, examples, type CategoryId } from './categories';
import snapshot from './config-schema.json';
import type { Field, KeyTree, Setting } from './fields';
import { presets } from './presets';

type Schema = {
  description?: string;
  type?: string | string[];
  enum?: unknown[];
  const?: unknown;
  default?: unknown;
  minimum?: number;
  maximum?: number;
  anyOf?: Schema[];
  items?: Schema;
  properties?: Record<string, Schema>;
  additionalProperties?: Schema | boolean;
};

type Node = Record<string, unknown>;

export type Category = { id: CategoryId; label: string; intro: string; settings: Setting[] };

// The same steps as Resolve in the Codexed app (internal/codex/schema.go). Each reference
// gets the definition that it points to, "oneOf" becomes "anyOf", and "null" types are
// removed, because a missing key already means "not set". A list with one option becomes
// that option.
function resolveSchema(document: Node): Schema {
  const definitions = (document.definitions ?? document.$defs ?? {}) as Node;
  const resolved = resolve(document, definitions, []) as Node;
  delete resolved.definitions;
  delete resolved.$defs;
  delete resolved.$schema;
  return resolved as Schema;
}

// A definition that refers to itself is cut off, and so is very deep nesting.
const maxDepth = 12;

function isNode(value: unknown): value is Node {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function resolve(node: unknown, definitions: Node, stack: string[]): unknown {
  if (Array.isArray(node)) return node.map((item) => resolve(item, definitions, stack));
  if (!isNode(node)) return node;

  let out: Node = {};
  if (typeof node.$ref === 'string') {
    const name = node.$ref.split('/').pop() ?? '';
    if (name in definitions && !stack.includes(name) && stack.length < maxDepth) {
      const target = resolve(definitions[name], definitions, [...stack, name]);
      if (isNode(target)) out = target;
    }
  }
  for (const [key, value] of Object.entries(node)) {
    if (key !== '$ref') out[key] = resolve(value, definitions, stack);
  }
  return simplify(out);
}

function simplify(node: Node): Node {
  if (Array.isArray(node.type)) {
    const kept = node.type.filter((type) => type !== 'null');
    node.type = kept.length === 1 ? kept[0] : kept;
  }
  if (node.oneOf !== undefined && node.anyOf === undefined) {
    node.anyOf = node.oneOf;
    delete node.oneOf;
  }
  if (Array.isArray(node.anyOf)) {
    const options = node.anyOf.filter(
      (option) => !(isNode(option) && option.type === 'null' && Object.keys(option).length === 1),
    );
    if (options.length === 1) {
      delete node.anyOf;
      mergeInto(node, options[0]);
    } else {
      node.anyOf = options;
    }
  }
  if (Array.isArray(node.allOf) && node.allOf.length === 1) {
    const [only] = node.allOf;
    delete node.allOf;
    mergeInto(node, only);
  }
  return node;
}

// Adds the keys that the node does not set, such as the type of a referenced
// definition under the description of the property.
function mergeInto(node: Node, part: unknown) {
  if (!isNode(part)) return;
  for (const [key, value] of Object.entries(part)) {
    if (!(key in node)) node[key] = value;
  }
}

const root = resolveSchema(snapshot.schema as Node);
const properties = root.properties ?? {};

// Codexed hides these too. Codex writes them itself.
const hidden = new Set(['projects', 'notice']);

// The same checks as the Codexed app. Compatibility-only settings only keep old files loading.
const isInternal = (schema: Schema) => /^(@internal|compatibility-only)/i.test(schema.description ?? '');
const isDeprecated = (schema: Schema) => /^deprecated\b/i.test(schema.description ?? '');
const isExperimental = (key: string, schema: Schema) =>
  key.startsWith('experimental_') || /^(experimental\b|\[unstable\])/i.test(schema.description ?? '');

function withoutNull(schema: Schema): Schema {
  if (!schema.anyOf) return schema;
  const options = schema.anyOf.filter((option) => option.type !== 'null');
  if (options.length === 1) return { ...options[0], description: schema.description ?? options[0].description };
  return { ...schema, anyOf: options };
}

function strings(values: unknown[] | undefined): string[] {
  return (values ?? []).filter((value): value is string => typeof value === 'string');
}

// The names that a string option allows. Empty for any text.
const namesOf = (option: Schema) => strings(option.enum ?? (option.const === undefined ? [] : [option.const]));

function fieldOf(schema: Schema, path: string): Field {
  const s = withoutNull(schema);

  if (s.anyOf) {
    const text = s.anyOf.filter((option) => option.type === 'string');
    const names = text.flatMap(namesOf);
    // Names from a list, as in file_opener. With a free text option, the names are suggestions.
    if (text.length === s.anyOf.length) {
      return text.every((option) => namesOf(option).length > 0)
        ? { kind: 'enum', options: names }
        : { kind: 'string', suggestions: names };
    }
    // The common shape gets a control, and the other shapes open as TOML. For example a
    // name or a table (approval_policy), a key or a list of keys (tui.keymap), or on, off
    // or a table (some feature flags).
    if (names.length > 0) return { kind: 'enum', options: names };
    if (text.length > 0) return { kind: 'string', suggestions: [] };
    if (s.anyOf.some((option) => option.type === 'boolean')) return { kind: 'boolean' };
    return { kind: 'toml' };
  }

  switch (Array.isArray(s.type) ? undefined : s.type) {
    case 'boolean':
      return { kind: 'boolean' };
    case 'string':
      return s.enum ? { kind: 'enum', options: strings(s.enum) } : { kind: 'string', suggestions: [] };
    case 'integer':
    case 'number':
      return { kind: 'number', integer: s.type === 'integer', min: s.minimum, max: s.maximum };
    case 'array': {
      const items = withoutNull(s.items ?? {});
      return items.type === 'string' ? { kind: 'list', options: strings(items.enum) } : { kind: 'toml' };
    }
    case 'object': {
      if (s.properties && Object.keys(s.properties).length > 0) {
        const settings = Object.entries(s.properties)
          .filter(([, child]) => !isInternal(child) && !isDeprecated(child))
          .map(([key, child]) => toSetting(key, child, `${path}.${key}`));
        return { kind: 'object', settings };
      }
      const values = s.additionalProperties;
      if (typeof values === 'object' && withoutNull(values).type === 'string') return { kind: 'map' };
      return { kind: 'toml' };
    }
  }
  return { kind: 'toml' };
}

// Many descriptions state the default, as in "Defaults to `true`".
function fallbackOf(schema: Schema): boolean | undefined {
  if (typeof schema.default === 'boolean') return schema.default;
  const stated = /\bdefaults?(?: to|:)?\s*[(`]?(true|false)\b/i.exec(schema.description ?? '')?.[1];
  return stated === undefined ? undefined : stated.toLowerCase() === 'true';
}

// The Experimental tab already says what the prefix says.
function describe(schema: Schema) {
  const text = (schema.description ?? '').replace(/^(experimental \/ do not use\.|\[unstable\])\s*/i, '');
  return /^a path that is guaranteed to be absolute/i.test(text) ? 'An absolute path.' : text;
}

function toSetting(key: string, schema: Schema, path = key): Setting {
  let field = fieldOf(schema, path);
  let common = presets[path];
  // Known values in the schema become presets.
  if (field.kind === 'string' && !common && field.suggestions.length > 0) {
    common = field.suggestions.map((value) => ({ value }));
    field = { kind: 'string', suggestions: [] };
  }
  return {
    key,
    description: describe(schema),
    field,
    fallback: field.kind === 'boolean' ? fallbackOf(schema) : undefined,
    presets: common,
    example: path in examples ? JSON.stringify(examples[path]) : undefined,
  };
}

// Tables without a fixed list of keys, and values with more than one shape, are not checked.
function treeOf(schema: Schema): KeyTree | null {
  const s = withoutNull(schema);
  if (s.anyOf || (s.type !== 'object' && !s.properties)) return null;
  const extra = s.additionalProperties;
  const named = Object.entries(s.properties ?? {});
  if (named.length === 0 && typeof extra !== 'object' && extra !== false) return null;

  const tree: KeyTree = Object.fromEntries(named.map(([key, child]) => [key, treeOf(child)]));
  if (typeof extra === 'object') tree['*'] = treeOf(extra);
  else if (extra !== false) tree['*'] = null;
  return tree;
}

export function getSettings() {
  const listed = new Set<string>();
  const result: Category[] = [];
  const usable = (key: string) => {
    const schema = properties[key];
    return schema !== undefined && !hidden.has(key) && !isInternal(schema) && !isDeprecated(schema);
  };
  const experimental = Object.keys(properties).filter((key) => usable(key) && isExperimental(key, properties[key]));

  for (const category of categories) {
    const keys: readonly string[] = category.keys;
    const settings = keys
      .filter((key) => usable(key) && !experimental.includes(key) && !listed.has(key))
      .map((key) => toSetting(key, properties[key]));
    for (const setting of settings) listed.add(setting.key);
    result.push({ id: category.id, label: category.label, intro: category.intro, settings });
  }

  const byName = (a: string, b: string) => a.localeCompare(b);
  const rest = Object.keys(properties).filter((key) => usable(key) && !experimental.includes(key) && !listed.has(key));
  result.push({
    id: 'more',
    label: 'More',
    intro: 'Other settings that Codex reads.',
    settings: rest.sort(byName).map((key) => toSetting(key, properties[key])),
  });
  result.push({
    id: 'experimental',
    label: 'Experimental',
    intro: 'Codex may change or remove these settings in any version. Only use them if you know that you need them.',
    settings: experimental.sort(byName).map((key) => toSetting(key, properties[key])),
  });

  return {
    count: result.reduce((total, category) => total + category.settings.length, 0),
    categories: result.filter((category) => category.settings.length > 0),
    // All keys that Codex knows, to find typos in a pasted file.
    known: treeOf(root) ?? {},
  };
}

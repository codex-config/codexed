import type { JSONSchema } from '@/lib/api'
import { isPlainObject, setPath, type Config } from '@/lib/settings'

// A change to the global config.toml. "add" puts entries in a list and keeps the
// ones that are there. "remove" deletes a setting.
export type Change =
  | { kind: 'set'; path: string[]; value: unknown; done?: (current: unknown) => boolean }
  | { kind: 'add'; path: string[]; items: string[] }
  | { kind: 'remove'; path: string[] }

export type Group = 'cleanup' | 'privacy' | 'quiet' | 'quality' | 'advanced'

export type Suggestion = {
  id: string
  group: Group
  title: string
  benefit: string
  tradeoff?: string
  changes: Change[]
}

export const groups: { id: Group; label: string }[] = [
  { id: 'cleanup', label: 'Clean up' },
  { id: 'privacy', label: 'Privacy and safety' },
  { id: 'quiet', label: 'Fewer interruptions' },
  { id: 'quality', label: 'Quality' },
  { id: 'advanced', label: 'Advanced' },
]

const set = (path: string, value: unknown, done?: (current: unknown) => boolean): Change => ({
  kind: 'set',
  path: path.split('.'),
  value,
  done,
})

// Keep these current with Codex: a suggestion whose setting or value the schema of
// the installed Codex does not know stays hidden.
const list: Suggestion[] = [
  {
    id: 'core-env',
    group: 'privacy',
    title: 'Keep secrets out of commands',
    benefit:
      'Commands that Codex runs get only basic variables, such as HOME and PATH. Other variables, such as database URLs or cloud credentials, stay out.',
    tradeoff: 'A tool that needs another variable fails until you add it under shell_environment_policy.set.',
    changes: [set('shell_environment_policy.inherit', 'core')],
  },
  {
    id: 'analytics',
    group: 'privacy',
    title: 'Send less data',
    benefit: 'Codex stops sending analytics from this computer.',
    changes: [set('analytics.enabled', false)],
  },
  {
    id: 'workspace',
    group: 'quiet',
    title: 'Work in the project, ask for the rest',
    benefit:
      'Codex edits files and runs commands inside the project without asking. It asks before it goes outside the project or uses the network.',
    tradeoff: 'You approve those steps one by one.',
    changes: [set('approval_policy', 'on-request'), set('sandbox_mode', 'workspace-write')],
  },
  {
    id: 'tooltips',
    group: 'quiet',
    title: 'Hide startup tips',
    benefit: 'Codex starts without tips on the welcome screen.',
    changes: [set('tui.show_tooltips', false)],
  },
  {
    id: 'animations',
    group: 'quiet',
    title: 'Turn off animations',
    benefit: 'No shimmer, spinners or welcome animation, so the screen stays calm.',
    changes: [set('tui.animations', false)],
  },
  {
    id: 'feedback',
    group: 'quiet',
    title: 'Turn off feedback prompts',
    benefit: 'Codex no longer asks you for feedback.',
    changes: [set('feedback.enabled', false)],
  },
  {
    id: 'live-search',
    group: 'quality',
    title: 'Search the live web',
    benefit: 'Codex reads the web as it is now, so docs and versions are up to date.',
    tradeoff: 'Searches are slower, and your queries leave your computer.',
    changes: [set('web_search', 'live')],
  },
  {
    id: 'reasoning-summary',
    group: 'quality',
    title: 'Show what the model is thinking',
    benefit: 'You see a summary of the reasoning, so you know why Codex did something.',
    tradeoff: 'Answers get longer.',
    changes: [set('model_reasoning_summary', 'detailed')],
  },
  {
    id: 'effort',
    group: 'advanced',
    title: 'Think harder by default',
    benefit: 'High reasoning effort gives better results on hard tasks.',
    tradeoff: 'Answers take longer and use more of your limits.',
    changes: [set('model_reasoning_effort', 'high')],
  },
  {
    id: 'verbosity',
    group: 'advanced',
    title: 'Shorter answers',
    benefit: 'Answers get to the point.',
    tradeoff: 'You get less explanation.',
    changes: [set('model_verbosity', 'low')],
  },
]

// Codex says not to use these, or keeps them only so that old configs still load.
const doNotUse = (schema: JSONSchema | undefined) => /do not use|^compatibility-only/i.test(schema?.description ?? '')

// The suggestions that would change something in this file.
export function pendingSuggestions(config: Config, schema: JSONSchema): Suggestion[] {
  const properties = schema.properties ?? {}
  const cleanup: Suggestion[] = Object.keys(config)
    .filter((key) => doNotUse(properties[key]))
    .map((key) => ({
      id: `cleanup:${key}`,
      group: 'cleanup',
      title: 'Remove a setting that Codex says not to use',
      benefit: 'Codex marks this setting as experimental and not for use, or keeps it only so that old configs still load.',
      changes: [{ kind: 'remove', path: [key] }],
    }))

  const known = list.filter((suggestion) => suggestion.changes.every((change) => fits(schema, change)))
  return [...cleanup, ...known].filter((suggestion) => suggestion.changes.some((change) => !isDone(config, change)))
}

export function valueAt(config: Config, path: string[]): unknown {
  let value: unknown = config
  for (const key of path) {
    if (!isPlainObject(value)) return undefined
    value = value[key]
  }
  return value
}

export function applyChanges(config: Config, changes: Change[]) {
  for (const change of changes) {
    if (change.kind === 'set') setPath(config, change.path, structuredClone(change.value))
    if (change.kind === 'remove') setPath(config, change.path, undefined)
    if (change.kind === 'add') {
      const current = valueAt(config, change.path)
      const list = Array.isArray(current) ? current : []
      setPath(config, change.path, [...list, ...change.items.filter((item) => !list.includes(item))])
    }
  }
}

function isDone(config: Config, change: Change) {
  const current = valueAt(config, change.path)
  if (change.kind === 'remove') return current === undefined
  if (change.kind === 'add') return Array.isArray(current) && change.items.every((item) => current.includes(item))
  return equal(current, change.value) || (change.done?.(current) ?? false)
}

// Optional settings are "anything or null" in the schema. The form only needs the anything.
function unwrap(schema: JSONSchema): JSONSchema {
  const options = (schema.anyOf ?? []).filter((option) => option.type !== 'null')
  return !schema.properties && options.length === 1 ? { ...options[0], description: schema.description } : schema
}

// The installed Codex must know the setting, and the value if it lists the allowed ones.
function fits(schema: JSONSchema, change: Change) {
  let node: JSONSchema | undefined = schema
  for (const key of change.path) {
    const parent: JSONSchema | undefined = node && unwrap(node)
    const next: JSONSchema | boolean | undefined = parent?.properties?.[key] ?? parent?.additionalProperties
    if (!next || next === true) return next === true
    node = next
  }
  if (change.kind !== 'set' || !node) return node !== undefined
  node = unwrap(node)
  const allowed = [...(node.enum ?? []), ...(node.anyOf ?? []).flatMap((option) => option.enum ?? [])]
  return allowed.length === 0 || allowed.includes(change.value) || (node.anyOf ?? []).some((option) => !option.enum)
}

function equal(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((item, i) => equal(item, b[i]))
  if (isPlainObject(a) && isPlainObject(b)) {
    const keys = Object.keys(a)
    return keys.length === Object.keys(b).length && keys.every((key) => equal(a[key], b[key]))
  }
  return false
}

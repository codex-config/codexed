import type { JSONSchema } from '@/lib/api'
import { isPlainObject } from '@/lib/settings'

// The control that edits a setting. "json" is the fallback for shapes without a form.
export type Field =
  | { kind: 'boolean' }
  | { kind: 'enum'; options: string[] }
  | { kind: 'string'; suggestions: string[] }
  | { kind: 'number'; integer: boolean; min?: number; max?: number }
  | { kind: 'list'; options: string[] }
  | { kind: 'map' }
  | { kind: 'object'; properties: [string, JSONSchema][] }
  | { kind: 'json' }

export function fieldOf(schema: JSONSchema | undefined): Field {
  if (!schema) return { kind: 'json' }
  const s = withoutNull(schema)

  if (s.anyOf) {
    // For example the theme: a list of names, or any "custom:" string.
    if (s.anyOf.every((option) => option.type === 'string')) {
      return { kind: 'string', suggestions: s.anyOf.flatMap((option) => strings(option.enum)) }
    }
    // A name from a list, or a table for finer control, as in approval_policy. The
    // names get a list. A table does not fit the list, so it opens as JSON.
    const names = s.anyOf.flatMap((option) => (option.type === 'string' ? strings(option.enum ?? [option.const]) : []))
    if (names.length > 0) return { kind: 'enum', options: names }
    return { kind: 'json' }
  }

  switch (Array.isArray(s.type) ? undefined : s.type) {
    case 'boolean':
      return { kind: 'boolean' }
    case 'string':
      return s.enum ? { kind: 'enum', options: strings(s.enum) } : { kind: 'string', suggestions: [] }
    case 'integer':
    case 'number':
      return { kind: 'number', integer: s.type === 'integer', min: s.minimum, max: s.maximum }
    case 'array': {
      const items = withoutNull(s.items ?? {})
      return items.type === 'string' ? { kind: 'list', options: strings(items.enum) } : { kind: 'json' }
    }
    case 'object': {
      if (s.properties && Object.keys(s.properties).length > 0) {
        return { kind: 'object', properties: Object.entries(s.properties) }
      }
      const values = s.additionalProperties
      if (typeof values === 'object' && withoutNull(values).type === 'string') return { kind: 'map' }
      return { kind: 'json' }
    }
  }
  return { kind: 'json' }
}

// A value that does not fit its field is edited as JSON, so that nothing is lost.
export function fits(field: Field, value: unknown): boolean {
  if (value === undefined) return true
  switch (field.kind) {
    case 'boolean':
      return typeof value === 'boolean'
    case 'enum':
    case 'string':
      return typeof value === 'string'
    case 'number':
      return typeof value === 'number'
    case 'list':
      return Array.isArray(value) && value.every((item) => typeof item === 'string')
    case 'map':
      return isPlainObject(value) && Object.values(value).every((item) => typeof item === 'string')
    case 'object':
      return isPlainObject(value)
    case 'json':
      return true
  }
}

// Many descriptions state the default, as in "(default: true)".
export function defaultOf(schema: JSONSchema | undefined): unknown {
  if (schema?.default !== undefined) return schema.default
  const match = /default:?\s*(true|false)\b/i.exec(schema?.description ?? '')
  return match ? match[1].toLowerCase() === 'true' : undefined
}

export function isDeprecated(schema: JSONSchema | undefined) {
  return /^deprecated\b/i.test(schema?.description ?? '')
}

// Settings that only keep old files loading, which nobody should set anymore.
export function isInternal(schema: JSONSchema | undefined) {
  return /^(@internal|compatibility-only)/i.test(schema?.description ?? '')
}

// Codex marks settings that may change or go away, as in "Experimental / do not use".
export function isExperimental(key: string, schema: JSONSchema | undefined) {
  return key.startsWith('experimental_') || /^(experimental\b|\[unstable\])/i.test(schema?.description ?? '')
}

function withoutNull(schema: JSONSchema): JSONSchema {
  if (!schema.anyOf) return schema
  const options = schema.anyOf.filter((option) => option.type !== 'null')
  if (options.length === 1) return { ...options[0], description: schema.description ?? options[0].description }
  return { ...schema, anyOf: options }
}

function strings(values: unknown[] | undefined): string[] {
  return (values ?? []).filter((value): value is string => typeof value === 'string')
}

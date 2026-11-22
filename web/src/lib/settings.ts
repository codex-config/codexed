import { useMutation, useQueryClient } from '@tanstack/react-query'
import { parse } from 'smol-toml'

import { api, queries, type ConfigFile, type Edit, type FileRef } from '@/lib/api'
import { notify } from '@/lib/notify'

export type Config = Record<string, unknown>

// The parsed config, or the parse error. A missing or empty file is an empty config.
export function parseConfig(file: ConfigFile): { config: Config } | { error: string } {
  if (!file.exists || file.content.trim() === '') return { config: {} }
  try {
    return { config: toPlain(parse(file.content)) as Config }
  } catch (error) {
    return { error: (error as Error).message.split('\n')[0] }
  }
}

// TOML dates become strings, so that the form and the diff can compare them.
function toPlain(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString()
  if (Array.isArray(value)) return value.map(toPlain)
  if (isPlainObject(value)) return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, toPlain(v)]))
  if (typeof value === 'bigint') return Number(value)
  return value
}

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

// Sets a nested value. undefined removes it, and tables left empty are removed too.
export function setPath(target: Record<string, unknown>, path: string[], value: unknown) {
  const [key, ...rest] = path
  if (rest.length === 0) {
    if (value === undefined) delete target[key]
    else target[key] = value
    return
  }
  const child = isPlainObject(target[key]) ? { ...target[key] } : {}
  setPath(child, rest, value)
  if (Object.keys(child).length > 0) target[key] = child
  else delete target[key]
}

// diff lists the smallest edits that turn before into after. Tables are compared
// key by key, so that Codex keeps the comments of the keys that stay the same.
export function diff(before: unknown, after: unknown, path: string[] = []): Edit[] {
  if (isPlainObject(before) && isPlainObject(after)) {
    const keys = new Set([...Object.keys(before), ...Object.keys(after)])
    return [...keys].flatMap((key) => diff(before[key], after[key], [...path, key]))
  }
  if (JSON.stringify(before) === JSON.stringify(after)) return []
  return [{ path, value: after === undefined ? null : after }]
}

// Changes a config.toml. The file is read again just before each change, so that
// recent writes from Codex are kept. Changes to one file run in order.
export function useUpdateConfig(dir: string) {
  const client = useQueryClient()
  const target: FileRef = { dir, kind: 'config' }

  return useMutation({
    scope: { id: `config:${dir}` },
    mutationFn: async (change: (config: Config) => void) => {
      const file = await client.fetchQuery({ ...queries.file(target), staleTime: 0 })
      const parsed = parseConfig(file)
      if ('error' in parsed) throw new Error('Fix the TOML in the TOML view first.')

      const next = structuredClone(parsed.config)
      change(next)
      const edits = diff(parsed.config, next)
      if (edits.length === 0) return file
      return api.editConfig(dir, file.version, edits)
    },
    onSuccess: (file) => {
      client.setQueryData(queries.file(target).queryKey, file)
      client.invalidateQueries({ queryKey: ['features'] })
    },
    onError: (error) => notify.error('Could not save the config', error.message),
  })
}

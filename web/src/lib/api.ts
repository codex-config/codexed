import { queryOptions } from '@tanstack/react-query'

export type Health = {
  app: string
  version: string
  home: string
  codexHome: string
  // Missing when Codexed cannot find the Codex CLI.
  codex?: { path: string; version: string }
}

export type Project = { path: string; name: string; saved: boolean; trust?: string }

export type Kind = 'config' | 'agents-md' | 'skill'

// An empty dir means the global scope. A skill has the path that Codex reports,
// or only a name while it is new.
export type FileRef = { dir: string; kind: Kind; name?: string; path?: string }

export type ConfigFile = {
  path: string
  exists: boolean
  content: string
  version: string
}

// A key path in config.toml and its new value. null removes the key.
export type Edit = { path: string[]; value: unknown }

// A JSON Schema, with its references resolved by the server.
export type JSONSchema = {
  type?: string | string[]
  description?: string
  enum?: unknown[]
  const?: unknown
  anyOf?: JSONSchema[]
  items?: JSONSchema
  properties?: Record<string, JSONSchema>
  additionalProperties?: JSONSchema | boolean
  default?: unknown
  minimum?: number
  maximum?: number
}

// matches is false while the schema of the installed Codex is still loading.
export type ConfigSchema = { version: string; matches: boolean; schema: JSONSchema }

export type Model = {
  id: string
  model: string
  displayName: string
  description: string
  hidden: boolean
  isDefault: boolean
  defaultReasoningEffort: string
  supportedReasoningEfforts: { reasoningEffort: string; description: string }[]
}

export type Feature = {
  name: string
  stage: string
  displayName?: string | null
  description?: string | null
  enabled: boolean
  defaultEnabled: boolean
}

export type SkillScope = 'user' | 'repo' | 'system' | 'admin'

export type Skill = {
  name: string
  description: string
  shortDescription?: string | null
  path: string
  scope: SkillScope
  enabled: boolean
}

export type Skills = { cwd: string; skills: Skill[]; errors: { path: string; message: string }[] }

export type PluginSummary = {
  id: string
  name: string
  installed: boolean
  enabled: boolean
  version?: string | null
  interface?: { displayName?: string | null; shortDescription?: string | null; category?: string | null } | null
}

export type Marketplace = {
  name: string
  path?: string | null
  interface?: { displayName?: string | null } | null
  plugins: PluginSummary[]
}

export type Plugins = {
  marketplaces: Marketplace[]
  marketplaceLoadErrors?: { marketplacePath: string; message: string }[]
}

export class ApiError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(sentence(message))
    this.status = status
  }
}

// The server sends Go-style errors, which start in lowercase and have no period.
function sentence(message: string) {
  const text = message.charAt(0).toUpperCase() + message.slice(1)
  return /[.!?`]$/.test(text) ? text : `${text}.`
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: { 'X-Codexed': '1', 'Content-Type': 'application/json' },
  })
  if (!res.ok) {
    const body = await res.json().catch(() => null)
    throw new ApiError(res.status, body?.error ?? res.statusText)
  }
  if (res.status === 204) return undefined as T
  return res.json()
}

function fileURL({ dir, kind, name, path }: FileRef) {
  const params = new URLSearchParams({ kind })
  if (dir) params.set('dir', dir)
  if (name) params.set('name', name)
  if (path) params.set('path', path)
  return `/api/files?${params}`
}

function scopeQuery(dir: string) {
  return dir ? `?${new URLSearchParams({ dir })}` : ''
}

function post<T>(path: string, body: object) {
  return request<T>(path, { method: 'POST', body: JSON.stringify(body) })
}

export const api = {
  addProject: (path: string) => post<Project>('/api/projects', { path }),
  // Opens the system folder dialog. The path is empty when it is canceled.
  pickFolder: () => request<{ path: string }>('/api/pick-folder', { method: 'POST' }),
  removeProject: (path: string) =>
    request<void>(`/api/projects?${new URLSearchParams({ path })}`, { method: 'DELETE' }),
  saveFile: (ref: FileRef, content: string, version: string) =>
    request<ConfigFile>(fileURL(ref), { method: 'PUT', body: JSON.stringify({ content, version }) }),
  editConfig: (dir: string, version: string, edits: Edit[]) =>
    request<ConfigFile>(`/api/config${scopeQuery(dir)}`, { method: 'PATCH', body: JSON.stringify({ version, edits }) }),
  enableSkill: (path: string, enabled: boolean) =>
    request<void>('/api/skills/enabled', { method: 'PUT', body: JSON.stringify({ path, enabled }) }),
  installPlugin: (pluginName: string, marketplacePath?: string | null) =>
    post<void>('/api/plugins/install', { pluginName, marketplacePath: marketplacePath ?? '' }),
  uninstallPlugin: (pluginId: string) => post<void>('/api/plugins/uninstall', { pluginId }),
  addMarketplace: (source: string, refName = '') => post<void>('/api/marketplaces', { source, refName }),
  removeMarketplace: (name: string) =>
    request<void>(`/api/marketplaces?${new URLSearchParams({ name })}`, { method: 'DELETE' }),
  upgradeMarketplace: (name = '') => post<void>('/api/marketplaces/upgrade', { name }),
}

export const queries = {
  health: () =>
    queryOptions({
      queryKey: ['health'],
      queryFn: () => request<Health>('/api/health'),
      staleTime: 60_000,
    }),
  projects: () =>
    queryOptions({
      queryKey: ['projects'],
      queryFn: () => request<Project[]>('/api/projects'),
    }),
  file: (ref: FileRef) =>
    queryOptions({
      queryKey: ['file', ref.dir, ref.kind, ref.path ?? ref.name ?? ''],
      queryFn: () => request<ConfigFile>(fileURL(ref)),
    }),
  schema: () =>
    queryOptions({
      queryKey: ['schema'],
      queryFn: () => request<ConfigSchema>('/api/schema'),
      // Asks again while the schema of the installed Codex is still loading.
      refetchInterval: (query) => (query.state.data && !query.state.data.matches ? 5_000 : false),
      staleTime: 60_000,
    }),
  models: () =>
    queryOptions({
      queryKey: ['models'],
      queryFn: () => request<Model[]>('/api/models'),
      staleTime: 5 * 60_000,
    }),
  features: () =>
    queryOptions({
      queryKey: ['features'],
      queryFn: () => request<Feature[]>('/api/features'),
      staleTime: 5 * 60_000,
    }),
  skills: (dir: string) =>
    queryOptions({
      queryKey: ['skills', dir],
      queryFn: () => request<Skills>(`/api/skills${scopeQuery(dir)}`),
    }),
  plugins: (dir: string) =>
    queryOptions({
      queryKey: ['plugins', dir],
      queryFn: () => request<Plugins>(`/api/plugins${scopeQuery(dir)}`),
    }),
}

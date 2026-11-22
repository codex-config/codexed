import { useQuery } from '@tanstack/react-query'
import { Plus, Server } from 'lucide-react'
import { useState } from 'react'
import { createPortal } from 'react-dom'

import { EmptyState } from '@/components/empty-state'
import { FormChoice, FormRow } from '@/components/form-row'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { queries, type ConfigFile } from '@/lib/api'
import { navigate } from '@/lib/location'
import { isPlainObject, parseConfig, setPath, useUpdateConfig, type Config } from '@/lib/settings'
import { cn } from '@/lib/ui'
import { ListControl, MapControl } from '@/settings/controls'
import { Problem } from '@/settings/settings-form'

// A server from the mcp_servers table. Global ones show in a project, but you edit
// them in the global view.
type Entry = { name: string; config: Config; global: boolean }

const namePattern = /^[A-Za-z0-9_-]+$/

function serversOf(file: ConfigFile | undefined, global: boolean): Entry[] | string {
  if (!file) return []
  const parsed = parseConfig(file)
  if ('error' in parsed) return parsed.error
  const table = isPlainObject(parsed.config.mcp_servers) ? parsed.config.mcp_servers : {}
  return Object.entries(table)
    .filter(([, config]) => isPlainObject(config))
    .map(([name, config]) => ({ name, config: config as Config, global }))
}

export function MCPPanel({ dir, actions }: { dir: string; actions: Element | null }) {
  const own = useQuery(queries.file({ dir, kind: 'config' }))
  const globalFile = useQuery({ ...queries.file({ dir: '', kind: 'config' }), enabled: dir !== '' })
  const [selected, setSelected] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)

  if (own.isPending || (dir && globalFile.isPending)) return <Skeleton className="h-64" />
  if (own.isError || globalFile.isError) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Could not load MCP servers</AlertTitle>
        <AlertDescription>{(own.error ?? globalFile.error)?.message}</AlertDescription>
      </Alert>
    )
  }
  const ownServers = serversOf(own.data, false)
  const globalServers = dir ? serversOf(globalFile.data, true) : []
  if (typeof ownServers === 'string') {
    return <Problem title="This config is not valid TOML" description={`${ownServers}. Fix it in the TOML view of Configuration.`} />
  }
  const inherited = typeof globalServers === 'string' ? [] : globalServers
  const all = [...ownServers, ...inherited]
  const current = creating ? undefined : (all.find((entry) => entryKey(entry) === selected) ?? all[0])

  if (all.length === 0 && !creating) {
    return (
      <EmptyState icon={<Server />} title="No MCP servers">
        <div className="flex flex-col items-center gap-4">
          MCP servers give Codex tools, such as a database or an issue tracker.
          <Button onClick={() => setCreating(true)}>
            <Plus />
            Add a server
          </Button>
        </div>
      </EmptyState>
    )
  }

  return (
    <div className="flex h-full min-h-0 gap-6">
      <aside className="flex min-h-0 w-72 shrink-0 flex-col gap-3">
        <div className="flex items-center justify-between gap-2 px-3">
          <span className="text-xs font-bold tracking-wider text-dim uppercase">{dir ? 'This project' : 'Servers'}</span>
          <Button
            size="icon"
            variant="outline"
            className="shrink-0"
            title="New server"
            aria-label="New server"
            onClick={() => setCreating(true)}
          >
            <Plus />
          </Button>
        </div>
        <div className="-mx-1 min-h-0 flex-1 overflow-y-auto px-1">
          <ServerList entries={ownServers} current={current} onOpen={open} empty="None yet." />
          {inherited.length > 0 && (
            <>
              <h3 className="mt-4 px-3 pb-2 text-xs font-bold tracking-wider text-dim uppercase">Global</h3>
              <ServerList entries={inherited} current={current} onOpen={open} />
            </>
          )}
        </div>
      </aside>
      <section className="min-h-0 min-w-0 flex-1 overflow-y-auto rounded-lg">
        <ServerForm
          key={creating ? 'new' : current && entryKey(current)}
          dir={dir}
          actions={actions}
          entry={current}
          taken={ownServers.map((entry) => entry.name)}
          onSaved={(name) => {
            setCreating(false)
            setSelected(entryKey({ name, global: false }))
          }}
          onCancel={() => setCreating(false)}
          onDeleted={() => setSelected(null)}
        />
      </section>
    </div>
  )

  function open(entry: Entry) {
    setCreating(false)
    setSelected(entryKey(entry))
  }
}

function entryKey(entry: { name: string; global: boolean }) {
  return `${entry.global ? 'global' : 'own'}:${entry.name}`
}

function ServerList({
  entries,
  current,
  onOpen,
  empty,
}: {
  entries: Entry[]
  current?: Entry
  onOpen: (entry: Entry) => void
  empty?: string
}) {
  if (entries.length === 0) return empty ? <p className="px-3 py-2 text-sm text-muted-foreground">{empty}</p> : null
  return (
    <ul className="flex flex-col gap-1">
      {entries.map((entry) => {
        const active = current !== undefined && entryKey(current) === entryKey(entry)
        const off = entry.config.enabled === false
        return (
          <li key={entryKey(entry)}>
            <button
              type="button"
              onClick={() => onOpen(entry)}
              aria-current={active}
              className={cn(
                'flex w-full items-center gap-3 rounded-2xl px-3 py-2 text-left transition-all hover:bg-muted/60',
                active && 'bg-card shadow-panel hover:bg-card',
              )}
            >
              <span className={cn('min-w-0 flex-1 truncate font-medium', off && 'text-muted-foreground')}>{entry.name}</span>
              <Badge variant="outline" className="shrink-0">
                {off ? 'Off' : 'url' in entry.config ? 'URL' : 'Command'}
              </Badge>
            </button>
          </li>
        )
      })}
    </ul>
  )
}

type Kind = 'command' | 'url'

// The keys of the form. Other keys in the table, such as timeouts, stay as they are.
const formKeys = ['command', 'args', 'env', 'url', 'bearer_token_env_var']

function ServerForm({
  dir,
  actions,
  entry,
  taken,
  onSaved,
  onCancel,
  onDeleted,
}: {
  dir: string
  actions: Element | null
  entry?: Entry
  taken: string[]
  onSaved: (name: string) => void
  onCancel: () => void
  onDeleted: () => void
}) {
  const update = useUpdateConfig(dir)
  const config = entry?.config ?? {}
  const [name, setName] = useState(entry?.name ?? '')
  const [kind, setKind] = useState<Kind>('url' in config ? 'url' : 'command')
  const [command, setCommand] = useState(typeof config.command === 'string' ? config.command : '')
  const [args, setArgs] = useState<string[]>(strings(config.args))
  const [env, setEnv] = useState<Record<string, string>>(stringMap(config.env))
  const [url, setURL] = useState(typeof config.url === 'string' ? config.url : '')
  const [token, setToken] = useState(typeof config.bearer_token_env_var === 'string' ? config.bearer_token_env_var : '')

  if (entry?.global) {
    return (
      <div className="flex flex-col gap-4">
        <h2 className="font-heading text-lg font-semibold">{entry.name}</h2>
        <div className="rounded-3xl bg-card px-5 py-4 text-sm shadow-panel">
          <p className="text-muted-foreground">This server is in your global config, so Codex uses it in every project.</p>
          <Button className="mt-4" variant="outline" size="sm" onClick={() => navigate({ dir: '' })}>
            Edit it in the global view
          </Button>
        </div>
      </div>
    )
  }

  const initial = {
    name: entry?.name ?? '',
    kind: 'url' in config ? 'url' : 'command',
    command: typeof config.command === 'string' ? config.command : '',
    args: strings(config.args),
    env: stringMap(config.env),
    url: typeof config.url === 'string' ? config.url : '',
    token: typeof config.bearer_token_env_var === 'string' ? config.bearer_token_env_var : '',
  }
  const dirty = !entry || JSON.stringify(initial) !== JSON.stringify({ name, kind, command, args, env, url, token })
  const nameError = name !== '' && !namePattern.test(name)
  const duplicate = name !== entry?.name && taken.includes(name)
  const complete = kind === 'command' ? command.trim() !== '' : /^https?:\/\//.test(url.trim())
  const canSave = name !== '' && !nameError && !duplicate && complete && !update.isPending

  function save() {
    update.mutate(
      (next) => {
        const servers = isPlainObject(next.mcp_servers) ? next.mcp_servers : {}
        const server: Config = isPlainObject(servers[entry?.name ?? name]) ? { ...(servers[entry?.name ?? name] as Config) } : {}
        for (const key of formKeys) delete server[key]
        if (kind === 'command') {
          server.command = command.trim()
          if (args.length > 0) server.args = args
          if (Object.keys(env).length > 0) server.env = env
        } else {
          server.url = url.trim()
          if (token.trim()) server.bearer_token_env_var = token.trim()
        }
        if (entry && entry.name !== name) setPath(next, ['mcp_servers', entry.name], undefined)
        setPath(next, ['mcp_servers', name], server)
      },
      { onSuccess: () => onSaved(name) },
    )
  }

  function remove() {
    if (!entry || !window.confirm(`Remove the MCP server ${entry.name}?`)) return
    update.mutate((next) => setPath(next, ['mcp_servers', entry.name], undefined), { onSuccess: onDeleted })
  }

  function setEnabled(enabled: boolean) {
    if (!entry) return
    update.mutate((next) => setPath(next, ['mcp_servers', entry.name, 'enabled'], enabled ? undefined : false))
  }

  return (
    <div className="flex flex-col gap-4 pb-8">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="font-heading text-lg font-semibold">{entry ? entry.name : 'New server'}</h2>
        {entry && (
          <label className="ml-auto flex items-center gap-2 text-sm text-muted-foreground">
            {entry.config.enabled === false ? 'Off' : 'On'}
            <Switch
              checked={entry.config.enabled !== false}
              onCheckedChange={setEnabled}
              disabled={update.isPending}
              aria-label={`Use ${entry.name}`}
            />
          </label>
        )}
      </div>
      <div className="divide-y divide-border/60 rounded-3xl bg-card px-5 shadow-panel">
        <FormRow
          label="Name"
          hint={
            nameError
              ? 'Use letters, numbers, hyphens and underscores.'
              : duplicate
                ? 'A server with this name already exists.'
                : 'Codex shows it next to the tools of the server.'
          }
        >
          <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="docs" className="font-mono" autoFocus={!entry} />
        </FormRow>
        <FormRow label="Runs">
          <FormChoice
            value={kind}
            options={[
              { value: 'command', label: 'A command on this computer' },
              { value: 'url', label: 'A server at a URL' },
            ]}
            onChange={(value) => setKind(value as Kind)}
          />
        </FormRow>
        {kind === 'command' ? (
          <>
            <FormRow label="Command">
              <Input value={command} onChange={(event) => setCommand(event.target.value)} placeholder="npx" className="font-mono" />
            </FormRow>
            <FormRow label="Arguments">
              <ListControl items={args} options={[]} onChange={setArgs} label="Arguments" />
            </FormRow>
            <FormRow label="Environment" hint="Variables that the command gets.">
              <MapControl entries={env} onChange={setEnv} label="Environment" />
            </FormRow>
          </>
        ) : (
          <>
            <FormRow label="URL">
              <Input value={url} onChange={(event) => setURL(event.target.value)} placeholder="https://example.com/mcp" className="font-mono" />
            </FormRow>
            <FormRow label="Token variable" hint="The environment variable that holds the bearer token. Codex never stores the token itself.">
              <Input value={token} onChange={(event) => setToken(event.target.value)} placeholder="DOCS_TOKEN" className="font-mono" />
            </FormRow>
          </>
        )}
      </div>
      {entry && (
        <Button variant="ghost" size="sm" className="self-start text-destructive" onClick={remove}>
          Remove server
        </Button>
      )}
      {actions &&
        dirty &&
        createPortal(
          <>
            {!entry && (
              <Button variant="ghost" size="sm" onClick={onCancel}>
                Cancel
              </Button>
            )}
            <Button size="sm" disabled={!canSave} onClick={save}>
              {update.isPending ? 'Saving…' : entry ? 'Save' : 'Add'}
            </Button>
          </>,
          actions,
        )}
    </div>
  )
}

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
}

function stringMap(value: unknown): Record<string, string> {
  if (!isPlainObject(value)) return {}
  return Object.fromEntries(Object.entries(value).filter((entry): entry is [string, string] => typeof entry[1] === 'string'))
}

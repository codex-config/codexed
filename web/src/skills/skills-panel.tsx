import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Sparkles } from 'lucide-react'
import { useState } from 'react'

import { EmptyState } from '@/components/empty-state'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { FileEditor } from '@/files/file-editor'
import { api, queries, type FileRef, type Skill } from '@/lib/api'
import { confirmDiscard, fileKey, shortPath } from '@/lib/location'
import { notify } from '@/lib/notify'
import { cn } from '@/lib/ui'
import { NewSkillForm } from '@/skills/new-skill-form'

// ref is missing for the skills that Codex brings along, which you can only turn off.
type Entry = Skill & { ref?: FileRef }

export function SkillsPanel({ dir, actions }: { dir: string; actions: Element | null }) {
  const client = useQueryClient()
  const skills = useQuery(queries.skills(dir))
  const health = useQuery(queries.health())
  const [selected, setSelected] = useState<string | null>(null)
  const [filter, setFilter] = useState('')
  const [creating, setCreating] = useState(false)

  const toggle = useMutation({
    mutationFn: ({ path, enabled }: { path: string; enabled: boolean }) => api.enableSkill(path, enabled),
    onSuccess: () => client.invalidateQueries({ queryKey: ['skills'] }),
    onError: (error) => notify.error('Could not change the skill', error.message),
  })

  if (skills.isPending || health.isPending) return <Skeleton className="h-64" />
  if (skills.isError || health.isError) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Could not load skills</AlertTitle>
        <AlertDescription>{(skills.error ?? health.error)?.message}</AlertDescription>
      </Alert>
    )
  }

  const home = health.data.home
  const entries: Entry[] = skills.data.skills.map((skill) => ({ ...skill, ref: refOf(skill, dir) }))
  const project = entries.filter((entry) => entry.scope === 'repo')
  const yours = entries.filter((entry) => entry.scope === 'user')
  const builtIn = entries.filter((entry) => entry.scope === 'system' || entry.scope === 'admin')
  const current = entries.find((entry) => entry.path === selected) ?? (dir ? project[0] : yours[0]) ?? entries[0]

  function select(entry: Entry) {
    if (current?.ref && !confirmDiscard([fileKey(current.ref)])) return
    setCreating(false)
    setSelected(entry.path)
  }

  const query = filter.trim().toLowerCase()
  const matches = (entry: Entry) =>
    !query || entry.name.toLowerCase().includes(query) || entry.description.toLowerCase().includes(query)

  const groups = [
    ...(dir ? [{ label: 'This project', entries: project, empty: 'No skills in this project yet.' }] : []),
    { label: 'Your skills', entries: yours, empty: 'No skills of your own yet.' },
    { label: 'Built in', entries: builtIn, empty: '' },
  ].filter((group) => group.entries.length > 0 || group.empty)

  return (
    <div className="flex h-full min-h-0 gap-6">
      <aside className="flex min-h-0 w-80 shrink-0 flex-col gap-3">
        <div className="flex gap-2">
          <Input
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            placeholder="Filter skills"
            aria-label="Filter skills"
          />
          <Button
            size="icon"
            variant="outline"
            className="shrink-0"
            title="New skill"
            aria-label="New skill"
            onClick={() => setCreating(true)}
          >
            <Plus />
          </Button>
        </div>
        <div className="-mx-1 min-h-0 flex-1 overflow-y-auto px-1">
          {groups.map((group, index) => (
            <div key={group.label}>
              <GroupLabel className={cn(index > 0 && 'mt-4')}>{group.label}</GroupLabel>
              <SkillList entries={group.entries.filter(matches)} empty={group.empty} current={current} onSelect={select} />
            </div>
          ))}
          {skills.data.errors.length > 0 && (
            <Alert variant="destructive" className="mt-4">
              <AlertTitle>Some skills did not load</AlertTitle>
              <AlertDescription>
                {skills.data.errors.map((error) => (
                  <p key={error.path}>
                    <span className="font-mono">{shortPath(error.path, health.data.home)}</span>: {error.message}
                  </p>
                ))}
              </AlertDescription>
            </Alert>
          )}
        </div>
      </aside>

      <section className="flex min-h-0 min-w-0 flex-1 flex-col gap-4">
        {creating ? (
          <NewSkillForm
            dir={dir}
            actions={actions}
            onCreated={(name, created) => {
              setCreating(false)
              setSelected(`${created || home}/.agents/skills/${name}/SKILL.md`)
            }}
            onCancel={() => setCreating(false)}
          />
        ) : current ? (
          <>
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="font-heading text-lg font-semibold">${current.name}</h2>
              {current.scope !== 'repo' && current.scope !== 'user' && <Badge variant="outline">Built in</Badge>}
              <label className="ml-auto flex items-center gap-2 text-sm text-muted-foreground">
                {current.enabled ? 'On' : 'Off'}
                <Switch
                  checked={current.enabled}
                  disabled={toggle.isPending}
                  onCheckedChange={(enabled) => toggle.mutate({ path: current.path, enabled })}
                  aria-label={`Use ${current.name}`}
                />
              </label>
            </div>
            {current.ref ? (
              <div className="min-h-0 flex-1">
                <FileEditor key={current.path} {...current.ref} toolbar={actions} />
              </div>
            ) : (
              <div className="rounded-3xl bg-card px-5 py-4 text-sm shadow-panel">
                <p>{current.description}</p>
                <p className="mt-3 font-mono text-xs text-muted-foreground">{shortPath(current.path, health.data.home)}</p>
                <p className="mt-3 text-muted-foreground">Codex brings this skill along. You can turn it off, but not edit it.</p>
              </div>
            )}
          </>
        ) : (
          <EmptyState icon={<Sparkles />} title="No skills yet">
            <Button onClick={() => setCreating(true)}>
              <Plus />
              Add a skill
            </Button>
          </EmptyState>
        )}
      </section>
    </div>
  )
}

function SkillList({
  entries,
  empty,
  current,
  onSelect,
}: {
  entries: Entry[]
  empty: string
  current?: Entry
  onSelect: (entry: Entry) => void
}) {
  if (entries.length === 0) {
    return empty ? <p className="px-3 py-2 text-sm text-muted-foreground">{empty}</p> : null
  }
  return (
    <ul className="flex flex-col gap-1">
      {entries.map((entry) => {
        const active = current?.path === entry.path
        return (
          <li key={entry.path}>
            <button
              type="button"
              onClick={() => onSelect(entry)}
              aria-current={active}
              className={cn(
                'flex w-full items-center gap-3 rounded-2xl px-3 py-2 text-left transition-all hover:bg-muted/60',
                active && 'bg-card shadow-panel hover:bg-card',
              )}
            >
              <span className={cn('min-w-0 flex-1 truncate font-medium', !entry.enabled && 'text-muted-foreground')}>
                {entry.name}
              </span>
              {!entry.enabled && (
                <Badge variant="outline" className="shrink-0">
                  Off
                </Badge>
              )}
            </button>
          </li>
        )
      })}
    </ul>
  )
}

function GroupLabel({ className, children }: { className?: string; children: string }) {
  return <h3 className={cn('px-3 pb-2 text-xs font-bold tracking-wider text-dim uppercase', className)}>{children}</h3>
}

// Your skills and the skills of a project can be edited. Codex brings the others along.
function refOf(skill: Skill, dir: string): FileRef | undefined {
  if (skill.scope === 'user') return { dir: '', kind: 'skill', path: skill.path }
  if (skill.scope === 'repo' && dir) return { dir, kind: 'skill', path: skill.path }
  return undefined
}

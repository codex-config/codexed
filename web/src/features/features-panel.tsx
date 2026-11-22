import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { queries, type Feature } from '@/lib/api'
import { isPlainObject, parseConfig, setPath, useUpdateConfig } from '@/lib/settings'
import { Problem } from '@/settings/settings-form'

// The feature flags of Codex, as listed by the installed version. Removed flags only
// keep old files loading, so they are not shown.
const stages = [
  { stage: 'stable', title: 'Stable', description: 'Ready for everyday use.' },
  { stage: 'beta', title: 'Beta', description: 'Ready to try. Codex asks for feedback on these.' },
  { stage: 'underDevelopment', title: 'Under development', description: 'Not ready for broad use yet.' },
  { stage: 'deprecated', title: 'Deprecated', description: 'These are going away. Avoid them.' },
]

export function FeaturesPanel({ dir }: { dir: string }) {
  const features = useQuery(queries.features())
  const file = useQuery(queries.file({ dir, kind: 'config' }))
  const update = useUpdateConfig(dir)
  const [filter, setFilter] = useState('')

  if (features.isPending || file.isPending) return <Skeleton className="h-64" />
  if (features.isError || file.isError) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Could not load the features</AlertTitle>
        <AlertDescription>{(features.error ?? file.error)?.message}</AlertDescription>
      </Alert>
    )
  }
  const parsed = parseConfig(file.data)
  if ('error' in parsed) {
    return <Problem title="This config is not valid TOML" description={`${parsed.error}. Fix it in the TOML view of Configuration.`} />
  }
  const set = isPlainObject(parsed.config.features) ? parsed.config.features : {}

  const query = filter.trim().toLowerCase()
  const matches = (feature: Feature) =>
    !query ||
    feature.name.toLowerCase().includes(query) ||
    (feature.displayName ?? '').toLowerCase().includes(query) ||
    (feature.description ?? '').toLowerCase().includes(query)

  function change(name: string, value: boolean | undefined) {
    update.mutate((config) => setPath(config, ['features', name], value))
  }

  return (
    <div className="flex flex-col gap-8 pb-8">
      <Input
        value={filter}
        onChange={(event) => setFilter(event.target.value)}
        placeholder="Filter features"
        aria-label="Filter features"
        className="max-w-sm"
      />
      {stages.map(({ stage, title, description }) => {
        const list = features.data.filter((feature) => feature.stage === stage && matches(feature))
        if (list.length === 0) return null
        return (
          <section key={stage} className="flex flex-col gap-3">
            <div className="flex flex-col gap-1 px-1">
              <h2 className="text-xs font-bold tracking-wider text-dim uppercase">{title}</h2>
              <p className="text-sm text-muted-foreground">{description}</p>
            </div>
            <div className="divide-y divide-border/60 rounded-3xl bg-card px-5 shadow-panel">
              {list.map((feature) => (
                <FeatureRow
                  key={feature.name}
                  feature={feature}
                  value={typeof set[feature.name] === 'boolean' ? (set[feature.name] as boolean) : undefined}
                  inherited={dir ? feature.enabled : feature.defaultEnabled}
                  project={dir !== ''}
                  onChange={(value) => change(feature.name, value)}
                />
              ))}
            </div>
          </section>
        )
      })}
    </div>
  )
}

function FeatureRow({
  feature,
  value,
  inherited,
  project,
  onChange,
}: {
  feature: Feature
  value: boolean | undefined
  // What Codex uses without this file: the default, or in a project the global choice.
  inherited: boolean
  project: boolean
  onChange: (value: boolean | undefined) => void
}) {
  return (
    <div className="group/row flex items-start gap-6 py-4">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          {feature.displayName && <span className="font-medium">{feature.displayName}</span>}
          <code className={feature.displayName ? 'font-mono text-xs text-muted-foreground' : 'font-mono text-sm font-medium'}>
            {feature.name}
          </code>
          {value !== undefined && (
            <button
              type="button"
              onClick={() => onChange(undefined)}
              className="text-xs font-medium text-muted-foreground opacity-0 transition-opacity group-hover/row:opacity-100 hover:text-destructive focus-visible:opacity-100"
            >
              Remove
            </button>
          )}
        </div>
        {feature.description && <p className="mt-1 text-sm text-muted-foreground">{feature.description}</p>}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {value === undefined && <span className="text-xs text-muted-foreground">{project ? 'Inherit' : 'Default'}</span>}
        <Switch checked={value ?? inherited} onCheckedChange={(checked) => onChange(checked)} aria-label={feature.name} />
      </div>
    </div>
  )
}

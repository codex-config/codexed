import { useQuery } from '@tanstack/react-query'
import { useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

import { Alert, AlertAction, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { queries, type JSONSchema, type Model } from '@/lib/api'
import { parseConfig, setPath, useUpdateConfig } from '@/lib/settings'
import { SettingRow } from '@/settings/controls'
import { isExperimental, isInternal } from '@/settings/fields'
import { SuggestionsButton } from '@/settings/suggestions-sheet'

// Other sections edit these, and Codex keeps notice for itself.
const hidden = new Set(['mcp_servers', 'features', 'skills', 'plugins', 'marketplaces', 'projects', 'notice'])

// Settings that name a model or an effort suggest what the models of Codex support.
const modelKeys = new Set(['model', 'review_model'])
const effortKeys = new Set(['model_reasoning_effort', 'plan_mode_reasoning_effort'])

// toolbar is where the search field goes. null hides it.
type Props = { dir: string; toolbar: Element | null; onShowTOML: () => void }

export function SettingsForm({ dir, toolbar, onShowTOML }: Props) {
  const schema = useQuery(queries.schema())
  const file = useQuery(queries.file({ dir, kind: 'config' }))
  const models = useQuery(queries.models())
  const update = useUpdateConfig(dir)
  const [search, setSearch] = useState('')
  const [showExperimental, setShowExperimental] = useState(false)

  if (schema.isPending || file.isPending) return <Skeleton className="h-64" />
  if (file.isError) {
    return <Problem title="Could not load the file" description={file.error.message} />
  }
  if (schema.isError) {
    return (
      <Problem
        title="Could not load the list of settings"
        description={`${schema.error.message} You can still edit the file as TOML.`}
        onShowTOML={onShowTOML}
      />
    )
  }

  const parsed = parseConfig(file.data)
  if ('error' in parsed) {
    return (
      <Problem
        title="This file is not valid TOML"
        description={`${parsed.error}. Fix it in the TOML view to use the form.`}
        onShowTOML={onShowTOML}
      />
    )
  }
  const config = parsed.config

  const properties = withModels(schema.data.schema.properties ?? {}, models.data)
  const query = search.trim().toLowerCase()
  const matches = (key: string) =>
    !query ||
    key.toLowerCase().includes(query) ||
    (properties[key]?.description ?? '').toLowerCase().includes(query)

  const inFile = Object.keys(config).filter((key) => !hidden.has(key) && matches(key))
  const available = Object.keys(properties)
    .filter((key) => !hidden.has(key) && !(key in config) && !isInternal(properties[key]) && matches(key))
    .sort((a, b) => a.localeCompare(b))
  const others = available.filter((key) => !isExperimental(key, properties[key]))
  const experimental = available.filter((key) => isExperimental(key, properties[key]))

  function change(path: string[], value: unknown) {
    update.mutate((current) => setPath(current, path, value))
  }

  const rows = (keys: string[]) =>
    keys.map((key) => (
      <SettingRow key={key} path={[key]} schema={properties[key]} value={config[key]} onChange={change} />
    ))

  return (
    <div className="flex flex-col gap-8 pb-8">
      {toolbar &&
        createPortal(
          <>
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search settings"
              aria-label="Search settings"
              className="max-w-sm"
            />
            {/* Suggestions are for how Codex behaves everywhere, so only the global config has them. */}
            {dir === '' && <SuggestionsButton config={config} schema={schema.data.schema} />}
          </>,
          toolbar,
        )}

      {/* Titles only help when both groups have settings. */}
      {inFile.length > 0 && others.length > 0 ? (
        <>
          <Section title="In this file" count={inFile.length}>
            {rows(inFile)}
          </Section>
          <Section title="More settings">{rows(others)}</Section>
        </>
      ) : (
        inFile.length + others.length > 0 && <Section>{rows([...inFile, ...others])}</Section>
      )}
      {experimental.length > 0 && (
        <Section
          title="Experimental settings"
          description="Codex may change or remove these settings in any version."
          action={
            !query && (
              <Button variant="ghost" size="sm" onClick={() => setShowExperimental(!showExperimental)}>
                {showExperimental ? 'Hide' : `Show ${experimental.length}`}
              </Button>
            )
          }
        >
          {(showExperimental || query) && rows(experimental)}
        </Section>
      )}
      {inFile.length === 0 && available.length === 0 && (
        <p className="py-8 text-center text-sm text-muted-foreground">No settings match your search.</p>
      )}
    </div>
  )
}

// The form turns a list of strings into suggestions, and still accepts any name.
function withModels(properties: Record<string, JSONSchema>, models: Model[] | undefined) {
  const shown = (models ?? []).filter((model) => !model.hidden)
  const names = shown.map((model) => model.model)
  const efforts = [...new Set(shown.flatMap((model) => model.supportedReasoningEfforts.map((each) => each.reasoningEffort)))]
  const result = { ...properties }
  const suggest = (keys: Set<string>, values: string[]) => {
    for (const key of keys) {
      if (!result[key] || values.length === 0 || result[key].enum) continue
      result[key] = { ...result[key], type: undefined, anyOf: [{ type: 'string', enum: values }, { type: 'string' }] }
    }
  }
  suggest(modelKeys, names)
  suggest(effortKeys, efforts)
  return result
}

function Section({
  title,
  count,
  description,
  action,
  children,
}: {
  title?: string
  count?: number
  description?: string
  action?: ReactNode
  children?: ReactNode
}) {
  return (
    <section className="flex flex-col gap-3">
      {title && (
        <div className="flex flex-wrap items-center gap-2 px-1">
          <h2 className="text-xs font-bold tracking-wider text-dim uppercase">{title}</h2>
          {count !== undefined && (
            <span className="rounded-full bg-primary/15 px-1.5 text-[11px] leading-4 font-semibold text-link tabular-nums">
              {count}
            </span>
          )}
          {action}
        </div>
      )}
      {description && <p className="px-1 text-sm text-muted-foreground">{description}</p>}
      {children && <div className="divide-y divide-border/60 rounded-3xl bg-card px-5 shadow-panel">{children}</div>}
    </section>
  )
}

export function Problem({
  title,
  description,
  onShowTOML,
}: {
  title: string
  description: string
  onShowTOML?: () => void
}) {
  return (
    <Alert variant="destructive">
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription>{description}</AlertDescription>
      {onShowTOML && (
        <AlertAction>
          <Button size="sm" variant="outline" onClick={onShowTOML}>
            Edit as TOML
          </Button>
        </AlertAction>
      )}
    </Alert>
  )
}

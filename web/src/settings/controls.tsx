import { X } from 'lucide-react'
import { useEffect, useId, useRef, useState, type ComponentProps, type KeyboardEvent } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import type { JSONSchema } from '@/lib/api'
import { isPlainObject } from '@/lib/settings'
import { cn } from '@/lib/ui'
import { defaultOf, fieldOf, fits, isDeprecated, isInternal, type Field } from '@/settings/fields'

// undefined removes the setting from the file.
export type Change = (path: string[], value: unknown) => void

type RowProps = {
  path: string[]
  schema?: JSONSchema
  value: unknown
  onChange: Change
  disabled?: boolean
}

export function SettingRow({ path, schema, value, onChange, disabled }: RowProps) {
  const [expanded, setExpanded] = useState(false)
  const name = path[path.length - 1]
  const declared = fieldOf(schema)
  const field: Field = fits(declared, value) ? declared : { kind: 'json' }
  const set = (next: unknown) => onChange(path, next)

  // Unset settings take one line. Larger editors open on demand or when there is a value.
  const collapsible = field.kind === 'json' || field.kind === 'object' || field.kind === 'map'
  const open = value !== undefined || expanded
  const block = collapsible ? open : field.kind === 'list' && Array.isArray(value) && value.length > 0

  const control = collapsible && !open ? (
    <Button variant="outline" size="sm" disabled={disabled} onClick={() => setExpanded(true)}>
      {field.kind === 'object'
        ? `Show ${visibleProperties(field.properties, {}).length} settings`
        : field.kind === 'map'
          ? 'Add entry'
          : 'Edit JSON'}
    </Button>
  ) : (
    <Control
      field={field}
      name={name}
      schema={schema}
      value={value}
      path={path}
      set={set}
      onChange={onChange}
      disabled={disabled}
    />
  )

  return (
    <div className="py-4">
      {/* The hover group covers only this row's header, so nested rows don't show their parent's link. */}
      <div className="group/head flex items-start gap-6">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {/* Top-level settings are already grouped by whether they are set. */}
            {value !== undefined && path.length > 1 && (
              <span aria-label="Set in this file" className="size-1.5 shrink-0 rounded-full bg-primary" />
            )}
            <code className="font-mono text-sm font-medium break-all">{name}</code>
            {!schema && <Badge variant="outline">Unknown</Badge>}
            {isDeprecated(schema) && <Badge variant="outline">Deprecated</Badge>}
            {value !== undefined && (
              <button
                type="button"
                title="Remove from this file, so that Codex uses its default"
                aria-label={`Remove ${name} from this file`}
                disabled={disabled}
                onClick={() => set(undefined)}
                className="text-xs font-medium text-muted-foreground opacity-0 transition-opacity group-hover/head:opacity-100 hover:text-destructive focus-visible:opacity-100"
              >
                Remove
              </button>
            )}
          </div>
          {schema?.description && <Description text={schema.description} />}
        </div>
        {!block && <div className="flex w-64 shrink-0 justify-end">{control}</div>}
      </div>
      {block && <div className="mt-3">{control}</div>}
    </div>
  )
}

// Shows three lines, and a toggle only when the text is cut off at the current width.
function Description({ text }: { text: string }) {
  const ref = useRef<HTMLParagraphElement>(null)
  const [expanded, setExpanded] = useState(false)
  const [clipped, setClipped] = useState(false)

  useEffect(() => {
    const element = ref.current
    if (!element || expanded) return
    const observer = new ResizeObserver(() => setClipped(element.scrollHeight > element.clientHeight + 1))
    observer.observe(element)
    return () => observer.disconnect()
  }, [expanded])

  return (
    <>
      <p ref={ref} className={cn('mt-1 text-sm text-muted-foreground', !expanded && 'line-clamp-3')}>
        {text}
      </p>
      {(clipped || expanded) && (
        <button
          type="button"
          className="mt-1 text-xs font-medium text-link hover:underline"
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? 'Show less' : 'Show more'}
        </button>
      )}
    </>
  )
}

type ControlProps = {
  field: Field
  name: string
  schema?: JSONSchema
  value: unknown
  path: string[]
  set: (value: unknown) => void
  onChange: Change
  disabled?: boolean
}

function Control({ field, name, schema, value, path, set, onChange, disabled }: ControlProps) {
  switch (field.kind) {
    case 'boolean': {
      const fallback = defaultOf(schema)
      return (
        <div className="flex items-center gap-2">
          {value === undefined && (
            <span className="text-xs text-muted-foreground">
              {fallback === undefined ? 'Not set' : 'Default'}
            </span>
          )}
          <Switch
            checked={(value ?? fallback ?? false) as boolean}
            onCheckedChange={(checked) => set(checked)}
            disabled={disabled}
            aria-label={name}
          />
        </div>
      )
    }
    case 'enum':
      return (
        <OptionSelect
          options={field.options}
          value={value as string | undefined}
          onSelect={set}
          label={name}
          disabled={disabled}
        />
      )
    case 'string':
      return (
        <DraftInput
          value={(value as string | undefined) ?? ''}
          onCommit={(text) => (text !== '' || value !== undefined) && set(text)}
          suggestions={field.suggestions}
          placeholder="Not set"
          aria-label={name}
          disabled={disabled}
        />
      )
    case 'number':
      return (
        <DraftInput
          type="number"
          step={field.integer ? 1 : 'any'}
          min={field.min}
          max={field.max}
          value={value === undefined ? '' : String(value)}
          onCommit={(text) => {
            const number = Number(text)
            if (text.trim() !== '' && Number.isFinite(number)) set(number)
          }}
          placeholder="Not set"
          aria-label={name}
          disabled={disabled}
        />
      )
    case 'list':
      return (
        <ListControl
          items={(value as string[] | undefined) ?? []}
          options={field.options}
          onChange={set}
          label={name}
          disabled={disabled}
        />
      )
    case 'map':
      return (
        <MapControl
          entries={(value as Record<string, string> | undefined) ?? {}}
          onChange={set}
          label={name}
          disabled={disabled}
          autoFocus
        />
      )
    case 'object':
      return (
        <ObjectControl
          properties={field.properties}
          value={value}
          path={path}
          onChange={onChange}
          disabled={disabled}
        />
      )
    case 'json':
      return <JsonControl value={value} onChange={set} label={name} disabled={disabled} />
  }
}

type DraftInputProps = Omit<ComponentProps<typeof Input>, 'value' | 'onChange'> & {
  value: string
  onCommit: (text: string) => void
  suggestions?: string[]
}

// Saves when the field loses focus or on Enter. Escape restores the saved text.
function DraftInput({ value, onCommit, suggestions = [], ...props }: DraftInputProps) {
  const [draft, setDraft] = useState(value)
  const [saved, setSaved] = useState(value)
  const listId = useId()
  if (value !== saved) {
    setSaved(value)
    setDraft(value)
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter') event.currentTarget.blur()
    if (event.key === 'Escape') setDraft(value)
  }

  return (
    <>
      <Input
        {...props}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => draft !== value && onCommit(draft)}
        onKeyDown={onKeyDown}
        list={suggestions.length > 0 ? listId : undefined}
      />
      {suggestions.length > 0 && (
        <datalist id={listId}>
          {suggestions.map((suggestion) => (
            <option key={suggestion} value={suggestion} />
          ))}
        </datalist>
      )}
    </>
  )
}

function OptionSelect({
  options,
  value,
  onSelect,
  label,
  placeholder = 'Not set',
  disabled,
}: {
  options: string[]
  value: string | undefined
  onSelect: (value: string) => void
  label: string
  placeholder?: string
  disabled?: boolean
}) {
  return (
    <Select
      items={options.map((option) => ({ value: option, label: option }))}
      value={value ?? null}
      onValueChange={(next) => next !== null && onSelect(next as string)}
      disabled={disabled}
    >
      <SelectTrigger size="sm" className="w-full max-w-64" aria-label={label}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option} value={option}>
            {option}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

export function ListControl({
  items,
  options,
  onChange,
  label,
  disabled,
}: {
  items: string[]
  options: string[]
  onChange: (items: string[]) => void
  label: string
  disabled?: boolean
}) {
  const [adding, setAdding] = useState('')
  const remaining = options.filter((option) => !items.includes(option))

  function add(entry: string) {
    if (entry.trim() === '') return
    onChange([...items, entry.trim()])
    setAdding('')
  }

  return (
    <div className="flex flex-col gap-2">
      {items.map((item, index) => (
        <div key={index} className="flex gap-2">
          <DraftInput
            value={item}
            onCommit={(text) => onChange(items.map((old, i) => (i === index ? text : old)))}
            aria-label={`${label} entry ${index + 1}`}
            className="font-mono"
            disabled={disabled}
          />
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Remove ${item}`}
            disabled={disabled}
            onClick={() => onChange(items.filter((_, i) => i !== index))}
          >
            <X />
          </Button>
        </div>
      ))}
      {options.length > 0 ? (
        remaining.length > 0 && (
          <OptionSelect
            options={remaining}
            value={undefined}
            onSelect={add}
            label={`Add to ${label}`}
            placeholder="Add an entry"
            disabled={disabled}
          />
        )
      ) : (
        <div className="flex gap-2">
          <Input
            value={adding}
            onChange={(event) => setAdding(event.target.value)}
            onKeyDown={(event) => event.key === 'Enter' && add(adding)}
            placeholder="Add an entry"
            aria-label={`Add to ${label}`}
            className="font-mono"
            disabled={disabled}
          />
          <Button variant="outline" size="sm" disabled={disabled || !adding.trim()} onClick={() => add(adding)}>
            Add
          </Button>
        </div>
      )}
    </div>
  )
}

export function MapControl({
  entries,
  onChange,
  label,
  disabled,
  autoFocus,
}: {
  entries: Record<string, string>
  onChange: (entries: Record<string, string>) => void
  label: string
  disabled?: boolean
  autoFocus?: boolean
}) {
  const [key, setKey] = useState('')
  const [value, setValue] = useState('')
  const pairs = Object.entries(entries)

  // Rebuilding the object keeps the order of the keys.
  const rename = (from: string, to: string) =>
    to.trim() !== '' &&
    !(to in entries) &&
    onChange(Object.fromEntries(pairs.map(([k, v]) => (k === from ? [to.trim(), v] : [k, v]))))

  function add() {
    if (key.trim() === '' || key in entries) return
    onChange({ ...entries, [key.trim()]: value })
    setKey('')
    setValue('')
  }

  return (
    <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,2fr)_auto] gap-2">
      {pairs.map(([k, v]) => (
        <div key={k} className="contents">
          <DraftInput
            value={k}
            onCommit={(text) => rename(k, text)}
            aria-label={`${label} name`}
            className="font-mono"
            disabled={disabled}
          />
          <DraftInput
            value={v}
            onCommit={(text) => onChange({ ...entries, [k]: text })}
            aria-label={`${label} ${k}`}
            className="font-mono"
            disabled={disabled}
          />
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Remove ${k}`}
            disabled={disabled}
            onClick={() => onChange(Object.fromEntries(pairs.filter(([other]) => other !== k)))}
          >
            <X />
          </Button>
        </div>
      ))}
      <Input
        value={key}
        onChange={(event) => setKey(event.target.value)}
        onKeyDown={(event) => event.key === 'Enter' && add()}
        placeholder="Name"
        autoFocus={autoFocus && pairs.length === 0}
        aria-label={`New ${label} name`}
        className="font-mono"
        disabled={disabled}
      />
      <Input
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={(event) => event.key === 'Enter' && add()}
        placeholder="Value"
        aria-label={`New ${label} value`}
        className="font-mono"
        disabled={disabled}
      />
      <Button variant="outline" size="sm" disabled={disabled || !key.trim() || key in entries} onClick={add}>
        Add
      </Button>
    </div>
  )
}

function ObjectControl({
  properties,
  value,
  path,
  onChange,
  disabled,
}: {
  properties: [string, JSONSchema][]
  value: unknown
  path: string[]
  onChange: Change
  disabled?: boolean
}) {
  const object = isPlainObject(value) ? value : {}
  const known = new Set(properties.map(([key]) => key))
  const unknown = Object.keys(object).filter((key) => !known.has(key))
  const shown = visibleProperties(properties, object)

  return (
    <div className="divide-y rounded-2xl border px-4">
      {shown.map(([key, schema]) => (
        <SettingRow
          key={key}
          path={[...path, key]}
          schema={schema}
          value={object[key]}
          onChange={onChange}
          disabled={disabled}
        />
      ))}
      {unknown.map((key) => (
        <SettingRow key={key} path={[...path, key]} value={object[key]} onChange={onChange} disabled={disabled} />
      ))}
    </div>
  )
}

// Internal settings are hidden unless the file sets them.
function visibleProperties(properties: [string, JSONSchema][], object: Record<string, unknown>) {
  return properties.filter(([key, schema]) => !isInternal(schema) || key in object)
}

function JsonControl({
  value,
  onChange,
  label,
  disabled,
}: {
  value: unknown
  onChange: (value: unknown) => void
  label: string
  disabled?: boolean
}) {
  const text = value === undefined ? '' : JSON.stringify(value, null, 2)
  const [draft, setDraft] = useState(text)
  const [saved, setSaved] = useState(text)
  const [error, setError] = useState<string | null>(null)
  if (text !== saved) {
    setSaved(text)
    setDraft(text)
    setError(null)
  }

  function commit() {
    if (draft === text) return
    if (draft.trim() === '') {
      onChange(undefined)
      return
    }
    try {
      onChange(JSON.parse(draft))
      setError(null)
    } catch (e) {
      setError((e as Error).message)
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <Textarea
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        placeholder="Enter JSON"
        autoFocus={value === undefined}
        spellCheck={false}
        aria-label={label}
        aria-invalid={!!error}
        disabled={disabled}
        className="max-h-80 font-mono text-sm"
      />
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  )
}

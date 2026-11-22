import { Lightbulb } from 'lucide-react'
import { useState, type ReactNode } from 'react'

import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import type { JSONSchema } from '@/lib/api'
import { notify } from '@/lib/notify'
import { setPath, useUpdateConfig, type Config } from '@/lib/settings'
import { useStoredState } from '@/projects/stored-state'
import {
  applyChanges,
  groups,
  pendingSuggestions,
  valueAt,
  type Change,
  type Suggestion,
} from '@/settings/suggestions'

// A toolbar button that opens suggestions for the global config.toml.
export function SuggestionsButton({ config, schema }: { config: Config; schema: JSONSchema }) {
  const update = useUpdateConfig('')
  const [dismissed, setDismissed] = useStoredState<string[]>('codexed.suggestions.dismissed', [])
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [showDismissed, setShowDismissed] = useState(false)

  const pending = pendingSuggestions(config, schema)
  const open = pending.filter((suggestion) => !dismissed.includes(suggestion.id))
  const hidden = pending.filter((suggestion) => dismissed.includes(suggestion.id))
  if (pending.length === 0) return null

  // Undo puts back the values from just before the change.
  function apply(suggestion: Suggestion) {
    let before: unknown[] = []
    update.mutate(
      (current) => {
        before = suggestion.changes.map((change) => structuredClone(valueAt(current, change.path)))
        applyChanges(current, suggestion.changes)
      },
      {
        onSuccess: () =>
          notify.done(suggestion.title, 'Saved to your global config.', () =>
            update.mutate((current) => suggestion.changes.forEach((change, i) => setPath(current, change.path, before[i]))),
          ),
      },
    )
  }

  const dismiss = (id: string) => setDismissed([...dismissed, id])
  const restore = (id: string) => setDismissed(dismissed.filter((each) => each !== id))

  return (
    <Sheet>
      <SheetTrigger render={<Button variant="outline" size="sm" className="ml-auto shrink-0" />}>
        <Lightbulb data-icon="inline-start" />
        Suggestions
        {open.length > 0 && (
          <span className="rounded-full bg-primary/15 px-1.5 text-[11px] leading-4 font-semibold text-link tabular-nums">
            {open.length}
          </span>
        )}
      </SheetTrigger>
      <SheetContent className="gap-0 data-[side=right]:w-full data-[side=right]:sm:max-w-lg">
        <SheetHeader className="border-b pr-14">
          <SheetTitle>Suggestions</SheetTitle>
          <SheetDescription>
            Changes to your global config.toml that many people make. Each one says what you gain and what you give up.
            Apply saves it right away, after Codex checks the value.
          </SheetDescription>
        </SheetHeader>

        <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto p-6">
          {groups.map((group) => {
            const items = open.filter((suggestion) => suggestion.group === group.id)
            if (items.length === 0) return null
            const collapsed = group.id === 'advanced' && !showAdvanced
            return (
              <Group
                key={group.id}
                title={group.label}
                action={
                  group.id === 'advanced' && (
                    <Button variant="ghost" size="xs" onClick={() => setShowAdvanced(!showAdvanced)}>
                      {showAdvanced ? 'Hide' : 'Show'}
                    </Button>
                  )
                }
              >
                {!collapsed &&
                  items.map((suggestion) => (
                    <Item key={suggestion.id} suggestion={suggestion} config={config}>
                      <Button size="sm" disabled={update.isPending} onClick={() => apply(suggestion)}>
                        Apply
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => dismiss(suggestion.id)}>
                        Dismiss
                      </Button>
                    </Item>
                  ))}
              </Group>
            )
          })}

          {open.length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Nothing more to suggest. Your config already has every change, or you dismissed it.
            </p>
          )}

          {hidden.length > 0 && (
            <Group
              title="Dismissed"
              action={
                <Button variant="ghost" size="xs" onClick={() => setShowDismissed(!showDismissed)}>
                  {showDismissed ? 'Hide' : 'Show'}
                </Button>
              }
            >
              {showDismissed &&
                hidden.map((suggestion) => (
                  <Item key={suggestion.id} suggestion={suggestion} config={config}>
                    <Button size="sm" variant="outline" onClick={() => restore(suggestion.id)}>
                      Restore
                    </Button>
                  </Item>
                ))}
            </Group>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}

// children is false while the group is collapsed.
function Group({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center gap-2 px-1">
        <h3 className="text-xs font-bold tracking-wider text-dim uppercase">{title}</h3>
        {action}
      </div>
      {children && <div className="divide-y divide-border/60 rounded-2xl bg-card px-4 shadow-panel">{children}</div>}
    </section>
  )
}

function Item({ suggestion, config, children }: { suggestion: Suggestion; config: Config; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2 py-4">
      <p className="font-medium text-foreground">{suggestion.title}</p>
      <p className="text-muted-foreground">{suggestion.benefit}</p>
      {suggestion.tradeoff && (
        <p className="text-muted-foreground">
          <span className="font-medium text-dim">Trade-off:</span> {suggestion.tradeoff}
        </p>
      )}
      <ul className="flex flex-col gap-1 rounded-lg bg-muted/50 px-3 py-2 font-mono text-xs break-all">
        {suggestion.changes.map((change) => (
          <ChangeLine key={change.path.join('.')} change={change} current={valueAt(config, change.path)} />
        ))}
      </ul>
      <div className="flex gap-2 pt-1">{children}</div>
    </div>
  )
}

// The change as a path and a value, and the value it replaces.
function ChangeLine({ change, current }: { change: Change; current: unknown }) {
  const key = change.path.join('.')
  const now = current === undefined ? null : <span className="text-dim"> (now {JSON.stringify(current)})</span>
  if (change.kind === 'remove') {
    return (
      <li>
        <span className="text-dim">remove</span> {key}
        {now}
      </li>
    )
  }
  if (change.kind === 'add') {
    return (
      <li>
        {key}
        {change.items.map((item) => (
          <span key={item} className="block pl-3">
            <span className="text-committed">+</span> {JSON.stringify(item)}
          </span>
        ))}
      </li>
    )
  }
  return (
    <li>
      {key}: {JSON.stringify(change.value)}
      {now}
    </li>
  )
}

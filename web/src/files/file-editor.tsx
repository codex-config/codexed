import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle } from 'lucide-react'
import { useEffect, useState, type KeyboardEvent } from 'react'
import { createPortal } from 'react-dom'
import { parse } from 'smol-toml'

import { Alert, AlertAction, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { ApiError, api, queries, type FileRef } from '@/lib/api'
import { fileKey, setUnsaved } from '@/lib/location'
import { notify } from '@/lib/notify'
import { cn } from '@/lib/ui'

type Draft = { text: string; version: string }

type Props = FileRef & {
  // Where the buttons go. null hides them.
  toolbar: Element | null
}

const placeholders: Record<string, string> = {
  config: '# Codex config, in TOML\nmodel = "gpt-5.5"',
  'agents-md': '# Instructions for Codex',
  skill: '---\nname: my-skill\ndescription: When Codex should use this skill\n---\n',
}

export function FileEditor({ dir, kind, name, path, toolbar }: Props) {
  const client = useQueryClient()
  const target: FileRef = { dir, kind, name, path }
  const query = useQuery(queries.file(target))
  const [draft, setDraft] = useState<Draft | null>(null)
  const isTOML = kind === 'config'

  const save = useMutation({
    mutationFn: ({ text, version }: Draft) => api.saveFile(target, text, version),
    onSuccess: (file) => {
      client.setQueryData(queries.file(target).queryKey, file)
      if (kind === 'skill') client.invalidateQueries({ queryKey: ['skills'] })
      if (kind === 'config') client.invalidateQueries({ queryKey: ['features'] })
      setDraft(null)
    },
    onError: (error) => {
      if (error instanceof ApiError && error.status === 409) {
        client.invalidateQueries({ queryKey: queries.file(target).queryKey })
      }
      notify.error('Could not save', error.message)
    },
  })

  const file = query.data
  const original = file?.exists ? file.content : ''
  const text = draft?.text ?? original
  const dirty = draft !== null && draft.text !== original
  const stale = dirty && file !== undefined && draft.version !== file.version
  const error = isTOML ? tomlError(text) : null
  const canSave = dirty && !stale && !error && !save.isPending

  useEffect(() => {
    const key = fileKey({ dir, kind, name, path })
    setUnsaved(key, dirty)
    return () => setUnsaved(key, false)
  }, [dir, kind, name, path, dirty])

  if (query.isPending) return <Skeleton className="h-full min-h-64" />
  if (query.isError) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Could not load the file</AlertTitle>
        <AlertDescription>{query.error.message}</AlertDescription>
      </Alert>
    )
  }

  const loaded = query.data

  function edit(next: string) {
    setDraft(next === original ? null : { text: next, version: draft?.version ?? loaded.version })
  }

  function onKeyDown(event: KeyboardEvent) {
    if ((event.metaKey || event.ctrlKey) && event.key === 's') {
      event.preventDefault()
      if (canSave) save.mutate(draft!)
    }
  }

  const actions = dirty && (
    <div className="flex gap-2">
      <Button variant="ghost" size="sm" onClick={() => setDraft(null)}>
        Discard
      </Button>
      <Button size="sm" disabled={!canSave} onClick={() => save.mutate(draft!)}>
        {save.isPending ? 'Saving…' : 'Save'}
      </Button>
    </div>
  )

  return (
    <div
      className={cn(
        'relative flex h-full min-h-0 flex-col overflow-hidden rounded-3xl bg-card shadow-panel transition-shadow',
        error ? 'ring-2 ring-destructive/40' : 'focus-within:ring-2 focus-within:ring-primary/30',
      )}
    >
      {toolbar && actions && createPortal(actions, toolbar)}
      {stale && (
        <Alert className="mx-4 mt-4 w-auto">
          <AlertTriangle />
          <AlertTitle>The file changed on disk</AlertTitle>
          <AlertDescription>Something else, probably Codex, saved this file after you started editing.</AlertDescription>
          <AlertAction className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setDraft(null)}>
              Load theirs
            </Button>
            <Button size="sm" variant="outline" onClick={() => setDraft({ ...draft!, version: loaded.version })}>
              Keep mine
            </Button>
          </AlertAction>
        </Alert>
      )}

      <Textarea
        value={text}
        onChange={(event) => edit(event.target.value)}
        onKeyDown={onKeyDown}
        spellCheck={!isTOML}
        aria-invalid={!!error}
        placeholder={placeholders[kind]}
        className="min-h-64 flex-1 resize-none rounded-none border-0 bg-transparent px-5 py-4 font-mono text-sm leading-relaxed shadow-none [field-sizing:fixed] focus-visible:ring-0 aria-invalid:ring-0 md:text-sm dark:bg-transparent"
      />

      {error && <p className="border-t px-5 py-2.5 text-sm text-destructive">{error}</p>}
    </div>
  )
}

// Catches typing mistakes before saving. Codex checks the values when you save.
function tomlError(text: string): string | null {
  try {
    parse(text)
    return null
  } catch (error) {
    return (error as Error).message.split('\n')[0]
  }
}

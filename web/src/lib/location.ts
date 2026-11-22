import { useSyncExternalStore } from 'react'

import type { FileRef } from '@/lib/api'

// The selected folder and tab live in the URL, so reloads and bookmarks keep them.

export type Tab = 'settings' | 'agents-md' | 'skills' | 'plugins' | 'marketplaces' | 'mcp' | 'features'

export type Location = { dir: string; tab: Tab }

const tabs: Tab[] = ['settings', 'agents-md', 'skills', 'plugins', 'marketplaces', 'mcp', 'features']

function subscribe(onChange: () => void) {
  window.addEventListener('popstate', onChange)
  return () => window.removeEventListener('popstate', onChange)
}

export function useLocation(): Location {
  const search = useSyncExternalStore(subscribe, () => window.location.search)
  const params = new URLSearchParams(search)
  const tab = params.get('tab') as Tab
  return {
    dir: params.get('dir') ?? '',
    tab: tabs.includes(tab) ? tab : 'settings',
  }
}

// Editors with unsaved changes register here, so that leaving the folder asks first.
const unsaved = new Set<string>()

export function fileKey({ dir, kind, name, path }: FileRef) {
  return `${dir}:${kind}:${path ?? name ?? ''}`
}

export function setUnsaved(key: string, value: boolean) {
  if (value) unsaved.add(key)
  else unsaved.delete(key)
}

// Asks before discarding edits. Without keys, it checks every open editor.
export function confirmDiscard(keys?: string[]) {
  const pending = keys ? keys.filter((key) => unsaved.has(key)) : [...unsaved]
  return pending.length === 0 || window.confirm('You have unsaved changes. Discard them?')
}

window.addEventListener('beforeunload', (event) => {
  if (unsaved.size > 0) event.preventDefault()
})

export function navigate(next: Partial<Location>) {
  const params = new URLSearchParams(window.location.search)
  const leaving = next.dir !== undefined && next.dir !== (params.get('dir') ?? '')
  if (leaving && !confirmDiscard()) return

  for (const [key, value] of Object.entries(next)) {
    if (value) params.set(key, value)
    else params.delete(key)
  }
  window.history.pushState(null, '', `?${params}`)
  window.dispatchEvent(new PopStateEvent('popstate'))
}

export function shortPath(path: string, home?: string) {
  if (home && (path === home || path.startsWith(home + '/') || path.startsWith(home + '\\'))) {
    return '~' + path.slice(home.length)
  }
  return path
}

import { useIsFetching, useQueryClient } from '@tanstack/react-query'
import { RefreshCw } from 'lucide-react'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { FileEditor } from '@/files/file-editor'
import { queries } from '@/lib/api'
import { cn } from '@/lib/ui'
import { SettingsForm } from '@/settings/settings-form'

type View = 'visual' | 'toml'

// Both views stay mounted, so that switching keeps unsaved TOML edits.
// The active one puts its search field or buttons into the toolbar.
export function SettingsPanel({ dir }: { dir: string }) {
  const [view, setView] = useState<View>('visual')
  const [toolbar, setToolbar] = useState<HTMLDivElement | null>(null)

  const client = useQueryClient()
  const fileKey = ['file', dir, 'config']
  const schema = queries.schema().queryKey
  const refreshing = useIsFetching({ queryKey: fileKey }) + useIsFetching({ queryKey: schema }) > 0

  // Reads the file and the lists from Codex again, for example after Codex changed them.
  function refresh() {
    client.invalidateQueries({ queryKey: fileKey })
    client.invalidateQueries({ queryKey: schema })
    client.invalidateQueries({ queryKey: queries.models().queryKey })
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <div ref={setToolbar} className="flex min-w-0 flex-1 items-center gap-2" />
        <div className="flex items-center gap-1">
          <ToggleGroup
            variant="outline"
            size="sm"
            className="mr-2"
            value={[view]}
            onValueChange={([value]) => value && setView(value as View)}
          >
            <ToggleGroupItem value="visual">Visual</ToggleGroupItem>
            <ToggleGroupItem value="toml">TOML</ToggleGroupItem>
          </ToggleGroup>
          <Button variant="ghost" size="icon-sm" title="Reload from disk" aria-label="Reload from disk" onClick={refresh}>
            <RefreshCw className={cn(refreshing && 'animate-spin')} />
          </Button>
        </div>
      </div>

      <div className="min-h-0 flex-1">
        <div className={view === 'visual' ? 'h-full overflow-y-auto rounded-lg' : 'hidden'}>
          <SettingsForm dir={dir} toolbar={view === 'visual' ? toolbar : null} onShowTOML={() => setView('toml')} />
        </div>
        <div className={view === 'toml' ? 'h-full' : 'hidden'}>
          <FileEditor dir={dir} kind="config" toolbar={view === 'toml' ? toolbar : null} />
        </div>
      </div>
    </div>
  )
}

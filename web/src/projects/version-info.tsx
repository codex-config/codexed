import { useQuery } from '@tanstack/react-query'
import { Info } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { queries } from '@/lib/api'

export function VersionInfo() {
  const health = useQuery(queries.health())
  const schema = useQuery(queries.schema())
  const codex = health.data ? (health.data.codex?.version ?? 'not found') : '…'

  return (
    <Popover>
      <PopoverTrigger
        render={<Button variant="ghost" size="icon-xs" className="text-muted-foreground" aria-label="Versions" />}
      >
        <Info />
      </PopoverTrigger>
      <PopoverContent side="bottom" align="end" className="w-auto max-w-72 text-xs">
        <dl className="grid grid-cols-[auto_auto] gap-x-6 gap-y-1">
          <dt className="text-muted-foreground">Codexed</dt>
          <dd className="font-mono">{health.data?.version ?? '…'}</dd>
          <dt className="text-muted-foreground">Codex</dt>
          <dd className="font-mono">{codex}</dd>
        </dl>
        {schema.data && !schema.data.matches && (
          <p className="mt-2 text-muted-foreground">
            The list of settings is from Codex {schema.data.version} until the one for your version loads.
          </p>
        )}
      </PopoverContent>
    </Popover>
  )
}

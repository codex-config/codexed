import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Puzzle } from 'lucide-react'
import { useState } from 'react'

import { EmptyState } from '@/components/empty-state'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { api, queries, type Marketplace, type PluginSummary } from '@/lib/api'
import { navigate } from '@/lib/location'
import { notify } from '@/lib/notify'

export function PluginsPanel() {
  const client = useQueryClient()
  const plugins = useQuery(queries.plugins(''))
  const [filter, setFilter] = useState('')

  const change = useMutation({
    mutationFn: ({ plugin, marketplace }: { plugin: PluginSummary; marketplace: Marketplace }) =>
      plugin.installed ? api.uninstallPlugin(plugin.id) : api.installPlugin(plugin.name, marketplace.path),
    onSuccess: () => client.invalidateQueries({ queryKey: ['plugins'] }),
    onError: (error) => notify.error('Could not change the plugin', error.message),
  })

  if (plugins.isPending) return <Skeleton className="h-64" />
  if (plugins.isError) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Could not load plugins</AlertTitle>
        <AlertDescription>{plugins.error.message}</AlertDescription>
      </Alert>
    )
  }

  const marketplaces = plugins.data.marketplaces.filter((marketplace) => marketplace.plugins.length > 0)
  if (marketplaces.length === 0) {
    return (
      <EmptyState icon={<Puzzle />} title="No plugins to install yet">
        <div className="flex flex-col items-center gap-4">
          Plugins come from marketplaces. Add a marketplace to see its plugins here.
          <Button onClick={() => navigate({ tab: 'marketplaces' })}>Add a marketplace</Button>
        </div>
      </EmptyState>
    )
  }

  const query = filter.trim().toLowerCase()
  const matches = (plugin: PluginSummary) =>
    !query ||
    plugin.name.toLowerCase().includes(query) ||
    (plugin.interface?.displayName ?? '').toLowerCase().includes(query) ||
    (plugin.interface?.shortDescription ?? '').toLowerCase().includes(query)

  return (
    <div className="flex flex-col gap-8 pb-8">
      <Input
        value={filter}
        onChange={(event) => setFilter(event.target.value)}
        placeholder="Filter plugins"
        aria-label="Filter plugins"
        className="max-w-sm"
      />
      {marketplaces.map((marketplace) => {
        const list = marketplace.plugins.filter(matches)
        if (list.length === 0) return null
        return (
          <section key={marketplace.name} className="flex flex-col gap-3">
            <h2 className="px-1 text-xs font-bold tracking-wider text-dim uppercase">
              {marketplace.interface?.displayName || marketplace.name}
            </h2>
            <div className="divide-y divide-border/60 rounded-3xl bg-card px-5 shadow-panel">
              {list.map((plugin) => {
                const busy = change.isPending && change.variables?.plugin.id === plugin.id
                return (
                  <div key={plugin.id} className="flex items-start gap-6 py-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{plugin.interface?.displayName || plugin.name}</span>
                        {plugin.version && <span className="font-mono text-xs text-muted-foreground">{plugin.version}</span>}
                        {plugin.installed && <Badge variant="outline">Installed</Badge>}
                      </div>
                      {plugin.interface?.shortDescription && (
                        <p className="mt-1 text-sm text-muted-foreground">{plugin.interface.shortDescription}</p>
                      )}
                    </div>
                    <Button
                      size="sm"
                      variant={plugin.installed ? 'outline' : 'default'}
                      disabled={change.isPending}
                      onClick={() => change.mutate({ plugin, marketplace })}
                    >
                      {busy ? (plugin.installed ? 'Removing…' : 'Installing…') : plugin.installed ? 'Uninstall' : 'Install'}
                    </Button>
                  </div>
                )
              })}
            </div>
          </section>
        )
      })}
    </div>
  )
}

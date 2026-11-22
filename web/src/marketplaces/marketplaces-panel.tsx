import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Store } from 'lucide-react'
import { useState } from 'react'
import { createPortal } from 'react-dom'

import { EmptyState } from '@/components/empty-state'
import { FormRow } from '@/components/form-row'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { api, queries } from '@/lib/api'
import { shortPath } from '@/lib/location'
import { notify } from '@/lib/notify'

export function MarketplacesPanel({ actions }: { actions: Element | null }) {
  const client = useQueryClient()
  const plugins = useQuery(queries.plugins(''))
  const health = useQuery(queries.health())
  const [source, setSource] = useState('')
  const [ref, setRef] = useState('')

  const refresh = () => client.invalidateQueries({ queryKey: ['plugins'] })
  const add = useMutation({
    mutationFn: () => api.addMarketplace(source.trim(), ref.trim()),
    onSuccess: () => {
      setSource('')
      setRef('')
      refresh()
    },
    onError: (error) => notify.error('Could not add the marketplace', error.message),
  })
  const remove = useMutation({
    mutationFn: (name: string) => api.removeMarketplace(name),
    onSuccess: refresh,
    onError: (error) => notify.error('Could not remove the marketplace', error.message),
  })
  const upgrade = useMutation({
    mutationFn: (name?: string) => api.upgradeMarketplace(name),
    onSuccess: refresh,
    onError: (error) => notify.error('Could not update', error.message),
  })

  if (plugins.isPending) return <Skeleton className="h-64" />
  if (plugins.isError) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Could not load marketplaces</AlertTitle>
        <AlertDescription>{plugins.error.message}</AlertDescription>
      </Alert>
    )
  }
  const marketplaces = plugins.data.marketplaces
  const errors = plugins.data.marketplaceLoadErrors ?? []

  return (
    <div className="flex flex-col gap-8 pb-8">
      {actions &&
        marketplaces.length > 0 &&
        createPortal(
          <Button size="sm" variant="outline" disabled={upgrade.isPending} onClick={() => upgrade.mutate(undefined)}>
            {upgrade.isPending && upgrade.variables === undefined ? 'Updating…' : 'Update all'}
          </Button>,
          actions,
        )}

      <section className="flex flex-col gap-3">
        <h2 className="px-1 text-xs font-bold tracking-wider text-dim uppercase">Add a marketplace</h2>
        <div className="divide-y divide-border/60 rounded-3xl bg-card px-5 shadow-panel">
          <FormRow label="Source" hint="A GitHub repository as owner/repo, a git URL, or a folder on this computer.">
            <Input value={source} onChange={(event) => setSource(event.target.value)} placeholder="owner/repo" className="font-mono" />
          </FormRow>
          <FormRow label="Branch or tag" hint="Optional. Codex uses the default branch without one.">
            <Input value={ref} onChange={(event) => setRef(event.target.value)} placeholder="main" className="font-mono" />
          </FormRow>
          <div className="flex justify-end py-4">
            <Button size="sm" disabled={!source.trim() || add.isPending} onClick={() => add.mutate()}>
              {add.isPending ? 'Adding…' : 'Add marketplace'}
            </Button>
          </div>
        </div>
      </section>

      {errors.length > 0 && (
        <Alert variant="destructive">
          <AlertTitle>Some marketplaces did not load</AlertTitle>
          <AlertDescription>
            {errors.map((error) => (
              <p key={error.marketplacePath}>
                <span className="font-mono">{shortPath(error.marketplacePath, health.data?.home)}</span>: {error.message}
              </p>
            ))}
          </AlertDescription>
        </Alert>
      )}

      {marketplaces.length === 0 ? (
        <EmptyState icon={<Store />} title="No marketplaces yet">
          A marketplace is a list of plugins that you can install.
        </EmptyState>
      ) : (
        <section className="flex flex-col gap-3">
          <h2 className="px-1 text-xs font-bold tracking-wider text-dim uppercase">Your marketplaces</h2>
          <div className="divide-y divide-border/60 rounded-3xl bg-card px-5 shadow-panel">
            {marketplaces.map((marketplace) => (
              <div key={marketplace.name} className="flex items-start gap-6 py-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{marketplace.interface?.displayName || marketplace.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {marketplace.plugins.length} {marketplace.plugins.length === 1 ? 'plugin' : 'plugins'}
                    </span>
                  </div>
                  {marketplace.path && (
                    <p className="mt-1 truncate font-mono text-xs text-muted-foreground">
                      {shortPath(marketplace.path, health.data?.home)}
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={upgrade.isPending}
                    onClick={() => upgrade.mutate(marketplace.name)}
                  >
                    {upgrade.isPending && upgrade.variables === marketplace.name ? 'Updating…' : 'Update'}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive"
                    disabled={remove.isPending}
                    onClick={() => window.confirm(`Remove the marketplace ${marketplace.name}?`) && remove.mutate(marketplace.name)}
                  >
                    Remove
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

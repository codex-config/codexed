import type { ReactNode } from 'react'

import { IconTile } from '@/components/tiles'

export function EmptyState({ icon, title, children }: { icon: ReactNode; title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-3xl bg-card px-6 py-12 text-center shadow-panel">
      <IconTile size="lg">{icon}</IconTile>
      <p className="font-heading font-semibold">{title}</p>
      {children && <div className="max-w-sm text-sm text-muted-foreground">{children}</div>}
    </div>
  )
}

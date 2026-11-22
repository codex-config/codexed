import type { ReactNode } from 'react'

import { cn } from '@/lib/ui'

const sizes = {
  sm: 'size-7 rounded-lg text-xs [&_svg]:size-3.5',
  md: 'size-9 rounded-xl text-sm [&_svg]:size-4',
  lg: 'size-12 rounded-2xl text-lg [&_svg]:size-6',
}

type Size = keyof typeof sizes

export function Logo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" aria-hidden className={cn('size-7 shrink-0', className)}>
      <rect width="64" height="64" rx="16" fill="#3b6ff0" />
      <path d="M28 19H20V45H28M36 19H44V45H36" fill="none" stroke="#fff" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="32" cy="32" r="4.5" fill="#fff" />
    </svg>
  )
}

export function IconTile({ children, size = 'md', className }: { children: ReactNode; size?: Size; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn('grid shrink-0 place-items-center bg-primary/15 text-link', sizes[size], className)}
    >
      {children}
    </span>
  )
}

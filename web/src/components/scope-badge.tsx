import { cn } from '@/lib/ui'

// The colors of the file badges in the Claude docs: shared files are
// committed, local files are gitignored, and global files stay on your computer.
const tones = {
  shared: 'border-committed/30 bg-committed/10 text-committed',
  local: 'border-gitignored/30 bg-gitignored/10 text-gitignored',
  global: 'border-local/30 bg-local/10 text-local',
}

export function ScopeBadge({ scope, className }: { scope: keyof typeof tones; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex h-5 shrink-0 items-center rounded-sm border px-1.5 text-[10px] font-bold tracking-wider uppercase',
        tones[scope],
        className,
      )}
    >
      {scope}
    </span>
  )
}

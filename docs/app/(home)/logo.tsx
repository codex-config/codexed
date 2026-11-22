import { cn } from '@/lib/cn';

// A TOML table header, [•]. On a blue background, the square is white.
export function Logo({ className, white = false }: { className?: string; white?: boolean }) {
  const ink = white ? '#2f5fd6' : '#fff';
  return (
    <svg viewBox="0 0 64 64" aria-hidden className={cn('size-8 shrink-0', white && 'drop-shadow', className)}>
      <rect width="64" height="64" rx="16" fill={white ? '#fff' : '#3b6ff0'} />
      <path
        d="M28 19H20V45H28M36 19H44V45H36"
        fill="none"
        stroke={ink}
        strokeWidth="4.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="32" cy="32" r="4.5" fill={ink} />
    </svg>
  );
}

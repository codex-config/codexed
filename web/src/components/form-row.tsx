import type { ReactNode } from 'react'

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

// A labeled field in a form card.
export function FormRow({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="flex items-start gap-6 py-4">
      <span className="w-32 shrink-0 pt-2 text-sm font-medium">{label}</span>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        {children}
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>
    </div>
  )
}

export function FormChoice({
  value,
  options,
  onChange,
}: {
  value: string
  options: { value: string; label: string }[]
  onChange: (value: string) => void
}) {
  return (
    <Select items={options} value={value} onValueChange={(next) => next && onChange(next as string)}>
      <SelectTrigger className="w-full max-w-sm">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

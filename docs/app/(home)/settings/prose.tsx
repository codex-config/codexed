import type { ReactNode } from 'react';

// Text from the schema, with `code` in backticks shown as code.
export function Prose({ text, className }: { text: string; className?: string }) {
  const parts: ReactNode[] = text
    .split(/(`[^`]+`)/)
    .map((part, index) =>
      part.startsWith('`') && part.endsWith('`') && part.length > 2 ? (
        <code key={index} className="rounded bg-fd-muted px-1 py-0.5 font-mono text-[0.875em]">
          {part.slice(1, -1)}
        </code>
      ) : (
        part
      ),
    );
  return <p className={className}>{parts}</p>;
}

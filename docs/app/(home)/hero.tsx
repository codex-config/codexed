'use client';

import { ArrowRight, Brackets } from 'lucide-react';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/cn';
import { highlightTOML } from './toml-view';

// A sample file. The lines with a hint light up one by one.
const lines: { text: string; hint?: string }[] = [
  { text: 'model = "gpt-5.6-sol"', hint: 'Use the most capable model' },
  { text: 'model_reasoning_effort = "high"', hint: 'Think longer on hard tasks' },
  { text: 'approval_policy = "on-request"', hint: 'Codex decides when to ask' },
  { text: 'sandbox_mode = "workspace-write"', hint: 'Change this project only' },
  { text: '' },
  { text: '[features]' },
  { text: 'memories = true', hint: 'Remember across sessions' },
  { text: '' },
  { text: '[mcp_servers.docs]', hint: 'Add a server for library docs' },
  { text: 'command = "npx"' },
  { text: 'args = ["-y", "@upstash/context7-mcp"]' },
];

const hinted = lines.flatMap((line, index) => (line.hint ? [index] : []));

const grid =
  'bg-[linear-gradient(var(--color-fd-border)_1px,transparent_1px),linear-gradient(90deg,var(--color-fd-border)_1px,transparent_1px)] bg-[size:44px_44px]';

export function Hero({ count }: { count: number }) {
  return (
    <section className="relative isolate -mb-12 overflow-x-clip">
      <div aria-hidden className="absolute inset-0 -z-10 [mask-image:linear-gradient(to_bottom,black_55%,transparent)]">
        <div className={cn('absolute inset-0 [mask-image:radial-gradient(70%_80%_at_50%_0%,black,transparent_80%)]', grid)} />
        <div className="absolute inset-x-0 -top-40 h-[48rem] bg-[radial-gradient(45%_50%_at_30%_40%,rgba(59,111,240,0.28),transparent_70%),radial-gradient(35%_45%_at_80%_45%,rgba(140,180,255,0.16),transparent_70%)]" />
      </div>

      <div className="mx-auto grid w-full max-w-6xl grid-cols-1 items-center gap-12 px-6 pt-16 pb-12 sm:pt-24 lg:grid-cols-[minmax(0,1fr)_minmax(0,32rem)]">
        <div className="flex flex-col items-start">
          <h1 className="text-[2.75rem] leading-[1.05] font-extrabold tracking-tight sm:text-6xl">
            Every setting,
            <span className="block bg-linear-to-r from-[#3b6ff0] to-[#1d3d9e] bg-clip-text pb-1 text-transparent dark:from-[#c2d6ff] dark:via-[#8cb4ff] dark:to-[#4a7bf5]">
              in plain English
            </span>
          </h1>
          <p className="mt-6 max-w-xl text-lg text-pretty text-fd-muted-foreground">
            See what each of the {count} Codex settings does, and set the ones you want. Then copy your config.toml,
            or paste your own to check it.
          </p>
          <div className="mt-9 flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
            <a
              href="#settings"
              className="group flex items-center justify-center gap-2 rounded-xl bg-linear-to-b from-[#4a7bf5] to-[#2f5fd6] px-6 py-3 font-semibold text-white shadow-[0_12px_32px_-12px_rgba(59,111,240,0.9)] ring-1 ring-white/20 transition hover:brightness-110"
            >
              Build your config.toml
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
            </a>
            <a
              href="#toml"
              className="flex items-center justify-center gap-2 rounded-xl border bg-fd-card/60 px-6 py-3 font-semibold backdrop-blur transition-colors hover:bg-fd-accent"
            >
              <Brackets className="size-4" />
              Check your config.toml
            </a>
          </div>
        </div>

        <SampleFile />
      </div>
    </section>
  );
}

// A config.toml that explains itself, one line at a time.
function SampleFile() {
  const [active, setActive] = useState(hinted[0]);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const timer = setInterval(() => {
      setActive((current) => hinted[(hinted.indexOf(current) + 1) % hinted.length]);
    }, 2600);
    return () => clearInterval(timer);
  }, [paused]);

  return (
    <div className="relative" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
      <div aria-hidden className="absolute -inset-6 -z-10 rounded-[2rem] bg-[#3b6ff0]/20 blur-3xl" />
      <div className="overflow-hidden rounded-2xl border bg-fd-card/90 shadow-2xl backdrop-blur">
        <div className="flex items-center gap-1.5 border-b px-4 py-3">
          <span className="size-3 rounded-full bg-[#ff5f57]" />
          <span className="size-3 rounded-full bg-[#febc2e]" />
          <span className="size-3 rounded-full bg-[#28c840]" />
          <span className="ml-3 font-mono text-xs text-fd-muted-foreground">~/.codex/config.toml</span>
        </div>
        <pre className="py-4 font-mono text-[13px] leading-7">
          {lines.map((line, index) => (
            <div
              key={line.text + index}
              onMouseEnter={() => line.hint && setActive(index)}
              className={cn(
                'flex min-h-7 items-baseline gap-4 px-4 transition-colors duration-300',
                index === active && 'bg-[#3b6ff0]/12',
              )}
            >
              <span className="w-4 shrink-0 text-right text-xs text-fd-muted-foreground/50 select-none">{index + 1}</span>
              <code className="whitespace-pre">{highlightTOML(line.text)}</code>
              {line.hint && (
                <span
                  className={cn(
                    'hidden min-w-0 truncate font-sans text-xs font-medium text-[#2f5fd6] transition-opacity duration-300 sm:inline dark:text-[#8cb4ff]',
                    index === active ? 'opacity-100' : 'opacity-0',
                  )}
                >
                  ← {line.hint}
                </span>
              )}
            </div>
          ))}
        </pre>
        <p className="border-t px-4 py-3 text-sm font-medium text-[#2f5fd6] sm:hidden dark:text-[#8cb4ff]">
          {lines[active].hint}
        </p>
      </div>
    </div>
  );
}

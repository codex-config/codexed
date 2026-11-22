'use client';

import { Check, Copy, FolderTree, type LucideIcon, ToggleRight } from 'lucide-react';
import { type CSSProperties, type ReactNode, useEffect, useState } from 'react';
import { cn } from '@/lib/cn';
import { basePath } from '@/lib/shared';
import { Logo } from './logo';

const unixCommand = 'curl -fsSL https://raw.githubusercontent.com/codex-config/codexed/main/install.sh | sh';
const windowsCommand = 'irm https://raw.githubusercontent.com/codex-config/codexed/main/install.ps1 | iex';

// The install steps, in the words of each system.
const systems = [
  {
    id: 'macos',
    label: 'macOS',
    terminal: 'Open Terminal',
    paste: 'Paste this, and press Return',
    command: unixCommand,
    open: 'or tap its icon in the menu bar',
  },
  {
    id: 'linux',
    label: 'Linux',
    terminal: 'Open a terminal',
    paste: 'Paste this, and press Enter',
    command: unixCommand,
    open: 'or tap its icon in the tray',
  },
  {
    id: 'windows',
    label: 'Windows',
    terminal: 'Open PowerShell',
    paste: 'Paste this, and press Enter',
    command: windowsCommand,
    open: 'or open it from the Start menu',
  },
];

// Light from the top left, a darker corner at the bottom right.
const background: CSSProperties = {
  backgroundImage: [
    'radial-gradient(60% 70% at 10% 0%, rgba(140, 180, 255, 0.6), transparent 60%)',
    'radial-gradient(50% 60% at 100% 100%, rgba(8, 18, 60, 0.6), transparent 70%)',
    'linear-gradient(160deg, #4a7bf5, #1d3d9e)',
  ].join(', '),
};

// A fine grid that fades out toward the bottom.
const grid: CSSProperties = {
  backgroundImage:
    'linear-gradient(rgba(255,255,255,0.07) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.07) 1px, transparent 1px)',
  backgroundSize: '32px 32px',
  maskImage: 'radial-gradient(80% 70% at 30% 0%, black, transparent 75%)',
};

export function CodexedCard() {
  const [system, setSystem] = useState('macos');
  const [copied, setCopied] = useState(false);
  const install = systems.find((each) => each.id === system) ?? systems[0];

  useEffect(() => {
    const agent = navigator.userAgent;
    if (/windows/i.test(agent)) setSystem('windows');
    else if (/linux/i.test(agent) && !/android/i.test(agent)) setSystem('linux');
  }, []);

  async function copy() {
    await navigator.clipboard.writeText(install.command);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <section
      id="codexed"
      style={background}
      className="relative isolate scroll-mt-20 overflow-hidden rounded-3xl text-white shadow-[0_30px_80px_-20px_rgba(20,50,150,0.55)]"
    >
      <div aria-hidden style={grid} className="absolute inset-0 -z-10" />

      <div className="grid grid-cols-1 gap-x-8 gap-y-5 p-6 sm:p-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] lg:p-14">
        <div className="flex items-center gap-2.5 lg:col-span-2">
          <Logo white />
          <span className="text-lg font-semibold">Codexed</span>
        </div>

        <div className="flex flex-col gap-5">
          <h2 className="text-4xl font-extrabold tracking-tight text-balance sm:text-5xl">
            Edit every Codex setting with a form, not with{' '}
            <span className="text-white/55 line-through decoration-white/80 decoration-[3px]">TOML</span>
          </h2>
          <div className="flex max-w-xl flex-col gap-7 text-lg text-pretty text-white/85">
            <p>Edit your config.toml, AGENTS.md, MCP servers, skills, plugins and more.</p>
            <p>Quick and focused. Written in Go.</p>
          </div>
        </div>

        <div className="mt-3 flex flex-col gap-4 lg:mt-0">
          <div role="tablist" aria-label="Your system" className="flex gap-1">
            {systems.map((each) => (
              <button
                key={each.id}
                type="button"
                role="tab"
                aria-selected={each.id === system}
                onClick={() => setSystem(each.id)}
                className={cn(
                  'rounded-md px-2.5 py-1 text-sm font-medium transition-colors',
                  each.id === system ? 'bg-white/20 text-white' : 'text-white/70 hover:text-white',
                )}
              >
                {each.label}
              </button>
            ))}
          </div>

          <ol className="flex flex-col gap-4">
            <Step number={1} title={install.terminal} />
            <Step number={2} title={install.paste}>
              <div className="mt-1 flex items-center gap-2 rounded-xl bg-black/35 p-1.5 pl-4 shadow-lg ring-1 ring-white/20">
                <code className="min-w-0 flex-1 overflow-x-auto font-mono text-xs whitespace-nowrap text-white/90">
                  {install.command}
                </code>
                <button
                  type="button"
                  onClick={copy}
                  aria-label="Copy the install command"
                  className="flex shrink-0 items-center gap-1.5 rounded-lg bg-white px-3.5 py-2 text-sm font-bold text-[#1d3d9e] shadow-md transition hover:scale-105 active:scale-100"
                >
                  {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
                  {copied ? 'Copied' : 'Copy'}
                </button>
              </div>
            </Step>
            <Step
              number={3}
              title={
                <>
                  Type{' '}
                  <code className="rounded-md bg-black/35 px-1.5 py-0.5 font-mono text-sm text-white ring-1 ring-white/20">
                    codexed
                  </code>{' '}
                  {install.open}
                </>
              }
            />
          </ol>
        </div>
      </div>

      {/* The app in a window frame, tilted back a little and cut off by the bottom of the card. */}
      <div className="relative px-4 sm:px-10 lg:px-14">
        <div aria-hidden className="absolute inset-x-[15%] top-10 -z-10 h-2/3 rounded-full bg-[#8cb4ff]/40 blur-3xl" />
        <div className="group/window [perspective:2400px]">
          <div className="overflow-hidden rounded-t-xl bg-[#1a1a1a] shadow-[0_-10px_80px_-10px_rgba(0,0,0,0.6)] ring-1 ring-white/25 transition-transform duration-500 ease-out lg:[transform:rotateX(7deg)] lg:group-hover/window:[transform:rotateX(0deg)] [transform-origin:bottom]">
            <div className="flex items-center gap-1.5 border-b border-white/10 px-4 py-3">
              <span className="size-3 rounded-full bg-[#ff5f57]" />
              <span className="size-3 rounded-full bg-[#febc2e]" />
              <span className="size-3 rounded-full bg-[#28c840]" />
              <span className="ml-3 font-mono text-xs text-white/50">127.0.0.1:7378</span>
            </div>
            <div className="max-h-[26rem] overflow-hidden sm:max-h-[34rem]">
              {/* A plain img, because a static export cannot optimize images. */}
              <img
                src={`${basePath}/codexed.jpg`}
                alt="Codexed, with the global settings of Codex as a form: text fields, lists of choices and switches"
                width={2400}
                height={1520}
                className="block w-full"
              />
            </div>
          </div>
        </div>

        {/* Placed on empty parts of the screenshot, next to what they describe. */}
        <Callout icon={FolderTree} className="top-[62%] left-6 [animation-delay:-3s]">
          Global or project settings
        </Callout>
        <Callout icon={ToggleRight} className="top-[85%] right-[22%]">
          Turn it on with one click
        </Callout>
      </div>
    </section>
  );
}

function Step({ number, title, children }: { number: number; title: ReactNode; children?: ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="grid size-6 shrink-0 place-items-center rounded-full bg-white text-xs font-bold text-[#1d3d9e]">
        {number}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p className="font-semibold">{title}</p>
        {children && <div className="text-sm text-white/80">{children}</div>}
      </div>
    </li>
  );
}

// A note that floats over the screenshot on wide screens.
function Callout({ icon: Icon, className, children }: { icon: LucideIcon; className: string; children: string }) {
  return (
    <div
      className={cn(
        'pointer-events-none absolute hidden items-center gap-2 rounded-full bg-white px-3.5 py-2 text-sm font-semibold text-[#1d3d9e] shadow-xl ring-1 ring-black/5 lg:flex motion-safe:animate-[float_6s_ease-in-out_infinite]',
        className,
      )}
    >
      <Icon className="size-4" />
      {children}
    </div>
  );
}

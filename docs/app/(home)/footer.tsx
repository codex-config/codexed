import { Download } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { basePath, githubUrl } from '@/lib/shared';
import { source } from '@/lib/source';
import { Logo } from './logo';
import { getSettings } from './settings-data';

// Links to every group of settings and every docs page, so that search engines find them all.
export function Footer() {
  const { categories } = getSettings();
  const docs = source.pageTree.children.flatMap((node) => (node.type === 'page' ? [node] : []));

  return (
    <footer className="border-t bg-fd-card/40">
      <div className="mx-auto grid w-full max-w-6xl grid-cols-2 gap-x-6 gap-y-10 px-6 py-14 lg:grid-cols-[minmax(0,1.2fr)_repeat(4,minmax(0,1fr))]">
        <div className="col-span-2 flex flex-col gap-3 lg:col-span-1">
          <a href={`${basePath}/#codexed`} className="flex items-center gap-2.5 text-lg font-semibold">
            <Logo className="size-7" />
            Codexed
          </a>
          <p className="max-w-xs text-sm text-fd-muted-foreground">
            Edit your config.toml, AGENTS.md, MCP servers, skills, plugins and more. Quick and focused. Written in Go.
          </p>
          <a
            href={`${basePath}/#codexed`}
            className="mt-2 flex items-center gap-2 self-start rounded-lg bg-linear-to-b from-[#4a7bf5] to-[#2f5fd6] px-4 py-2 text-sm font-semibold text-white shadow-sm ring-1 ring-white/20 transition hover:brightness-110"
          >
            <Download className="size-4" />
            Download Codexed
          </a>
          <p className="mt-auto max-w-xs pt-4 text-xs text-fd-muted-foreground">
            Open source under the{' '}
            <a href={`${githubUrl}/blob/main/LICENSE`} className="underline-offset-4 hover:text-fd-foreground hover:underline">
              MIT License
            </a>
            . It is not made by or affiliated with{' '}
            <a href="https://openai.com" className="underline-offset-4 hover:text-fd-foreground hover:underline">
              OpenAI
            </a>
            . Codex is a trademark of OpenAI.
          </p>
        </div>

        <Column title="Codex settings">
          <Item href="/settings">All settings</Item>
          {categories.map((category) => (
            <Item key={category.id} href={`/settings#${category.id}`}>
              {category.label}
            </Item>
          ))}
          <Item href="/#toml">Check your config.toml</Item>
        </Column>

        <Column title="Codexed docs">
          {docs.map((page) => (
            <Item key={page.url} href={page.url}>
              {page.name}
            </Item>
          ))}
        </Column>

        <Column title="Codex">
          <Item href="https://developers.openai.com/codex/config-reference">Codex config reference</Item>
          <Item href="https://developers.openai.com/codex">Codex docs</Item>
          <Item href="https://developers.openai.com/codex/cli">Codex CLI</Item>
          <Item href="https://openai.com">OpenAI</Item>
        </Column>

        <Column title="Resources">
          <Item href="/#codexed">Install Codexed</Item>
          <Item href={githubUrl}>Codexed on GitHub</Item>
          <Item href={`${githubUrl}/releases`}>Releases</Item>
          <Item href={`${githubUrl}/issues`}>Report a problem</Item>
          <Item href="https://developers.openai.com/codex/config-schema.json">config.toml schema</Item>
          <Item href="/llms.txt">llms.txt</Item>
        </Column>
      </div>
    </footer>
  );
}

function Column({ title, children }: { title: string; children: ReactNode }) {
  return (
    <nav aria-label={title} className="flex flex-col gap-3">
      <h2 className="text-xs font-bold tracking-wider text-fd-muted-foreground uppercase">{title}</h2>
      <ul className="flex flex-col gap-2 text-sm">{children}</ul>
    </nav>
  );
}

// Pages use Link. Links to the homepage with a hash stay plain, so that the homepage sees the
// new hash, and so do files and other sites.
function Item({ href, children }: { href: string; children: ReactNode }) {
  const local = href.startsWith('/');
  const page = local && !href.startsWith('/#') && !/\.\w+$/.test(href);
  return (
    <li>
      {!page ? (
        <a href={local ? basePath + href : href} className="text-fd-muted-foreground transition-colors hover:text-fd-foreground">
          {children}
        </a>
      ) : (
        <Link href={href} className="text-fd-muted-foreground transition-colors hover:text-fd-foreground">
          {children}
        </Link>
      )}
    </li>
  );
}

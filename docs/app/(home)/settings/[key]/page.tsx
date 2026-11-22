import { ArrowRight, Download } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { JsonLd } from '@/lib/json-ld';
import { lastModified } from '@/lib/last-modified';
import { absoluteUrl } from '@/lib/shared';
import { Prose } from '../prose';
import { count, describe, entries, exampleOf, findEntry, neighbors, settingUrl, summary } from '../reference';
import { Child, Example, Fact, Facts } from './details';

export const dynamicParams = false;

const updated = lastModified('app/(home)/config-schema.json');

export function generateStaticParams() {
  return entries.map(({ setting }) => ({ key: setting.key }));
}

async function entryOf(params: Promise<{ key: string }>) {
  const entry = findEntry((await params).key);
  if (!entry) notFound();
  return entry;
}

export async function generateMetadata({ params }: PageProps<'/settings/[key]'>): Promise<Metadata> {
  const { setting } = await entryOf(params);
  const url = settingUrl(setting.key);
  return {
    title: { absolute: `${setting.key} | Codex config.toml` },
    description: describe(setting),
    alternates: { canonical: url },
    openGraph: {
      type: 'article',
      url,
      siteName: 'config.toml',
      images: { url: `og/settings/${setting.key}.png`, width: 1200, height: 630, alt: setting.key },
    },
    twitter: { card: 'summary_large_image' },
  };
}

export default async function SettingPage({ params }: PageProps<'/settings/[key]'>) {
  const entry = await entryOf(params);
  const { setting, category } = entry;
  const example = exampleOf(setting);
  const url = absoluteUrl(settingUrl(setting.key));

  return (
    <main className="mx-auto w-full max-w-3xl px-4 pt-10 pb-24 sm:px-6 sm:pt-14">
      <JsonLd
        data={{
          '@graph': [
            {
              '@type': 'TechArticle',
              headline: `${setting.key}: a Codex CLI setting`,
              description: describe(setting),
              url,
              image: absoluteUrl(`/og/settings/${setting.key}.png`),
              dateModified: updated?.toISOString(),
              inLanguage: 'en',
              about: { '@type': 'SoftwareApplication', name: 'Codex CLI', applicationCategory: 'DeveloperApplication' },
              isPartOf: { '@type': 'WebSite', name: 'config.toml', url: absoluteUrl('/') },
            },
            {
              '@type': 'BreadcrumbList',
              itemListElement: [
                { '@type': 'ListItem', position: 1, name: 'Codex settings', item: absoluteUrl('/settings') },
                { '@type': 'ListItem', position: 2, name: category.label, item: absoluteUrl(`/settings#${category.id}`) },
                { '@type': 'ListItem', position: 3, name: setting.key, item: url },
              ],
            },
          ],
        }}
      />

      <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1.5 text-sm text-fd-muted-foreground">
        <Link href="/settings" className="hover:text-fd-foreground">
          Settings
        </Link>
        <span aria-hidden>/</span>
        <Link href={`/settings#${category.id}`} className="hover:text-fd-foreground">
          {category.label}
        </Link>
      </nav>

      <h1 className="mt-3 font-mono text-3xl font-bold tracking-tight break-all sm:text-4xl">{setting.key}</h1>
      {setting.description ? (
        <Prose text={setting.description} className="mt-5 text-lg leading-relaxed" />
      ) : (
        setting.field.kind === 'object' && (
          <p className="mt-5 text-lg leading-relaxed">
            A table of {setting.field.settings.length} settings, which this page explains one by one.
          </p>
        )
      )}

      <div className="mt-8 rounded-xl border bg-fd-card p-5">
        <Facts setting={setting}>
          <Fact term="Group">
            <Link href={`/settings#${category.id}`} className="underline-offset-4 hover:underline">
              {category.label}
            </Link>
          </Fact>
          {category.id === 'experimental' && (
            <Fact term="Status">Experimental. Codex may change or remove it in any version.</Fact>
          )}
        </Facts>
      </div>

      {example && (
        <>
          <h2 className="mt-12 text-xl font-bold tracking-tight">Example</h2>
          <p className="mt-2 mb-3 text-fd-muted-foreground">In your config.toml:</p>
          <Example toml={example} />
        </>
      )}

      {setting.field.kind === 'object' && (
        <>
          <h2 className="mt-12 text-xl font-bold tracking-tight">Settings in {setting.key}</h2>
          <div className="mt-2 divide-y">
            {setting.field.settings.map((child) => (
              <Child key={child.key} setting={child} path={`${setting.key}.${child.key}`} depth={0} />
            ))}
          </div>
        </>
      )}

      <h2 className="mt-12 text-xl font-bold tracking-tight">Where it goes</h2>
      <p className="mt-3 leading-relaxed text-fd-muted-foreground">
        Codex reads its settings from these files. When a setting is in both, the project file wins.
      </p>
      <dl className="mt-4 grid gap-x-6 gap-y-3 rounded-xl border bg-fd-card p-5 text-sm sm:grid-cols-[auto_minmax(0,1fr)]">
        <Fact term="Your settings">
          <code className="font-mono text-[13px]">~/.codex/config.toml</code>, for all of your projects
        </Fact>
        <Fact term="Project">
          <code className="font-mono text-[13px]">.codex/config.toml</code>, which Codex reads only when you trust the project
        </Fact>
      </dl>
      <p className="mt-3 text-sm text-fd-muted-foreground">
        More in{' '}
        <Link href="/docs/scopes" className="underline underline-offset-4 hover:text-fd-foreground">
          Scopes and files
        </Link>{' '}
        and in the{' '}
        <a
          href="https://developers.openai.com/codex/config-reference"
          className="underline underline-offset-4 hover:text-fd-foreground"
        >
          Codex config reference
        </a>
        .
      </p>

      <section className="mt-12 rounded-2xl border bg-linear-to-br from-[#3b6ff0]/12 via-fd-card to-fd-card p-6">
        <h2 className="text-lg font-bold tracking-tight">Set it without writing TOML</h2>
        <p className="mt-1.5 text-fd-muted-foreground">
          Pick a value in the settings browser, and copy your config.toml. Or edit the files on your computer with Codexed.
        </p>
        <div className="mt-5 flex flex-col gap-3 sm:flex-row">
          <Link
            href={`/#settings-${category.id}`}
            className="group flex items-center justify-center gap-2 rounded-xl bg-linear-to-b from-[#4a7bf5] to-[#2f5fd6] px-5 py-2.5 text-sm font-semibold text-white shadow-sm ring-1 ring-white/20 transition hover:brightness-110"
          >
            Open the settings browser
            <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
          <Link
            href="/#codexed"
            className="flex items-center justify-center gap-2 rounded-xl border bg-fd-card px-5 py-2.5 text-sm font-semibold transition-colors hover:bg-fd-accent"
          >
            <Download className="size-4" />
            Get Codexed
          </Link>
        </div>
      </section>

      <h2 className="mt-12 text-xl font-bold tracking-tight">More {category.label} settings</h2>
      <ul className="mt-4 divide-y rounded-xl border bg-fd-card">
        {neighbors(entry).map((other) => (
          <li key={other.key}>
            <Link href={settingUrl(other.key)} className="block px-5 py-3.5 transition-colors hover:bg-fd-accent/50">
              <code className="font-mono text-sm font-semibold break-all">{other.key}</code>
              {other.description && (
                <span className="mt-0.5 block text-sm text-fd-muted-foreground">{summary(other.description, 120)}</span>
              )}
            </Link>
          </li>
        ))}
      </ul>
      <Link
        href="/settings"
        className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-[#2f5fd6] hover:underline dark:text-[#8cb4ff]"
      >
        All {count} settings
        <ArrowRight className="size-3.5" />
      </Link>
    </main>
  );
}

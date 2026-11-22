import { readFileSync } from 'node:fs';
import type { Metadata } from 'next';
import { JsonLd } from '@/lib/json-ld';
import { absoluteUrl, githubUrl } from '@/lib/shared';
import { CodexedCard } from './codexed-card';
import { ConfigNote } from './config-note';
import { Configuration } from './configuration';
import { Hero } from './hero';
import { getSettings } from './settings-data';

export const metadata: Metadata = {
  title: { absolute: 'Codex config.toml: every setting, in plain English' },
  description:
    'See what each Codex setting does, and set the ones you want. Then copy your config.toml, or paste your own to check it.',
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    url: '/',
    siteName: 'config.toml',
    images: { url: 'og.jpg', width: 1200, height: 600, alt: 'Codexed: edit every Codex setting with a form, not with TOML' },
  },
  twitter: { card: 'summary_large_image' },
};

const version = readFileSync('../VERSION', 'utf8').trim();

export default function HomePage() {
  const { categories, count, known } = getSettings();

  return (
    <main className="flex flex-1 flex-col gap-20 pb-24">
      <JsonLd
        data={{
          '@graph': [
            {
              '@type': 'WebSite',
              '@id': absoluteUrl('/#website'),
              name: 'config.toml',
              alternateName: 'codexconfig.com',
              url: absoluteUrl('/'),
              description: metadata.description,
              inLanguage: 'en',
            },
            {
              '@type': 'SoftwareApplication',
              name: 'Codexed',
              description:
                'A small, open-source app that edits your Codex config.toml, AGENTS.md files, MCP servers, skills and plugins with a form.',
              applicationCategory: 'DeveloperApplication',
              operatingSystem: 'macOS, Linux, Windows',
              softwareVersion: version,
              url: absoluteUrl('/#codexed'),
              downloadUrl: `${githubUrl}/releases/latest`,
              installUrl: absoluteUrl('/docs/installation'),
              screenshot: absoluteUrl('/codexed.jpg'),
              license: 'https://opensource.org/licenses/MIT',
              isAccessibleForFree: true,
              offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
              sameAs: [githubUrl],
            },
          ],
        }}
      />
      <Hero count={count} />

      <div className="relative mx-auto mt-8 w-full max-w-6xl px-4 sm:mt-56 sm:px-6">
        <ConfigNote />
        <Configuration categories={categories} known={known} />
      </div>

      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
        <CodexedCard />
      </div>
    </main>
  );
}

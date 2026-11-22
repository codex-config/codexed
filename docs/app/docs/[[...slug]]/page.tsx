import { source } from '@/lib/source';
import {
  DocsBody,
  DocsDescription,
  DocsPage,
  DocsTitle,
  MarkdownCopyButton,
  ViewOptionsPopover,
} from 'fumadocs-ui/layouts/docs/page';
import { notFound } from 'next/navigation';
import { getMDXComponents } from '@/components/mdx';
import type { Metadata } from 'next';
import { createRelativeLink } from 'fumadocs-ui/mdx';
import { JsonLd } from '@/lib/json-ld';
import { lastModified } from '@/lib/last-modified';
import { absoluteUrl, basePath, getPageGithubUrl, getPageImageUrl, getPageMarkdownUrl } from '@/lib/shared';

export default async function Page(props: PageProps<'/docs/[[...slug]]'>) {
  const params = await props.params;
  const page = source.getPage(params.slug);
  if (!page) notFound();

  const MDX = page.data.body;
  const markdownUrl = getPageMarkdownUrl(page);

  return (
    <DocsPage toc={page.data.toc} full={page.data.full}>
      <JsonLd
        data={{
          '@graph': [
            {
              '@type': 'TechArticle',
              headline: page.data.title,
              description: page.data.description,
              url: absoluteUrl(page.url),
              image: absoluteUrl(getPageImageUrl(page).url.slice(basePath.length)),
              dateModified: lastModified(`content/docs/${page.path}`)?.toISOString(),
              inLanguage: 'en',
              about: { '@type': 'SoftwareApplication', name: 'Codexed', applicationCategory: 'DeveloperApplication' },
            },
            {
              '@type': 'BreadcrumbList',
              itemListElement: [
                { '@type': 'ListItem', position: 1, name: 'Codexed docs', item: absoluteUrl('/docs') },
                ...(page.url === '/docs'
                  ? []
                  : [{ '@type': 'ListItem', position: 2, name: page.data.title, item: absoluteUrl(page.url) }]),
              ],
            },
          ],
        }}
      />
      <DocsTitle>{page.data.title}</DocsTitle>
      <DocsDescription className="mb-0">{page.data.description}</DocsDescription>
      <div className="flex flex-row gap-2 items-center border-b pb-6">
        <MarkdownCopyButton markdownUrl={markdownUrl} />
        <ViewOptionsPopover markdownUrl={markdownUrl} githubUrl={getPageGithubUrl(page)} />
      </div>
      <DocsBody>
        <MDX
          components={getMDXComponents({
            // this allows you to link to other pages with relative file paths
            a: createRelativeLink(source, page),
          })}
        />
      </DocsBody>
    </DocsPage>
  );
}

export async function generateStaticParams() {
  return source.generateParams();
}

export async function generateMetadata(props: PageProps<'/docs/[[...slug]]'>): Promise<Metadata> {
  const params = await props.params;
  const page = source.getPage(params.slug);
  if (!page) notFound();

  return {
    title: page.data.title,
    description: page.data.description,
    alternates: { canonical: page.url },
    openGraph: {
      type: 'article',
      url: page.url,
      siteName: 'Codexed',
      images: { url: getPageImageUrl(page).url, width: 1200, height: 630 },
    },
    twitter: { card: 'summary_large_image' },
  };
}

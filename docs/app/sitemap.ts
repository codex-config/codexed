import type { MetadataRoute } from 'next';
import { basePath, siteUrl } from '@/lib/shared';
import { source } from '@/lib/source';

export const dynamic = 'force-static';

export default function sitemap(): MetadataRoute.Sitemap {
  const url = (path: string) => `${siteUrl}${basePath}${path}`;
  return [
    { url: url('/'), changeFrequency: 'weekly', priority: 1 },
    ...source.getPages().map((page) => ({ url: url(page.url), changeFrequency: 'monthly' as const, priority: 0.7 })),
  ];
}

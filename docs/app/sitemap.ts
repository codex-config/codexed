import type { MetadataRoute } from 'next';
import { entries, settingUrl } from '@/app/(home)/settings/reference';
import { lastModified } from '@/lib/last-modified';
import { absoluteUrl } from '@/lib/shared';
import { source } from '@/lib/source';

export const dynamic = 'force-static';

export default function sitemap(): MetadataRoute.Sitemap {
  const settings = lastModified('app/(home)/config-schema.json');
  return [
    { url: absoluteUrl('/'), lastModified: lastModified('app/(home)') },
    { url: absoluteUrl('/settings'), lastModified: settings },
    ...entries.map(({ setting }) => ({ url: absoluteUrl(settingUrl(setting.key)), lastModified: settings })),
    ...source.getPages().map((page) => ({
      url: absoluteUrl(page.url),
      lastModified: lastModified(`content/docs/${page.path}`),
    })),
  ];
}

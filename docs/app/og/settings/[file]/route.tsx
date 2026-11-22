import { generateOGImage } from 'fumadocs-ui/og';
import { notFound } from 'next/navigation';
import { entries, findEntry, summary } from '@/app/(home)/settings/reference';

export const revalidate = false;
export const dynamicParams = false;

// The image of a setting page, as in /og/settings/model.png.
export async function GET(_req: Request, { params }: RouteContext<'/og/settings/[file]'>) {
  const entry = findEntry((await params).file.replace(/\.png$/, ''));
  if (!entry) notFound();

  return generateOGImage({
    title: entry.setting.key,
    description: summary(entry.setting.description, 140),
    site: 'Codex config.toml',
  });
}

export function generateStaticParams() {
  return entries.map(({ setting }) => ({ file: `${setting.key}.png` }));
}

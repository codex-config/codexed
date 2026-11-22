import { settingsMarkdown } from '@/app/(home)/settings/markdown';
import { docsLlms } from '@/lib/source';

export const revalidate = false;

export async function GET() {
  const docs = await (await docsLlms.serve('/llms-full.txt'))!.text();
  return new Response(`${docs}\n\n${settingsMarkdown()}`, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}

import { settingsMarkdown } from '@/app/(home)/settings/markdown';

export const revalidate = false;

export function GET() {
  return new Response(settingsMarkdown(), { headers: { 'Content-Type': 'text/markdown; charset=utf-8' } });
}

import { RootProvider } from 'fumadocs-ui/provider/next';
import './global.css';
import { Inter } from 'next/font/google';
import { basePath, siteUrl } from '@/lib/shared';
import type { Metadata } from 'next';

const inter = Inter({
  subsets: ['latin'],
});

export const metadata: Metadata = {
  metadataBase: new URL(basePath + '/', siteUrl),
  title: {
    template: '%s | Codexed',
    default: 'Codexed',
  },
  description: 'Manage your Codex config.toml, AGENTS.md files, skills, MCP servers and plugins from the browser.',
};

export default function Layout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en" className={inter.className} suppressHydrationWarning>
      <body className="flex flex-col min-h-screen">
        <RootProvider search={{ options: { type: 'static', api: `${basePath}/api/search` } }}>{children}</RootProvider>
      </body>
    </html>
  );
}

import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared';
import { appName, githubUrl } from './shared';

export function baseOptions(): BaseLayoutProps {
  return {
    nav: {
      title: appName,
    },
    links: [
      { text: 'Settings', url: '/settings', active: 'nested-url' },
      { text: 'Docs', url: '/docs', active: 'nested-url' },
    ],
    githubUrl,
  };
}

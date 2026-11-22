import { HomeLayout } from 'fumadocs-ui/layouts/home';
import { baseOptions } from '@/lib/layout.shared';
import { Footer } from './footer';

// The homepage is about config.toml, so its title says so. The docs keep the Codexed title.
export default function Layout({ children }: LayoutProps<'/'>) {
  const options = baseOptions();
  return (
    <HomeLayout {...options} nav={{ ...options.nav, title: <span className="font-mono font-semibold">config.toml</span> }}>
      {children}
      <Footer />
    </HomeLayout>
  );
}

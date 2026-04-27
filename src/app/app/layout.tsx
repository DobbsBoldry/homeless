import { CommsAdvisoryBanner } from '@/components/app-shell/comms-advisory-banner';
import { MobileNav } from '@/components/app-shell/mobile-nav';
import { navItemsForRole } from '@/components/app-shell/nav-config';
import { PendingBanner } from '@/components/app-shell/pending-banner';
import { Sidebar } from '@/components/app-shell/sidebar';
import { Topbar } from '@/components/app-shell/topbar';
import { requireUser } from '@/lib/auth';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const items = navItemsForRole(user.role);
  const brand = 'Daviess';

  return (
    <div className="grid min-h-screen md:grid-cols-[16rem_1fr]">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-background focus:px-3 focus:py-2 focus:shadow"
      >
        Skip to main content
      </a>
      <aside className="hidden md:block">
        <Sidebar items={items} brand={brand} />
      </aside>
      <div className="flex min-h-screen flex-col">
        <Topbar menuButton={<MobileNav items={items} brand={brand} />} />
        <CommsAdvisoryBanner />
        {user.role === 'pending' ? <PendingBanner /> : null}
        <main id="main-content" tabIndex={-1} className="flex-1 bg-background">
          {children}
        </main>
      </div>
    </div>
  );
}

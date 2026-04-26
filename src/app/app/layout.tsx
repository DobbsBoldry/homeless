import { MobileNav } from '@/components/app-shell/mobile-nav';
import { navItemsForRole } from '@/components/app-shell/nav-config';
import { Sidebar } from '@/components/app-shell/sidebar';
import { Topbar } from '@/components/app-shell/topbar';
import { requireUser } from '@/lib/auth';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const items = navItemsForRole(user.role);
  const brand = 'Daviess';

  return (
    <div className="grid min-h-screen md:grid-cols-[16rem_1fr]">
      <aside className="hidden md:block">
        <Sidebar items={items} brand={brand} />
      </aside>
      <div className="flex min-h-screen flex-col">
        <Topbar menuButton={<MobileNav items={items} brand={brand} />} />
        <main className="flex-1 bg-background">{children}</main>
      </div>
    </div>
  );
}

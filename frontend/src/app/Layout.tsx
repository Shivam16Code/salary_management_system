import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  BarChart3,
  Users,
  Building2,
  Layers,
  ArrowLeftRight,
  Database,
  Menu,
  X,
  Receipt,
  type LucideIcon,
} from 'lucide-react';

type NavItem = { path: string; label: string; icon: LucideIcon };

type NavSection = { id: string; label: string; items: NavItem[] };

const navSections: NavSection[] = [
  {
    id: 'overview',
    label: 'Overview',
    items: [{ path: '/', label: 'Dashboard', icon: BarChart3 }],
  },
  {
    id: 'workforce',
    label: 'Workforce',
    items: [
      { path: '/employees', label: 'Employees', icon: Users },
      { path: '/salary-records', label: 'Salary Records', icon: Receipt },
    ],
  },
  {
    id: 'configuration',
    label: 'Configuration',
    items: [
      { path: '/master-data', label: 'Master Data', icon: Database },
      { path: '/salary-components', label: 'Salary Components', icon: Layers },
      { path: '/exchange-rates', label: 'Exchange Rates', icon: ArrowLeftRight },
    ],
  },
];

function isActivePath(pathname: string, path: string) {
  return pathname === path || (path !== '/' && pathname.startsWith(path));
}

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const location = useLocation();

  return (
    <div className="sidebar-shell">
      <div className="sidebar-brand">
        <div className="sidebar-brand-mark" aria-hidden>
          <Building2 className="w-4 h-4" />
        </div>
        <div className="min-w-0">
          <p className="sidebar-brand-title">ACME</p>
          <p className="sidebar-brand-subtitle">Salary Management</p>
        </div>
      </div>

      <nav className="sidebar-nav" aria-label="Main">
        {navSections.map((section) => (
          <div key={section.id} className="sidebar-section">
            <p className="sidebar-section-label">{section.label}</p>
            <ul className="sidebar-section-list">
              {section.items.map(({ path, label, icon: Icon }) => {
                const active = isActivePath(location.pathname, path);
                return (
                  <li key={path}>
                    <Link
                      to={path}
                      onClick={onNavigate}
                      aria-current={active ? 'page' : undefined}
                      className={active ? 'nav-link-active' : 'nav-link-inactive'}
                    >
                      <Icon className="sidebar-nav-icon" aria-hidden />
                      <span>{label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="sidebar-footer">
        <div className="sidebar-footer-card">
          <div className="sidebar-footer-avatar" aria-hidden>HR</div>
          <div className="min-w-0">
            <p className="sidebar-footer-title">HR Manager</p>
            <p className="sidebar-footer-subtitle">Compensation portal</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Layout({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [mobileOpen]);

  const pageTitle =
    navSections
      .flatMap((section) => section.items)
      .find((item) => isActivePath(location.pathname, item.path))
      ?.label ?? 'ACME Salary';

  return (
    <div className="min-h-dvh flex bg-slate-50">
      <aside className="sidebar-desktop">
        <SidebarContent />
      </aside>

      {mobileOpen && (
        <button
          type="button"
          className="sidebar-backdrop"
          onClick={() => setMobileOpen(false)}
          aria-label="Close navigation menu"
        />
      )}

      <aside
        className={`sidebar-mobile ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}
        aria-hidden={!mobileOpen}
      >
        <div className="flex items-center justify-between gap-3 px-4 pt-4 pb-1">
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-slate-500">Menu</p>
          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            className="btn-icon text-slate-300 hover:bg-slate-800 hover:text-white"
            aria-label="Close menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <SidebarContent onNavigate={() => setMobileOpen(false)} />
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="sidebar-mobile-topbar">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="btn-icon -ml-1"
            aria-label="Open navigation menu"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-slate-900 truncate">{pageTitle}</p>
            <p className="text-xs text-slate-500 truncate">ACME Salary Management</p>
          </div>
        </header>

        <main className="flex-1 overflow-x-hidden">
          <div className="page-container">{children}</div>
        </main>
      </div>
    </div>
  );
}

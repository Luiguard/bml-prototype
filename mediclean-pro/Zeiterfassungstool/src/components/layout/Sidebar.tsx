'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';

interface NavItem {
  href: string;
  label: string;
  icon: string;
  roles?: string[];
}

interface NavSection {
  section: string;
  items: NavItem[];
}

const NAV_ITEMS: NavSection[] = [
  {
    section: 'Übersicht',
    items: [
      { href: '/', label: 'Dashboard', icon: '◻' },
    ],
  },
  {
    section: 'Erfassung',
    items: [
      { href: '/zeiterfassung', label: 'Zeiterfassung', icon: '⏱' },
      { href: '/abwesenheiten', label: 'Abwesenheiten', icon: '📅' },
      { href: '/dienstplan', label: 'Dienstplan', icon: '📋' },
    ],
  },
  {
    section: 'Verwaltung',
    items: [
      { href: '/dokumente', label: 'Dokumente', icon: '📁' },
      { href: '/benutzerverwaltung', label: 'Benutzer', icon: '👥', roles: ['HR_ADMIN', 'SYSTEM_ADMIN'] },
      { href: '/einstellungen', label: 'Einstellungen', icon: '⚙' },
    ],
  },
];

export default function Sidebar({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  const initials = user
    ? `${user.firstName.charAt(0)}${user.lastName.charAt(0)}`
    : '??';

  const roleLabels: Record<string, string> = {
    EMPLOYEE: 'Mitarbeiter',
    SUPERVISOR: 'Vorgesetzter',
    HR_ADMIN: 'HR/Admin',
    SYSTEM_ADMIN: 'System-Admin',
  };

  return (
    <>
      <div
        className={`sidebar-overlay${open ? ' open' : ''}`}
        onClick={onClose}
      />
      <aside className={`sidebar${open ? ' open' : ''}`}>
        <div className="sidebar-header">
          <div className="sidebar-logo">Z</div>
          <span className="sidebar-title">Zeiterfassung</span>
        </div>

        <nav className="sidebar-nav">
          {NAV_ITEMS.map((section) => {
            const visibleItems = section.items.filter(
              (item) => !item.roles || (user && item.roles.includes(user.role))
            );
            if (visibleItems.length === 0) return null;

            return (
              <div key={section.section} className="nav-section">
                <div className="nav-section-label">{section.section}</div>
                {visibleItems.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`nav-item${pathname === item.href ? ' active' : ''}`}
                    onClick={onClose}
                  >
                    <span className="nav-icon">{item.icon}</span>
                    {item.label}
                  </Link>
                ))}
              </div>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          <div className="user-info">
            <div className="user-avatar">{initials}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="user-name">
                {user ? `${user.firstName} ${user.lastName}` : '–'}
              </div>
              <div className="user-role">
                {user ? roleLabels[user.role] || user.role : '–'}
              </div>
            </div>
            <button
              className="btn btn-ghost btn-icon"
              onClick={logout}
              title="Abmelden"
              style={{ flexShrink: 0 }}
            >
              ⏻
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}

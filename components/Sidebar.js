'use client';
import { useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';

const navItems = [
  {
    section: 'Overview',
    items: [
      { label: 'Dashboard', href: '/', icon: '📊' },
    ],
  },
  {
    section: 'Data Entry',
    items: [
      { label: 'Party Master', href: '/parties', icon: '🏢' },
      { label: 'Transactions', href: '/transactions', icon: '📝' },
    ],
  },
  {
    section: 'Reports',
    items: [
      { label: 'Payment Report', href: '/reports/payment', icon: '💳' },
      { label: 'TDS Report', href: '/reports/tds', icon: '📋' },
    ],
  },
  {
    section: 'System',
    items: [
      { label: 'Settings', href: '/settings', icon: '⚙️' },
    ],
  },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleNav = (href) => {
    router.push(href);
    setMobileOpen(false);
  };

  const handleLogout = async () => {
    await logout();
    router.push('/login');
  };

  const userInitial = user?.email?.charAt(0)?.toUpperCase() || 'U';

  return (
    <>
      <button
        className="mobile-menu-btn"
        onClick={() => setMobileOpen(true)}
        aria-label="Open menu"
      >
        ☰
      </button>

      <div
        className={`sidebar-overlay ${mobileOpen ? 'open' : ''}`}
        onClick={() => setMobileOpen(false)}
      />

      <aside className={`sidebar ${mobileOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <div className="sidebar-logo">T</div>
          <div>
            <div className="sidebar-title">TDS/TCS Register</div>
            <div className="sidebar-subtitle">Tax Management</div>
          </div>
        </div>

        <nav className="sidebar-nav">
          {navItems.map((section) => (
            <div key={section.section}>
              <div className="sidebar-section-label">{section.section}</div>
              {section.items.map((item) => (
                <button
                  key={item.href}
                  className={`sidebar-link ${pathname === item.href ? 'active' : ''}`}
                  onClick={() => handleNav(item.href)}
                >
                  <span className="sidebar-icon">{item.icon}</span>
                  {item.label}
                </button>
              ))}
            </div>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-user">
            <div className="sidebar-avatar">{userInitial}</div>
            <div className="sidebar-user-info">
              <div className="sidebar-user-name">{user?.email?.split('@')[0] || 'User'}</div>
              <div className="sidebar-user-email">{user?.email || ''}</div>
            </div>
          </div>
          <button
            className="btn btn-ghost w-full mt-md"
            onClick={handleLogout}
            style={{ justifyContent: 'flex-start', paddingLeft: '14px' }}
          >
            🚪 Logout
          </button>
        </div>
      </aside>
    </>
  );
}

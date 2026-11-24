import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  BarChart3,
  Bell,
  Building2,
  ClipboardList,
  HelpCircle,
  LayoutDashboard,
  LogOut,
  Menu,
  Search,
  Settings,
  UserCircle,
  UserPlus,
  X,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';
import { useWorkspace } from '../../context/WorkspaceContext.jsx';
import { formatCurrency, getRecordDisplayTitle } from '../../utils/exportUtils.js';
import GlobalSearchModal from './GlobalSearchModal.jsx';

export default function AppLayout() {
  const { user, logout } = useAuth();
  const { t, businesses, deletedBusinesses, records, recycleBin, tickets, loading, error, refreshAll } = useWorkspace();
  const navigate = useNavigate();
  const location = useLocation();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifSeen, setNotifSeen] = useState(false);
  const notifRef = useRef(null);

  const navItems = useMemo(
    () => [
      { to: '/dashboard', label: t('nav_dashboard'), icon: LayoutDashboard, end: true },
      { to: '/dashboard/businesses', label: t('nav_businesses'), icon: Building2 },
      { to: '/dashboard/customers', label: t('nav_customers'), icon: UserPlus },
      { to: '/dashboard/records', label: t('nav_records'), icon: ClipboardList },
      { to: '/dashboard/reports', label: t('nav_reports'), icon: BarChart3 },
      { to: '/dashboard/profile', label: t('nav_profile'), icon: UserCircle },
      { to: '/dashboard/settings', label: t('nav_settings'), icon: Settings },
      { to: '/dashboard/help', label: t('nav_help'), icon: HelpCircle },
    ],
    [t]
  );

  useEffect(() => {
    function handleShortcut(e) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchOpen(true);
      }
    }
    window.addEventListener('keydown', handleShortcut);
    return () => window.removeEventListener('keydown', handleShortcut);
  }, []);

  useEffect(() => {
    setMobileMenuOpen(false);
    setNotifOpen(false);
  }, [location.pathname, location.search]);

  useEffect(() => {
    if (!notifOpen) return;
    function handleOutside(e) {
      if (notifRef.current && !notifRef.current.contains(e.target)) {
        setNotifOpen(false);
      }
    }
    function handleEsc(e) {
      if (e.key === 'Escape') setNotifOpen(false);
    }
    document.addEventListener('mousedown', handleOutside);
    window.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      window.removeEventListener('keydown', handleEsc);
    };
  }, [notifOpen]);

  const activeNav =
    navItems.find((item) =>
      item.end ? location.pathname === item.to : location.pathname.startsWith(item.to)
    ) || navItems[0];

  const notifications = useMemo(() => {
    const items = [];
    records.slice(0, 3).forEach((r) => {
      const biz = businesses.find((b) => b.id === r.businessId);
      items.push({
        id: `rec-${r.id}`,
        title: `Customer Record: ${getRecordDisplayTitle(r, biz)}`,
        detail: `${r.payment?.method || 'Cash'} · ${formatCurrency(r.payment?.amount)}`,
        to: `/dashboard/records?inspect=${r.id}`,
      });
    });
    const binTotal = recycleBin.length + deletedBusinesses.length;
    if (binTotal > 0) {
      items.push({
        id: 'bin-count',
        title: `${binTotal} ${binTotal === 1 ? 'item' : 'items'} in Recycle Bin`,
        detail: 'Can be restored within 30 days',
        to: '/dashboard/settings?tab=recycle-bin',
      });
    }
    const openTickets = tickets.filter((tk) => tk.status !== 'Resolved');
    if (openTickets.length > 0) {
      items.push({
        id: 'open-tickets',
        title: `${openTickets.length} open support ${openTickets.length === 1 ? 'ticket' : 'tickets'}`,
        detail: openTickets[0].subject,
        to: '/dashboard/help',
      });
    }
    return items;
  }, [businesses, records, recycleBin, deletedBusinesses, tickets]);

  const initials = (user?.fullName || 'FF')
    .split(' ')
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  function handleLogout() {
    try {
      window.sessionStorage.setItem('ff_explicit_logout', '1');
    } catch {
      // ignore storage errors
    }
    logout();
    navigate('/login', { replace: true });
  }

  function renderSidebarContent() {
    return (
      <div className="d-flex flex-column h-100 p-3">
        <div className="d-flex align-items-center justify-content-between px-2 pb-3 mb-3 border-bottom border-secondary border-opacity-25">
          <Link to="/" className="d-inline-flex align-items-center gap-2 text-decoration-none">
            <svg
              width="28"
              height="28"
              viewBox="0 0 28 28"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              <rect width="28" height="28" rx="7" fill="#7C3AED" />
              <rect x="7" y="7.5" width="14" height="3" rx="1.5" fill="#FFFFFF" />
              <rect x="7" y="13" width="10" height="3" rx="1.5" fill="#EDE9FE" />
              <rect x="7" y="18.5" width="6" height="3" rx="1.5" fill="#FFFFFF" />
            </svg>
            <span className="ff-display fw-bold fs-5 text-white">FormFlow</span>
          </Link>
          <button
            type="button"
            className="btn btn-sm text-light d-lg-none border-0"
            aria-label="Close navigation menu"
            onClick={() => setMobileMenuOpen(false)}
          >
            <X size={20} />
          </button>
        </div>

        <nav className="d-flex flex-column gap-1 flex-grow-1 ff-sidebar-nav" aria-label="Workspace navigation">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) => `ff-sidebar-link ${isActive ? 'active' : ''}`}
              >
                <Icon size={18} className="flex-shrink-0" />
                <span className="text-truncate">{item.label}</span>
              </NavLink>
            );
          })}
        </nav>

        <div className="pt-3 mt-3 border-top border-secondary border-opacity-25">
          <button
            type="button"
            onClick={handleLogout}
            className="ff-sidebar-link w-100 border-0 bg-transparent text-start"
            style={{ color: '#fca5a5' }}
          >
            <LogOut size={18} />
            <span>{t('nav_logout')}</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="ff-app-shell">
      <aside className="ff-sidebar d-none d-lg-flex">{renderSidebarContent()}</aside>

      {mobileMenuOpen && (
        <div
          className="d-lg-none position-fixed top-0 start-0 w-100 h-100"
          style={{ zIndex: 1050, backgroundColor: 'rgba(15, 23, 42, 0.5)' }}
          onClick={() => setMobileMenuOpen(false)}
        >
          <div
            className="ff-sidebar h-100"
            style={{ width: '270px' }}
            onClick={(e) => e.stopPropagation()}
          >
            {renderSidebarContent()}
          </div>
        </div>
      )}

      <div className="flex-grow-1 d-flex flex-column min-w-0">
        <header className="ff-topbar px-2 px-sm-3 px-lg-4 d-flex align-items-center justify-content-between gap-2 gap-sm-3">
          <div className="d-flex align-items-center gap-2 min-w-0">
            <button
              type="button"
              className="btn btn-light border d-lg-none d-inline-flex align-items-center justify-content-center p-0 flex-shrink-0"
              style={{ width: '38px', height: '38px' }}
              aria-label="Open navigation menu"
              onClick={() => setMobileMenuOpen(true)}
            >
              <Menu size={18} />
            </button>
            <div className="min-w-0">
              <div className="small text-secondary d-none d-sm-block text-truncate" style={{ fontSize: '0.75rem' }}>
                FormFlow Workspace / {activeNav.label}
              </div>
              <h1 className="h6 fw-bold mb-0 text-truncate">{activeNav.label}</h1>
            </div>
          </div>

          <div className="d-flex align-items-center gap-1 gap-sm-2 flex-shrink-0">
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              aria-label="Search workspace"
              className="btn btn-light border d-inline-flex align-items-center gap-2 text-secondary px-2 px-sm-3"
              style={{ maxWidth: '300px', minHeight: '38px' }}
            >
              <Search size={15} className="flex-shrink-0" />
              <span className="d-none d-md-inline small text-truncate">
                {t('search_placeholder')}
              </span>
              <span className="d-none d-sm-inline d-md-none small">Search</span>
            </button>

            <div className="position-relative" ref={notifRef}>
              <button
                type="button"
                className="btn btn-light border d-inline-flex align-items-center justify-content-center p-0 position-relative"
                style={{ width: '38px', height: '38px' }}
                aria-label="Notifications"
                aria-expanded={notifOpen}
                onClick={() => {
                  setNotifOpen((p) => !p);
                  setNotifSeen(true);
                }}
              >
                <Bell size={17} />
                {!notifSeen && notifications.length > 0 && (
                  <span
                    className="position-absolute badge rounded-pill bg-primary"
                    style={{ fontSize: '0.62rem', top: '-4px', right: '-4px' }}
                  >
                    {notifications.length}
                  </span>
                )}
              </button>

              {notifOpen && (
                <div className="ff-card ff-notif-popover mt-2 shadow-lg p-3">
                  <div className="d-flex justify-content-between align-items-center pb-2 mb-2 border-bottom">
                    <span className="fw-bold small">Notifications</span>
                    <button
                      type="button"
                      className="btn btn-sm p-0 border-0 text-secondary"
                      aria-label="Close notifications"
                      onClick={() => setNotifOpen(false)}
                    >
                      <X size={15} />
                    </button>
                  </div>
                  {notifications.length === 0 ? (
                    <div className="small text-secondary py-2">No recent notifications.</div>
                  ) : (
                    <div className="d-flex flex-column gap-2">
                      {notifications.map((n) => (
                        <button
                          key={n.id}
                          type="button"
                          onClick={() => {
                            setNotifOpen(false);
                            navigate(n.to);
                          }}
                          className="btn btn-light bg-white border text-start p-2"
                        >
                          <div className="fw-semibold small text-dark">{n.title}</div>
                          <div className="text-secondary" style={{ fontSize: '0.76rem' }}>
                            {n.detail}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            <Link
              to="/dashboard/profile"
              aria-label="Open profile"
              className="d-inline-flex align-items-center gap-2 text-decoration-none text-dark ps-1 ps-sm-2 border-start"
            >
              <div className="ff-avatar-circle ff-avatar-circle-sm-mobile">
                {user?.photoDataUrl ? (
                  <img src={user.photoDataUrl} alt={user.fullName} className="w-100 h-100 object-fit-cover" />
                ) : (
                  initials
                )}
              </div>
            </Link>
          </div>
        </header>

        <main className="flex-grow-1 min-w-0 p-3 p-lg-4">
          <div className="container-fluid px-0" style={{ maxWidth: '1320px' }}>
            {error && !loading && (
              <div className="alert alert-danger d-flex flex-wrap align-items-center justify-content-between gap-2 small mb-3" role="alert">
                <span>{error}</span>
                <button
                  type="button"
                  className="btn btn-sm btn-outline-danger"
                  onClick={() => refreshAll()}
                >
                  Retry
                </button>
              </div>
            )}
            {loading ? (
              <div className="ff-card p-5 text-center">
                <div className="spinner-border text-primary mb-3" role="status" />
                <p className="text-secondary mb-0">Loading workspace data...</p>
              </div>
            ) : (
              <Outlet />
            )}
          </div>
        </main>
      </div>

      <GlobalSearchModal open={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  );
}

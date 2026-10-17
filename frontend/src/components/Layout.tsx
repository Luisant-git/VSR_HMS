import { useState, useEffect, useMemo, type ReactElement } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { ChartNoAxesCombined, UserStar, LogOut, Menu, X, Settings2, ChevronDown, DoorClosed, UserRoundKey, ConciergeBell, Shapes, Braces, House } from 'lucide-react';
import { MenuPermissionAPI } from '../api/menuPermission.api';
import { getSystemSettings } from '../api/settings.api';

type NavChild = {
  label: string;
  to: string;
  /** Only standalone items (Dashboard) render an icon; children of a parent are text only */
  icon?: ReactElement;
  /** Shown only for this role (permissions are ignored) */
  role?: string;
  /** Shown when the role has ANY of these permission keys (before permissions load, everything shows) */
  perm?: string[];
  /** Match the route exactly instead of matching its child paths */
  end?: boolean;
};

type NavSection = {
  id: string;
  label: string;
  icon: ReactElement;
  children: NavChild[];
};

/** Canteen Master is the tab host, so any canteen permission opens it */
const CANTEEN_PERMISSIONS = [
  'canteen_master',
  'canteen_products',
  'canteen_categories',
  'canteen_units',
  'canteen_suppliers',
  'canteen_payment_modes',
  'canteen_purchase_entry',
  'canteen_purchase_reports',
  'canteen_supplier_payments',
];

/** Standalone item: no children, so no dropdown arrow */
const DASHBOARD: NavChild = {
  label: 'Dashboard',
  to: '/',
  icon: <ChartNoAxesCombined size={18} />,
  end: true,
  perm: ['dashboard'],
};

/** Parent menus and their child routes (mirrors the Menu Permission page) */
const NAV_SECTIONS: NavSection[] = [
  {
    id: 'hostellers',
    label: 'Hostellers',
    icon: <UserStar size={18} />,
    children: [
      { label: 'Hostellers', to: '/hostellers', perm: ['hostellers'], end: true },
      { label: 'Student Register', to: '/register', perm: ['student_register'] },
      { label: 'Gate Logs', to: '/gate-logs', perm: ['gate_logs'] },
      { label: 'Outpasses', to: '/outpass', perm: ['outpass'] },
      { label: 'Late Warnings', to: '/late-warnings', perm: ['late_warnings'] },
      { label: 'Clearance', to: '/clearance', perm: ['clearance'] },
      { label: 'Fees', to: '/fees', perm: ['fees'] },
      { label: 'Mess Attendance Reports', to: '/mess-attendance-reports', perm: ['mess_attendance_reports'] },
    ],
  },
  {
    id: 'rooms',
    label: 'Rooms',
    icon: <DoorClosed size={18} />,
    children: [
      { label: 'Hostel Blocks', to: '/rooms', perm: ['hostel_blocks'], end: true },
      { label: 'Rooms Master Directory', to: '/rooms/directory', perm: ['rooms_master'] },
      { label: 'Room EB Bill Sharing', to: '/rooms/eb-bills', perm: ['eb_bills'] },
    ],
  },
  {
    id: 'staff',
    label: 'Staff',
    icon: <UserRoundKey size={18} />,
    children: [
      { label: 'Staff Master', to: '/staff', perm: ['staff_master'], end: true },
      { label: 'Staff Gate In / Out', to: '/staff/attendance', perm: ['staff_attendance'] },
      { label: 'Staff Salary Register', to: '/staff/salary', perm: ['staff_salary'] },
    ],
  },
  {
    id: 'canteen',
    label: 'Canteen',
    icon: <ConciergeBell size={18} />,
    children: [
      { label: 'Canteen Master', to: '/canteen', perm: CANTEEN_PERMISSIONS },
      { label: 'Kitchen Construction', to: '/kitchen-construction', perm: ['kitchen_construction'] },
      { label: 'Stock Report', to: '/kitchen-stock-report', perm: ['stock_report'] },
    ],
  },
  {
    id: 'master',
    label: 'Master',
    icon: <Shapes size={18} />,
    children: [
      { label: 'College Master', to: '/colleges', perm: ['colleges'] },
    ],
  },
  {
    id: 'settings',
    label: 'Settings',
    icon: <Settings2 size={18} />,
    children: [
      { label: 'System Settings', to: '/settings/system-settings', perm: ['system_settings'] },
      { label: 'Fine Master', to: '/settings/fine-master', perm: ['fine_master'] },
      { label: 'Mess Deduction Master', to: '/settings/mess-deduction', perm: ['mess_deduction'] },
      { label: 'User Management', to: '/settings/user-management', perm: ['user_management'] },
      { label: 'Menu Permission', to: '/settings/menu-permission', perm: ['menu_permission'] },
    ],
  },
  {
    id: 'developer',
    label: 'Developer',
    icon: <Braces size={18} />,
    children: [
      { label: 'System Truncate', to: '/developer/settings', role: 'DEVELOPER' },
      { label: 'User Management', to: '/settings/user-management', role: 'DEVELOPER' },
      { label: 'Menu Permission', to: '/settings/menu-permission', role: 'DEVELOPER' },
    ],
  },
];

/** A child "owns" its route, and any deeper path under it */
const ownsRoute = (child: NavChild, path: string) =>
  path === child.to || (child.to !== '/' && path.startsWith(`${child.to}/`));

/** Which parent section a route belongs to (used to restore the open menu) */
const sectionForPath = (path: string) =>
  NAV_SECTIONS.find((section) => section.children.some((child) => ownsRoute(child, path)))?.id ?? null;

const Layout = () => {

  const navigate = useNavigate();
  const location = useLocation();

  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [user, setUser] = useState<{ name?: string, email?: string, role?: string } | null>(null);
  const [permissions, setPermissions] = useState<any>(null);
  const [hostelName, setHostelName] = useState<string>('Hostel Management System');
  // Accordion: only one parent section can be expanded at a time
  const [openMenu, setOpenMenu] = useState<string | null>(() => sectionForPath(location.pathname));

  useEffect(() => {
    getSystemSettings()
      .then((data) => {
        if (data?.hostelName) setHostelName(data.hostelName);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    try {
      const token = localStorage.getItem('access_token');
      if (token) {
        const payload = JSON.parse(atob(token.split('.')[1]));
        setUser(payload);
        if (payload.role) {
          MenuPermissionAPI.getByRole(payload.role).then(res => {
            const perms = res?.permissions || res;
            // Empty object (no record yet) => show all menus instead of hiding everything
            if (perms && typeof perms === 'object' && Object.keys(perms).length > 0) {
              setPermissions(perms);
            } else {
              setPermissions(null);
            }
          }).catch(console.error);
        }
      }
    } catch (e) {
      console.error('Failed to parse token');
    }
  }, []);

  const canSee = (item: NavChild) => {
    if (item.role) return user?.role === item.role;
    if (!item.perm) return true;
    return !permissions || item.perm.some((key) => permissions[key] === true);
  };

  // Sections that still have at least one visible child
  const sections = useMemo(
    () => NAV_SECTIONS
      .map((section) => ({ ...section, children: section.children.filter(canSee) }))
      .filter((section) => section.children.length > 0),
    [permissions, user?.role],
  );

  // Navigate to a child page (or refresh on one) => expand its parent
  useEffect(() => {
    const owner = sections.find((section) => section.children.some((child) => ownsRoute(child, location.pathname)));
    setOpenMenu(owner ? owner.id : null);
  }, [location.pathname, sections]);

  const toggleMenu = (id: string) => setOpenMenu((prev) => (prev === id ? null : id));

  return (
    <div className="app-layout">
      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div
          className="sidebar-overlay"
          onClick={() => setIsSidebarOpen(false)}
        ></div>
      )}

      {/* Sidebar */}
      <aside className={`sidebar ${isSidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-brand">
          <div className="brand-logo"><House size={22} /></div>
          <div className="brand-text">
            <span className="brand-title">HMS</span>
            <span className="brand-sub">Hostel Management</span>
          </div>
          <button
            className="mobile-close-btn"
            onClick={() => setIsSidebarOpen(false)}
            aria-label="Close menu"
          >
            <X size={20} />
          </button>
        </div>

        <nav className="sidebar-nav" onClick={() => setIsSidebarOpen(false)}>
          {/* Standalone item without children */}
          {canSee(DASHBOARD) && (
            <NavLink to={DASHBOARD.to} end className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
              <div className="nav-icon">{DASHBOARD.icon}</div>
              {DASHBOARD.label}
            </NavLink>
          )}

          {sections.map((section) => {
            const isOpen = openMenu === section.id;

            return (
              <div key={section.id} className={`nav-group ${isOpen ? 'open' : ''}`}>
                <button
                  type="button"
                  className="nav-parent"
                  aria-expanded={isOpen}
                  aria-controls={`nav-group-${section.id}`}
                  onClick={(event) => {
                    // Keep the mobile drawer open while toggling a group
                    event.stopPropagation();
                    toggleMenu(section.id);
                  }}
                >
                  <span className="nav-parent-icon">{section.icon}</span>
                  <span className="nav-parent-label">{section.label}</span>
                  <ChevronDown size={16} className="nav-caret" />
                </button>

                <div id={`nav-group-${section.id}`} className={`nav-children ${isOpen ? 'open' : ''}`}>
                  <div className="nav-children-inner">
                    {section.children.map((child) => (
                      <NavLink
                        key={child.to}
                        to={child.to}
                        end={child.end}
                        className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                      >
                        {child.label}
                      </NavLink>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}

          {/* BIOMETRICS
          <div className="nav-section">BIOMETRICS</div>
          <NavLink to="/biometrics" end className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <div className="nav-icon"><Database size={18} /></div>
            Dashboard
          </NavLink>
          <NavLink to="/biometrics/register" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <div className="nav-icon"><UserPlus size={18} /></div>
            Register Biometric
          </NavLink>
          <NavLink to="/biometrics/identify" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <div className="nav-icon"><ScanFace size={18} /></div>
            Scan & Identify
          </NavLink>
          <NavLink to="/biometrics/records" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <div className="nav-icon"><Fingerprint size={18} /></div>
            Biometric Records
          </NavLink>
          */}

          {/* 
          <div className="nav-section">CANTEEN</div>
          <NavLink to="/canteen" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <div className="nav-icon"><Coffee size={18} /></div>
            Meal In/Out Follows
          </NavLink>
          <NavLink to="/staff" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <div className="nav-icon"><Users size={18} /></div>
            Staff
          </NavLink>
          <NavLink to="/admin" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <div className="nav-icon"><Settings size={18} /></div>
            Admin
          </NavLink>
          */}
        </nav>

        {/* Logged-in user */}
        <div className="sidebar-footer">
          <div className="sidebar-user">
            <div className="sidebar-user-avatar">{user?.name ? user.name.charAt(0).toUpperCase() : 'A'}</div>
            <div className="sidebar-user-info">
              <span className="sidebar-user-name">{user?.name || 'Admin User'}</span>
              <span className="sidebar-user-role">{user?.role || 'ADMIN'}</span>
            </div>
          </div>
          <button
            className="sidebar-logout"
            onClick={() => {
              localStorage.removeItem('access_token');
              navigate('/login');
            }}
            aria-label="Logout"
            title="Logout"
          >
            <LogOut size={17} />
          </button>
        </div>
      </aside>

      {/* Right Side (Header + Content Wrapper) */}
      <div className="app-body">

        {/* Top Header */}
        <header className="topbar">

          <div className="topbar-left">
            {/* Mobile Menu Button (Visible only on mobile) */}
            <button className="mobile-menu-btn" onClick={() => setIsSidebarOpen(true)} aria-label="Open menu">
              <Menu size={22} />
            </button>

            <div className="topbar-title">
              <span className="topbar-title-main">{hostelName}</span>
            </div>
          </div>

          <div className="topbar-right">

            {/* Profile Dropdown Container */}
            <div style={{ position: 'relative' }}>
              <div className="topbar-user" onClick={() => setIsProfileOpen(!isProfileOpen)}>
                <div className="topbar-user-info">
                  <span className="topbar-user-name">{user?.name || 'Admin User'}</span>
                  <span className="topbar-user-role">{user?.role || 'ADMIN'}</span>
                </div>
                <div className="topbar-avatar">{user?.name ? user.name.charAt(0).toUpperCase() : 'A'}</div>
                <ChevronDown size={15} className="topbar-chevron" />
              </div>

              {/* Dropdown Menu (Click to open, click away to close) */}
              {isProfileOpen && (
                <>
                  {/* Invisible Overlay for click-outside */}
                  <div className="profile-overlay" onClick={() => setIsProfileOpen(false)}></div>

                  <div className="profile-dropdown">
                    <div className="profile-dropdown-head">
                      <div className="profile-name">{user?.name || 'Admin User'}</div>
                      <div className="profile-email">{user?.email || 'admin@hostel.com'}</div>
                      {user?.role && (
                        <span className="profile-role">{user.role}</span>
                      )}
                    </div>
                    <div className="profile-dropdown-body">
                      <button
                        className="profile-logout"
                        onClick={() => {
                          localStorage.removeItem('access_token');
                          navigate('/login');
                        }}
                      >
                        <LogOut size={16} /> Logout
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        {/* Main Wrapper */}
        <div className="main-wrapper">

          {/* Main Content Area */}
          <main className="main-content">

            {/* Render Pages */}
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
};

export default Layout;

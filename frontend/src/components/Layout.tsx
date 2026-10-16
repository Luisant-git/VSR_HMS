import { useState, useEffect } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { Home, Users, FileText, Grid, LogOut, UserPlus, AlertTriangle, CreditCard, Zap, List, Building2, ShieldAlert, Shield, Menu, X, AlertCircle, Settings, Utensils, Clock, Banknote, Package, ChevronDown } from 'lucide-react';
import { MenuPermissionAPI } from '../api/menuPermission.api';
import { formatDateDMY } from '../utils/date';

const Layout = () => {

  const navigate = useNavigate();

  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [user, setUser] = useState<{ name?: string, email?: string, role?: string } | null>(null);
  const [permissions, setPermissions] = useState<any>(null);

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
          <div className="brand-logo"><Building2 size={18} /></div>
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
          {(!permissions || permissions.dashboard === true) && (
            <NavLink to="/" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} end>
              <div className="nav-icon"><Home size={18} /></div>
              Dashboard
            </NavLink>
          )}

          {(!permissions || permissions.hostellers === true || permissions.student_register === true) && (
            <div className="nav-section">HOSTELLERS</div>
          )}

          {(!permissions || permissions.hostellers === true) && (
            <NavLink to="/hostellers" end className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
              <div className="nav-icon"><Users size={18} /></div>
              Hostellers
            </NavLink>
          )}

          {(!permissions || permissions.student_register === true) && (
            <NavLink to="/register" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
              <div className="nav-icon"><UserPlus size={18} /></div>
              Student Register
            </NavLink>
          )}

          {(!permissions || permissions.gate_logs === true) && (
            <NavLink to="/gate-logs" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
              <div className="nav-icon"><FileText size={18} /></div>
              Gate Logs
            </NavLink>
          )}

          {(!permissions || permissions.outpass === true) && (
            <NavLink to="/outpass" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
              <div className="nav-icon"><FileText size={18} /></div>
              Outpasses
            </NavLink>
          )}

          {(!permissions || permissions.late_warnings === true) && (
            <NavLink to="/late-warnings" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
              <div className="nav-icon"><AlertTriangle size={18} /></div>
              Late Warnings
            </NavLink>
          )}

          {(!permissions || permissions.clearance === true) && (
            <NavLink to="/clearance" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
              <div className="nav-icon"><FileText size={18} /></div>
              Clearance
            </NavLink>
          )}

          {(!permissions || permissions.fees === true) && (
            <NavLink to="/fees" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
              <div className="nav-icon"><CreditCard size={18} /></div>
              Fees
            </NavLink>
          )}

          {(!permissions || permissions.hostel_blocks === true || permissions.rooms_master === true || permissions.eb_bills === true) && (
            <div className="nav-section">ROOMS</div>
          )}
          
          {(!permissions || permissions.hostel_blocks === true) && (
            <NavLink to="/rooms" end className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
              <div className="nav-icon"><Grid size={18} /></div>
              Hostel Blocks
            </NavLink>
          )}

          {(!permissions || permissions.rooms_master === true) && (
            <NavLink to="/rooms/directory" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
              <div className="nav-icon"><List size={18} /></div>
              Rooms Master Directory
            </NavLink>
          )}

          {(!permissions || permissions.eb_bills === true) && (
            <NavLink to="/rooms/eb-bills" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
              <div className="nav-icon"><Zap size={18} /></div>
              Room EB Bill Sharing
            </NavLink>
          )}

          {(!permissions || permissions.colleges === true || permissions.staff_master === true || permissions.staff_attendance === true || permissions.staff_salary === true || permissions.canteen_master === true || permissions.mess_attendance_reports === true) && (
            <div className="nav-section">MASTER</div>
          )}
          {(!permissions || permissions.colleges === true) && (
            <NavLink to="/colleges" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
              <div className="nav-icon"><Building2 size={18} /></div>
              College Master
            </NavLink>
          )}
          {(!permissions || permissions.staff_master === true) && (
            <NavLink to="/staff" end className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
              <div className="nav-icon"><Users size={18} /></div>
              Staff Master
            </NavLink>
          )}
          {(!permissions || permissions.staff_attendance === true) && (
            <NavLink to="/staff/attendance" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
              <div className="nav-icon"><Clock size={18} /></div>
              Staff Gate In / Out
            </NavLink>
          )}
          {(!permissions || permissions.staff_salary === true) && (
            <NavLink to="/staff/salary" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
              <div className="nav-icon"><Banknote size={18} /></div>
              Staff Salary Register
            </NavLink>
          )}
          {(!permissions || permissions.canteen_master === true || permissions.canteen_products === true || permissions.canteen_categories === true || permissions.canteen_units === true || permissions.canteen_suppliers === true || permissions.canteen_payment_modes === true || permissions.canteen_purchase_entry === true || permissions.canteen_purchase_reports === true || permissions.canteen_supplier_payments === true) && (
            <NavLink to="/canteen" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
              <div className="nav-icon"><Utensils size={18} /></div>
              Canteen Master
            </NavLink>
          )}

          {(!permissions || permissions.mess_attendance_reports === true) && (
            <NavLink to="/mess-attendance-reports" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
              <div className="nav-icon"><FileText size={18} /></div>
              Mess Attendance Reports
            </NavLink>
          )}

          {(!permissions || permissions.kitchen_construction === true) && (
            <NavLink to="/kitchen-construction" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
              <div className="nav-icon"><Utensils size={18} /></div>
              Kitchen Construction
            </NavLink>
          )}

          {(!permissions || permissions.stock_report === true) && (
            <NavLink to="/kitchen-stock-report" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
              <div className="nav-icon"><Package size={18} /></div>
              Stock Report
            </NavLink>
          )}

          {(!permissions || permissions.fine_master === true || permissions.mess_deduction === true || permissions.user_management === true || permissions.menu_permission === true || permissions.system_settings === true) && (
            <div className="nav-section">SETTINGS</div>
          )}
          
          {(!permissions || permissions.system_settings === true) && (
            <NavLink to="/settings/system-settings" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
              <div className="nav-icon"><Settings size={18} /></div>
              System Settings
            </NavLink>
          )}

          {(!permissions || permissions.fine_master === true) && (
            <NavLink to="/settings/fine-master" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
              <div className="nav-icon"><AlertCircle size={18} /></div>
              Fine Master
            </NavLink>
          )}

          {(!permissions || permissions.mess_deduction === true) && (
            <NavLink to="/settings/mess-deduction" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
              <div className="nav-icon"><FileText size={18} /></div>
              Mess Deduction Master
            </NavLink>
          )}

          {(!permissions || permissions.user_management === true) && (
            <NavLink to="/settings/user-management" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
              <div className="nav-icon"><Shield size={18} /></div>
              User Management
            </NavLink>
          )}

          {(!permissions || permissions.menu_permission === true) && (
            <NavLink to="/settings/menu-permission" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
              <div className="nav-icon"><ShieldAlert size={18} /></div>
              Menu Permission
            </NavLink>
          )}

          {user?.role === 'DEVELOPER' && (
            <>
              <div className="nav-section">DEVELOPER</div>
              <NavLink to="/developer/settings" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                <div className="nav-icon"><Zap size={18} /></div>
                System Truncate
              </NavLink>
              <NavLink to="/settings/user-management" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                <div className="nav-icon"><Shield size={18} /></div>
                User Management
              </NavLink>
              <NavLink to="/settings/menu-permission" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                <div className="nav-icon"><ShieldAlert size={18} /></div>
                Menu Permission
              </NavLink>
            </>
          )}

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
      </aside>

      {/* Right Side (Header + Content Wrapper) */}
      <div className="app-body">

        {/* Top Header */}
        <header className="topbar">

          {/* Mobile Menu Button (Visible only on mobile) */}
          <button className="mobile-menu-btn" onClick={() => setIsSidebarOpen(true)} aria-label="Open menu">
            <Menu size={22} />
          </button>

          <div className="topbar-title">
            <span className="topbar-title-main">Welcome back</span>
            <span className="topbar-title-sub">{formatDateDMY(new Date())}</span>
          </div>

          <div className="topbar-icons">

            {/* Profile Dropdown Container */}
            <div style={{ position: 'relative' }}>
              <div className="topbar-user" onClick={() => setIsProfileOpen(!isProfileOpen)}>
                <div className="topbar-user-info">
                  <span className="topbar-user-name">{user?.name || 'Admin User'}</span>
                  <span className="topbar-user-role">{user?.role || 'ADMIN'}</span>
                </div>
                <div className="topbar-avatar">{user?.name ? user.name.charAt(0).toUpperCase() : 'A'}</div>
                <ChevronDown size={15} color="#94a3b8" />
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

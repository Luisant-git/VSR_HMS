import { useState, useEffect } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { Home, Users, FileText, Grid, LogOut, UserPlus, AlertTriangle, CreditCard, Zap, List, Building2 } from 'lucide-react';

const Layout = () => {

  const navigate = useNavigate();

  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [user, setUser] = useState<{ name?: string, email?: string } | null>(null);

  useEffect(() => {
    try {
      const token = localStorage.getItem('access_token');
      if (token) {
        const payload = JSON.parse(atob(token.split('.')[1]));
        setUser(payload);
      }
    } catch (e) {
      console.error('Failed to parse token');
    }
  }, []);

  return (
    <div className="app-layout">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-brand">
          HMS
        </div>

        <nav className="sidebar-nav">
          <NavLink to="/" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} end>
            <div className="nav-icon"><Home size={18} /></div>
            Dashboard
          </NavLink>
          <div style={{ fontSize: '11px', fontWeight: 700, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.05em', padding: '15px 15px 5px 15px', marginTop: '10px' }}>HOSTELLERS</div>
          <NavLink to="/hostellers" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <div className="nav-icon"><Users size={18} /></div>
            Hostellers
          </NavLink>
          <NavLink to="/register" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <div className="nav-icon"><UserPlus size={18} /></div>
            Student Register
          </NavLink>
          <NavLink to="/gate-logs" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <div className="nav-icon"><FileText size={18} /></div>
            Gate Logs
          </NavLink>
          <NavLink to="/outpass" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <div className="nav-icon"><FileText size={18} /></div>
            Outpasses
          </NavLink>
          <NavLink to="/late-warnings" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <div className="nav-icon"><AlertTriangle size={18} /></div>
            Late Warnings
          </NavLink>
          <NavLink to="/fees" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <div className="nav-icon"><CreditCard size={18} /></div>
            Fees
          </NavLink>

          <div style={{ fontSize: '11px', fontWeight: 700, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.05em', padding: '15px 15px 5px 15px', marginTop: '10px' }}>ROOMS</div>
          <NavLink to="/rooms" end className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <div className="nav-icon"><Grid size={18} /></div>
            Hostel Blocks
          </NavLink>
          <NavLink to="/rooms/directory" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <div className="nav-icon"><List size={18} /></div>
            Rooms Master Directory
          </NavLink>
          <NavLink to="/rooms/eb-bills" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <div className="nav-icon"><Zap size={18} /></div>
            Room EB Bill Sharing
          </NavLink>
          
          <div style={{ fontSize: '11px', fontWeight: 700, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.05em', padding: '15px 15px 5px 15px', marginTop: '10px' }}>ADMINISTRATION</div>
          <NavLink to="/colleges" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <div className="nav-icon"><Building2 size={18} /></div>
            College Master
          </NavLink>

          {/* BIOMETRICS
          <div style={{ fontSize: '11px', fontWeight: 700, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.05em', padding: '15px 15px 5px 15px', marginTop: '10px' }}>BIOMETRICS</div>
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
          <div style={{ fontSize: '11px', fontWeight: 700, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.05em', padding: '15px 15px 5px 15px', marginTop: '10px' }}>CANTEEN</div>
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
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>

        {/* Top Header (Dark, separate from white body) */}
        <header className="topbar" style={{ height: '55px', padding: '0 30px', display: 'flex', justifyContent: 'flex-end', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>

          <div className="topbar-icons" style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>

            {/* Profile Dropdown Container */}
            <div style={{ position: 'relative' }}>
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  background: 'var(--sidebar-active)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'white',
                  fontWeight: 600,
                  fontSize: '14px',
                  cursor: 'pointer',
                  border: '2px solid rgba(255,255,255,0.2)'
                }}
                onClick={() => setIsProfileOpen(!isProfileOpen)}
              >
                {user?.name ? user.name.charAt(0).toUpperCase() : 'A'}
              </div>

              {/* Dropdown Menu (Click to open, click away to close) */}
              {isProfileOpen && (
                <>
                  {/* Invisible Overlay for click-outside */}
                  <div
                    style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 99 }}
                    onClick={() => setIsProfileOpen(false)}
                  ></div>

                  <div
                    style={{
                      position: 'absolute',
                      top: '40px',
                      right: '0',
                      backgroundColor: 'white',
                      borderRadius: '8px',
                      boxShadow: '0 10px 25px rgba(0,0,0,0.1)',
                      width: '200px',
                      zIndex: 100,
                      overflow: 'hidden',
                      border: '1px solid var(--border-color)'
                    }}
                  >
                    <div style={{ padding: '15px', borderBottom: '1px solid var(--border-color)', backgroundColor: '#f8f9fa' }}>
                      <div style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: '14px' }}>{user?.name || 'Admin User'}</div>
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{user?.email || 'admin@hostel.com'}</div>
                    </div>
                    <div style={{ padding: '8px' }}>
                      <button
                        onClick={() => {
                          localStorage.removeItem('access_token');
                          navigate('/login');
                        }}
                        style={{
                          width: '100%',
                          padding: '10px 15px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                          background: 'transparent',
                          border: 'none',
                          color: '#d93025',
                          fontSize: '13px',
                          fontWeight: 500,
                          cursor: 'pointer',
                          borderRadius: '6px',
                          textAlign: 'left'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(217, 48, 37, 0.05)'}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
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

        {/* Main Wrapper (White card with rounded corner) */}
        <div className="main-wrapper" style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

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

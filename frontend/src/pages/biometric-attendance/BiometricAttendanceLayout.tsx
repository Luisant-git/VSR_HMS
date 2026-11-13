import { NavLink, Outlet } from 'react-router-dom';
import {
  CalendarCheck,
  CalendarRange,
  DoorClosed,
  Fingerprint,
  History,
  LayoutDashboard,
  LogIn,
  LogOut,
  Radio,
  Router,
  ShieldAlert,
  UserX,
} from 'lucide-react';
import { BiometricAttendanceAPI } from '../../api/biometricAttendance.api';
import { useApiData } from './hooks';
import { todayInput } from './utils';

const TABS = [
  { to: '/biometric-attendance', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/biometric-attendance/live-monitor', label: 'Live Punch Monitor', icon: Radio },
  { to: '/biometric-attendance/inside', label: 'Currently Inside', icon: LogIn },
  { to: '/biometric-attendance/outside', label: 'Currently Outside', icon: LogOut },
  { to: '/biometric-attendance/daily', label: 'Daily Attendance', icon: CalendarCheck },
  { to: '/biometric-attendance/absentees', label: 'Absentee Report', icon: UserX },
  { to: '/biometric-attendance/curfew', label: 'Curfew & Late Entry', icon: ShieldAlert },
  { to: '/biometric-attendance/room-wise', label: 'Room-wise Attendance', icon: DoorClosed },
  { to: '/biometric-attendance/monthly', label: 'Monthly Attendance', icon: CalendarRange },
  { to: '/biometric-attendance/student-history', label: 'Student Punch History', icon: History },
  { to: '/biometric-attendance/devices', label: 'Device & Sync Status', icon: Router },
];

const BiometricAttendanceLayout = () => {
  const { data: health, loading, error } = useApiData(() => BiometricAttendanceAPI.health(), []);

  const ready = Boolean(health?.ready);
  const statusClass = error ? 'is-error' : ready ? '' : 'is-warn';
  const statusText = loading
    ? 'Checking biometric data source...'
    : error
      ? 'Status check failed'
      : ready
        ? 'Live biometric feed connected'
        : 'Biometric schema not connected';

  const objectsOnline = health ? Object.values(health.objects || {}).filter(Boolean).length : 0;

  return (
    <div className="bio-module ui-page">
      <section className="bio-hero">
        <div className="bio-hero-main">
          <div className="bio-hero-icon">
            <Fingerprint size={27} />
          </div>
          <div>
            <div className="bio-hero-eyebrow">Hostel operations · Attendance intelligence</div>
            <h1 className="bio-hero-title">Biometric Attendance</h1>
            <p className="bio-hero-sub">
              Real-time student movement, inside/outside boards, daily registers, absentee follow-up,
              curfew checks and room-wise analytics — all driven by your biometric device punches.
            </p>
          </div>
        </div>
        <div className="bio-hero-side">
          <span className={`bio-live-pill ${statusClass}`}>
            <span className="bio-live-dot" />
            {statusText}
          </span>
          <div className="bio-hero-meta">
            <div>
              <span>Students</span>
              <strong>{loading ? '—' : (health?.totalStudents ?? 0).toLocaleString('en-IN')}</strong>
            </div>
            <div>
              <span>Data objects</span>
              <strong>{loading ? '—' : objectsOnline}</strong>
            </div>
            <div>
              <span>Snapshot</span>
              <strong>{todayInput().split('-').reverse().join('/')}</strong>
            </div>
          </div>
        </div>
      </section>

      <nav className="bio-tabs" aria-label="Biometric attendance sections">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          return (
            <NavLink
              key={tab.to}
              to={tab.to}
              end={tab.end}
              className={({ isActive }) => `bio-tab ${isActive ? 'is-active' : ''}`}
            >
              <Icon size={15} />
              {tab.label}
            </NavLink>
          );
        })}
      </nav>

      <div className="bio-body">
        <Outlet />
      </div>
    </div>
  );
};

export default BiometricAttendanceLayout;

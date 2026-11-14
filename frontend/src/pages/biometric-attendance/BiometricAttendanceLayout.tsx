import { NavLink, Outlet } from 'react-router-dom';
import {
  CalendarCheck,
  Fingerprint,
  LayoutDashboard,
  LogOut,
  Radio,
  Router,
} from 'lucide-react';
import { PageHeader } from '../../components/PageHeader';
import { BiometricAttendanceAPI } from '../../api/biometricAttendance.api';
import { useApiData } from './hooks';
import { todayInput } from './utils';

const TABS = [
  { to: '/biometric-attendance', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/biometric-attendance/live-monitor', label: 'Live Punch Monitor', icon: Radio },
  { to: '/biometric-attendance/outside', label: 'Currently Outside', icon: LogOut },
  { to: '/biometric-attendance/daily', label: 'Daily Attendance', icon: CalendarCheck },
  { to: '/biometric-attendance/devices', label: 'Device & Sync Status', icon: Router },
];

const BiometricAttendanceLayout = () => {
  const { data: health, loading, error } = useApiData(() => BiometricAttendanceAPI.health(), []);

  const ready = Boolean(health?.ready);
  const statusClass = error
    ? 'ui-badge ui-badge-danger'
    : loading
      ? 'ui-badge ui-badge-neutral'
      : ready
        ? 'ui-badge ui-badge-success'
        : 'ui-badge ui-badge-warning';
  const statusText = loading
    ? 'Checking biometric data source...'
    : error
      ? 'Status check failed'
      : ready
        ? 'Live biometric feed connected'
        : 'Biometric schema not connected';

  return (
    <div className="bio-module ui-page">
      <PageHeader
        title="Biometric Attendance"
        
        icon={<Fingerprint size={24} color="#fff" />}
        showBack={false}
        rightContent={
          <div className="bio-header-meta">
            <span className={statusClass}>{statusText}</span>
            <span className="bio-header-date">{todayInput().split('-').reverse().join('/')}</span>
          </div>
        }
      />

      <nav className="ui-tabs bio-tabs" aria-label="Biometric attendance sections">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          return (
            <NavLink
              key={tab.to}
              to={tab.to}
              end={tab.end}
              className={({ isActive }) => `ui-tab${isActive ? ' active' : ''}`}
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

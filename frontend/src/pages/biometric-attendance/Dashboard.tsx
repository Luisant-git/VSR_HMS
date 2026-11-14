import { Link } from 'react-router-dom';
import {
  Activity,
  ArrowUpRight,
  Clock3,
  LogIn,
  LogOut,
  Percent,
  Router,
  UserCheck,
} from 'lucide-react';
import { BiometricAttendanceAPI } from '../../api/biometricAttendance.api';
import { useApiData } from './hooks';
import {
  BioCardHead,
  BioErrorNotice,
  BioExportButton,
  BioPageHead,
  BioRefresh,
  BioStatGrid,
} from './components/BioUI';
import { downloadStamp, exportExcel, formatDate, formatTime, number, percent } from './utils';

const Dashboard = () => {
  const { data, loading, error, reload } = useApiData(() => BiometricAttendanceAPI.dashboard(), []);
  const stats = data?.stats;
  const recentPunches = data?.recentPunches || [];
  const deviceSummary = data?.deviceSummary;

  const handleExport = () => {
    if (!stats) return;
    exportExcel(
      [
        {
          name: 'Overview',
          rows: [
            { Metric: 'Total active students', Value: stats.totalStudents },
            { Metric: 'In hostel now (Present)', Value: stats.inside },
            { Metric: 'Currently outside (Away)', Value: stats.outside },
            { Metric: 'Hostel Presence rate', Value: percent(stats.attendanceRate) },
            { Metric: 'Students moved today', Value: stats.activeStudentsToday ?? 0 },
            { Metric: 'Punches today', Value: stats.punchesToday },
            { Metric: 'IN punches today', Value: stats.inToday },
            { Metric: 'OUT punches today', Value: stats.outToday },
            { Metric: 'Late entries', Value: stats.lateEntries },
          ],
        },
        {
          name: 'Recent punches',
          rows: recentPunches.map((punch) => ({
            Date: formatDate(punch.punch_date),
            Time: punch.time_of_punch || formatTime(punch.punch_time),
            Direction: punch.direction,
            Student: punch.student_name,
            'Register No': punch.reg_no,
            Room: punch.room_no || '',
            Bed: punch.bed_no || '',
            'Verified by': punch.verified_by || '',
            Device: punch.gate_name || '',
          })),
        },
      ],
      `biometric-dashboard-${downloadStamp()}.xlsx`,
    );
  };

  return (
    <>
      <BioPageHead
        title="Attendance command centre"
        subtitle={`Live hostel movement snapshot for ${formatDate(data?.date)}`}
        actions={
          <>
            <BioRefresh onClick={reload} loading={loading} />
            <BioExportButton onClick={handleExport} disabled={!stats} />
          </>
        }
      />

      {error ? <BioErrorNotice message={error} onRetry={reload} /> : null}

      <div style={{ marginTop: 14 }}>
        <BioStatGrid
          items={[
            {
              label: 'In Hostel (Present)',
              value: stats?.inside ?? stats?.presentToday ?? '—',
              sub: `Inside hostel (${percent(stats?.attendanceRate)})`,
              icon: <LogIn size={19} />,
              tone: 'success',
            },
            {
              label: 'Currently Outside',
              value: stats?.outside ?? '—',
              sub: (stats?.outside || 0) > 0 ? 'Punched OUT (Awaiting return)' : 'All hostellers inside',
              icon: <LogOut size={19} />,
              tone: (stats?.outside || 0) > 0 ? 'warning' : 'neutral',
            },
            {
              label: 'Movement Today',
              value: stats?.activeStudentsToday ?? ((stats?.inToday ?? 0) + (stats?.outToday ?? 0)),
              sub: `${stats?.outToday ?? 0} OUT · ${stats?.inToday ?? 0} IN`,
              icon: <Activity size={19} />,
              tone: 'accent',
            },
            {
              label: 'Total Hostellers',
              value: stats?.totalStudents ?? '—',
              sub: 'Active hostel roll',
              icon: <UserCheck size={19} />,
              tone: 'info',
            },
            {
              label: 'Punches Today',
              value: stats?.punchesToday ?? '—',
              sub: `${stats?.inToday ?? 0} IN · ${stats?.outToday ?? 0} OUT`,
              icon: <Clock3 size={19} />,
              tone: 'purple',
            },
          ]}
        />
      </div>

      <div className="bio-grid-2" style={{ marginTop: 16 }}>
        <div className="bio-card">
          <BioCardHead
            title="Hostel Presence Rate"
            subtitle="Share of active hostellers currently inside the hostel"
            icon={<Percent size={17} />}
          />
          <div className="bio-card-body">
            <div className="bio-ring-wrap">
              <div className="bio-ring">
                <svg width="108" height="108" viewBox="0 0 108 108" aria-hidden="true">
                  <circle cx="54" cy="54" r="46" fill="none" stroke="#eef2f8" strokeWidth="10" />
                  <circle
                    cx="54"
                    cy="54"
                    r="46"
                    fill="none"
                    stroke="url(#bioRingGradient)"
                    strokeWidth="10"
                    strokeLinecap="round"
                    strokeDasharray={`${(289 * Math.min(100, number(stats?.attendanceRate))) / 100} 289`}
                  />
                  <defs>
                    <linearGradient id="bioRingGradient" x1="0" y1="0" x2="1" y2="1">
                      <stop offset="0%" stopColor="#16a34a" />
                      <stop offset="100%" stopColor="#15803d" />
                    </linearGradient>
                  </defs>
                </svg>
                <div className="bio-ring-center">
                  <strong>{percent(stats?.attendanceRate)}</strong>
                  <span>Inside</span>
                </div>
              </div>
              <div className="bio-ring-copy">
                <div className="bio-legend">
                  <i style={{ background: '#16a34a' }} /> Inside Hostel <strong>{stats?.inside ?? 0}</strong>
                </div>
                <div className="bio-legend">
                  <i style={{ background: '#ea580c' }} /> Outside <strong>{stats?.outside ?? 0}</strong>
                </div>
                <div className="bio-legend">
                  <i style={{ background: '#c7d2fe' }} /> Total Roll <strong>{stats?.totalStudents ?? 0}</strong>
                </div>
                <div className="bio-legend">
                  <i style={{ background: '#f59e0b' }} /> Late <strong>{stats?.lateEntries ?? 0}</strong>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="bio-card">
          <BioCardHead
            title="Device health"
            subtitle="Terminal connectivity and sync throughput"
            icon={<Router size={17} />}
            action={
              <Link className="ui-btn ui-btn-secondary ui-btn-sm" to="/biometric-attendance/devices">
                Device status <ArrowUpRight size={14} />
              </Link>
            }
          />
          <div className="bio-card-body">
            <div className="bio-device-grid-inner" style={{ borderTop: 0, paddingTop: 0 }}>
              <div>
                <span>Devices</span>
                <strong>{deviceSummary?.total ?? 0}</strong>
              </div>
              <div>
                <span>Online</span>
                <strong style={{ color: '#15803d' }}>{deviceSummary?.online ?? 0}</strong>
              </div>
              <div>
                <span>Offline</span>
                <strong style={{ color: '#b91c1c' }}>{deviceSummary?.offline ?? 0}</strong>
              </div>
              <div>
                <span>Records synced</span>
                <strong>{number(deviceSummary?.totalRecords).toLocaleString('en-IN')}</strong>
              </div>
              <div>
                <span>Sync errors</span>
                <strong>{deviceSummary?.syncErrors ?? 0}</strong>
              </div>
              <div>
                <span>Last successful sync</span>
                <strong>{deviceSummary?.lastSuccessfulSync || '—'}</strong>
              </div>
            </div>
          </div>
        </div>
      </div>

    </>
  );
};

export default Dashboard;

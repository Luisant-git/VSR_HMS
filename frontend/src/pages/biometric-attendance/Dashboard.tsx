import { Link } from 'react-router-dom';
import {
  Activity,
  ArrowUpRight,
  Clock3,
  LogIn,
  LogOut,
  Percent,
  Router,
  ShieldAlert,
  TrendingUp,
  UserCheck,
  UserX,
} from 'lucide-react';
import { BiometricAttendanceAPI } from '../../api/biometricAttendance.api';
import { useApiData } from './hooks';
import {
  BioCardHead,
  BioEmpty,
  BioErrorNotice,
  BioExportButton,
  BioPageHead,
  BioRefresh,
  BioSafetyStrip,
  BioStatGrid,
  BioTableState,
  DirectionBadge,
} from './components/BioUI';
import { downloadStamp, exportExcel, formatDate, formatTime, number, percent } from './utils';

const Dashboard = () => {
  const { data, loading, error, reload } = useApiData(() => BiometricAttendanceAPI.dashboard(), []);
  const stats = data?.stats;
  const recentPunches = data?.recentPunches || [];
  const weeklyTrend = data?.weeklyTrend || [];
  const deviceSummary = data?.deviceSummary;

  const maxTrend = Math.max(
    1,
    ...weeklyTrend.map((point) => Math.max(number(point.present), number(point.punches))),
  );

  const handleExport = () => {
    if (!stats) return;
    exportExcel(
      [
        {
          name: 'Overview',
          rows: [
            { Metric: 'Total active students', Value: stats.totalStudents },
            { Metric: 'Present today', Value: stats.presentToday },
            { Metric: 'Absent today', Value: stats.absentToday },
            { Metric: 'Currently inside', Value: stats.inside },
            { Metric: 'Currently outside', Value: stats.outside },
            { Metric: 'Punches today', Value: stats.punchesToday },
            { Metric: 'IN punches', Value: stats.inToday },
            { Metric: 'OUT punches', Value: stats.outToday },
            { Metric: 'Late entries', Value: stats.lateEntries },
            { Metric: 'Attendance rate', Value: percent(stats.attendanceRate) },
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

      {stats ? <BioSafetyStrip inside={stats.inside} outside={stats.outside} late={stats.lateEntries} /> : null}

      <div style={{ marginTop: 14 }}>
        <BioStatGrid
          items={[
            {
              label: 'Present today',
              value: stats?.presentToday ?? '—',
              sub: `${percent(stats?.attendanceRate)} attendance`,
              icon: <UserCheck size={19} />,
              tone: 'success',
            },
            {
              label: 'Absent today',
              value: stats?.absentToday ?? '—',
              sub: 'Awaiting first punch',
              icon: <UserX size={19} />,
              tone: 'danger',
            },
            {
              label: 'Currently inside',
              value: stats?.inside ?? '—',
              sub: 'Inside hostel now',
              icon: <LogIn size={19} />,
              tone: 'accent',
            },
            {
              label: 'Currently outside',
              value: stats?.outside ?? '—',
              sub: 'Marked OUT',
              icon: <LogOut size={19} />,
              tone: 'warning',
            },
            {
              label: 'Punches today',
              value: stats?.punchesToday ?? '—',
              sub: `${stats?.inToday ?? 0} IN · ${stats?.outToday ?? 0} OUT`,
              icon: <Activity size={19} />,
              tone: 'info',
            },
          ]}
        />
      </div>

      <div className="bio-grid-2" style={{ marginTop: 16 }}>
        <div className="bio-card">
          <BioCardHead
            title="Attendance rate"
            subtitle="Share of active hostellers who punched in today"
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
                      <stop offset="0%" stopColor="#4a72fa" />
                      <stop offset="100%" stopColor="#3b5bdb" />
                    </linearGradient>
                  </defs>
                </svg>
                <div className="bio-ring-center">
                  <strong>{percent(stats?.attendanceRate)}</strong>
                  <span>Today</span>
                </div>
              </div>
              <div className="bio-ring-copy">
                <div className="bio-legend">
                  <i style={{ background: '#4a72fa' }} /> Present <strong>{stats?.presentToday ?? 0}</strong>
                </div>
                <div className="bio-legend">
                  <i style={{ background: '#e2e8f0' }} /> Absent <strong>{stats?.absentToday ?? 0}</strong>
                </div>
                <div className="bio-legend">
                  <i style={{ background: '#c7d2fe' }} /> Total <strong>{stats?.totalStudents ?? 0}</strong>
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

      <div className="bio-card">
        <BioCardHead
          title="7-day attendance trend"
          subtitle="Unique students present and total punches per day"
          icon={<TrendingUp size={17} />}
        />
        <div className="bio-card-body">
          {weeklyTrend.length === 0 ? (
            <BioEmpty
              title="No trend data yet"
              text="Daily biometric punches will appear here once the device sync starts recording attendance."
              icon={<TrendingUp size={28} />}
            />
          ) : (
            <div className="bio-chart">
              {weeklyTrend.map((point) => {
                const presentHeight = Math.max(4, (number(point.present) / maxTrend) * 100);
                const punchHeight = Math.max(4, (number(point.punches) / maxTrend) * 100);
                const day = new Date(`${point.date}T00:00:00`).toLocaleDateString('en-IN', { weekday: 'short' });
                return (
                  <div className="bio-chart-col" key={point.date}>
                    <div className="bio-chart-value">{point.present}</div>
                    <div className="bio-chart-bars">
                      <span className="bio-chart-bar" style={{ height: `${presentHeight}%` }} title={`${point.present} students present`} />
                      <span className="bio-chart-bar is-soft" style={{ height: `${punchHeight}%` }} title={`${point.punches} punches`} />
                    </div>
                    <div className="bio-chart-label">{day}</div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="bio-card">
        <BioCardHead
          title="Recent biometric punches"
          subtitle="Newest IN / OUT movements recorded today"
          icon={<Clock3 size={17} />}
          action={
            <Link className="ui-btn ui-btn-secondary ui-btn-sm" to="/biometric-attendance/live-monitor">
              Live monitor <ArrowUpRight size={14} />
            </Link>
          }
        />
        <div className="bio-table-wrap">
          <table className="ui-table bio-table">
            <thead>
              <tr>
                <th>Time</th>
                <th>Student</th>
                <th>Direction</th>
                <th>Room / Bed</th>
                <th>Verified by</th>
                <th>Device</th>
              </tr>
            </thead>
            <tbody>
              <BioTableState
                loading={loading && !data}
                error={error && !data ? error : null}
                empty={recentPunches.length === 0}
                colSpan={6}
                emptyTitle="No punches recorded today"
                emptyText="Once a student scans at a biometric terminal, the movement will show up here instantly."
                onRetry={reload}
              />
              {recentPunches.map((punch) => (
                <tr key={punch.id}>
                  <td className="bio-time">{punch.time_of_punch || formatTime(punch.punch_time)}</td>
                  <td>
                    <div className="bio-person">
                      <div className="bio-avatar">{String(punch.student_name || '?').slice(0, 2).toUpperCase()}</div>
                      <div>
                        <div className="bio-person-name">{punch.student_name || 'Unregistered'}</div>
                        <div className="bio-person-meta">{punch.reg_no}</div>
                      </div>
                    </div>
                  </td>
                  <td><DirectionBadge direction={punch.direction} /></td>
                  <td>
                    <div className="bio-cell-stack">
                      <span className="bio-strong">{punch.room_no || '—'}</span>
                      <span>{punch.bed_no || 'No bed'}</span>
                    </div>
                  </td>
                  <td className="bio-subtle">{punch.verified_by || '—'}</td>
                  <td className="bio-subtle">{punch.gate_name || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bio-card">
        <BioCardHead
          title="Safety watch"
          subtitle="Quick view of students currently outside the hostel"
          icon={<ShieldAlert size={17} />}
        />
        <div className="bio-card-body">
          <BioSafetyStrip inside={stats?.inside ?? 0} outside={stats?.outside ?? 0} late={stats?.lateEntries ?? 0} />
          <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Link className="ui-btn ui-btn-secondary ui-btn-sm" to="/biometric-attendance/outside">
              <LogOut size={14} /> View students outside
            </Link>
            <Link className="ui-btn ui-btn-secondary ui-btn-sm" to="/biometric-attendance/inside">
              <LogIn size={14} /> View students inside
            </Link>
            <Link className="ui-btn ui-btn-secondary ui-btn-sm" to="/biometric-attendance/curfew">
              <ShieldAlert size={14} /> Curfew violations
            </Link>
          </div>
        </div>
      </div>
    </>
  );
};

export default Dashboard;

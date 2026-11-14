import { useEffect, useState } from 'react';
import { Activity, Clock3, LogIn, LogOut, UserCheck } from 'lucide-react';
import { BiometricAttendanceAPI } from '../../api/biometricAttendance.api';
import { useApiData } from './hooks';
import {
  BioErrorNotice,
  BioExportButton,
  BioField,
  BioPageHead,
  BioPager,
  BioRefresh,
  BioSearchField,
  BioStatGrid,
  BioTableState,
  DirectionBadge,
} from './components/BioUI';
import { downloadStamp, exportExcel, formatDate, formatTime, todayInput } from './utils';

const LIMIT = 15;

const LiveMonitor = () => {
  const today = todayInput();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [fromDate, setFromDate] = useState(today);
  const [toDate, setToDate] = useState(today);
  const [direction, setDirection] = useState('');
  const [autoRefresh, setAutoRefresh] = useState(true);

  const { data, loading, error, reload } = useApiData(
    () =>
      BiometricAttendanceAPI.punchLogs({
        page,
        limit: LIMIT,
        search: search.trim(),
        fromDate,
        toDate,
        direction,
      }),
    [page, search, fromDate, toDate, direction],
  );
  const {
    data: dashboard,
    loading: dashboardLoading,
    error: dashboardError,
    reload: reloadDashboard,
  } = useApiData(() => BiometricAttendanceAPI.dashboard(), []);

  useEffect(() => {
    setPage(1);
  }, [search, fromDate, toDate, direction]);

  useEffect(() => {
    if (!autoRefresh) return;
    const timer = window.setInterval(() => {
      reload();
      reloadDashboard();
    }, 20000);
    return () => window.clearInterval(timer);
  }, [autoRefresh, reload, reloadDashboard]);

  const rows = data?.data || [];
  const todayStats = dashboard?.stats;
  const refreshAll = () => {
    reload();
    reloadDashboard();
  };

  const resetRange = () => {
    setFromDate(today);
    setToDate(today);
    setPage(1);
  };

  const handleExport = () => {
    if (!rows.length) return;
    exportExcel(
      [
        {
          name: 'Punch log',
          rows: rows.map((punch) => ({
            Date: formatDate(punch.punch_date),
            Time: punch.time_of_punch || formatTime(punch.punch_time),
            'User PIN': punch.user_pin || '',
            Student: punch.student_name,
            Room: punch.room_no || '',
            Movement: punch.direction,
            'Verify mode': punch.verified_by || '',
            'Device ID': punch.device_id || '',
          })),
        },
      ],
      `biometric-punch-log-${downloadStamp()}.xlsx`,
    );
  };

  return (
    <>
      <BioPageHead
        title="Live punch monitor"
        subtitle="Every biometric IN / OUT movement, newest first"
        actions={
          <>
            <label className="bio-check">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(event) => setAutoRefresh(event.target.checked)}
              />
              Auto-refresh 20s
            </label>
            <BioRefresh onClick={refreshAll} loading={loading || dashboardLoading} />
            <BioExportButton onClick={handleExport} disabled={!rows.length} />
          </>
        }
      />

      {error ? <BioErrorNotice message={error} onRetry={reload} /> : null}
      {dashboardError ? <BioErrorNotice message={dashboardError} onRetry={reloadDashboard} /> : null}

      <div style={{ marginTop: 14 }}>
        <BioStatGrid
          items={[
            { label: 'Punches today', value: todayStats?.punchesToday ?? (dashboardLoading ? '…' : '—'), sub: 'Recorded today', icon: <Activity size={19} />, tone: 'accent' },
            { label: 'Students active today', value: todayStats?.presentToday ?? (dashboardLoading ? '…' : '—'), sub: 'Unique hostellers', icon: <UserCheck size={19} />, tone: 'info' },
            { label: 'Currently inside hostel', value: todayStats?.inside ?? (dashboardLoading ? '…' : '—'), sub: 'Inside now', icon: <LogIn size={19} />, tone: 'success' },
            { label: 'Currently outside', value: todayStats?.outside ?? (dashboardLoading ? '…' : '—'), sub: 'Outside now', icon: <LogOut size={19} />, tone: 'warning' },
          ]}
        />
      </div>

      <div className="bio-card" style={{ marginTop: 16 }}>
        <div className="bio-toolbar">
          <div className="bio-filters">
            <BioSearchField value={search} onChange={setSearch} />
            <BioField label="From">
              <input type="date" className="ui-input ui-input--inline" value={fromDate} onChange={(event) => setFromDate(event.target.value)} />
            </BioField>
            <BioField label="To">
              <input type="date" className="ui-input ui-input--inline" value={toDate} onChange={(event) => setToDate(event.target.value)} />
            </BioField>
            <BioField label="Direction">
              <select className="ui-select" value={direction} onChange={(event) => setDirection(event.target.value)}>
                <option value="">All movements</option>
                <option value="IN">IN only</option>
                <option value="OUT">OUT only</option>
              </select>
            </BioField>
            <button type="button" className="ui-btn ui-btn-secondary ui-btn-sm" onClick={resetRange}>
              Today
            </button>
          </div>
          <div className="bio-toolbar-actions">
            <button type="button" className="ui-btn ui-btn-primary ui-btn-sm" onClick={refreshAll} disabled={loading || dashboardLoading}>
              <Clock3 size={14} /> Refresh now
            </button>
          </div>
        </div>

        <div className="bio-table-wrap">
          <table className="ui-table bio-table">
            <thead>
              <tr>
                <th>Date / time</th>
                <th>User PIN</th>
                <th>Student name</th>
                <th>Room no.</th>
                <th>Movement</th>
                <th>Verify mode</th>
                <th>Device ID</th>
              </tr>
            </thead>
            <tbody>
              <BioTableState
                loading={loading && !data}
                error={error && !data ? error : null}
                empty={rows.length === 0}
                colSpan={7}
                emptyTitle="No punches in this range"
                emptyText="Try a wider date range, clear the search, or switch the direction filter."
                onRetry={reload}
              />
              {rows.map((punch) => (
                <tr key={punch.id}>
                  <td>
                    <div className="bio-cell-stack">
                      <span className="bio-time">{formatDate(punch.punch_date)}</span>
                      <span>{punch.time_of_punch || formatTime(punch.punch_time)}</span>
                    </div>
                  </td>
                  <td className="bio-subtle">{punch.user_pin || '—'}</td>
                  <td>
                    <div className="bio-person">
                      <div className="bio-avatar">{String(punch.student_name || '?').slice(0, 2).toUpperCase()}</div>
                      <div>
                        <div className="bio-person-name">{punch.student_name || 'Unregistered'}</div>
                      </div>
                    </div>
                  </td>
                  <td className="bio-subtle">{punch.room_no || '—'}</td>
                  <td><DirectionBadge direction={punch.direction} /></td>
                  <td className="bio-subtle">{punch.verified_by || '—'}</td>
                  <td className="bio-subtle">{punch.device_id || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {data?.pagination ? (
          <BioPager
            page={data.pagination.page}
            totalPages={data.pagination.totalPages}
            total={data.pagination.total}
            limit={data.pagination.limit}
            onPage={setPage}
          />
        ) : null}
      </div>

    </>
  );
};

export default LiveMonitor;

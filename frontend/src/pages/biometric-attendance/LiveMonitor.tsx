import { useEffect, useState } from 'react';
import {
  Activity,
  ArrowDownLeft,
  ArrowUpRight,
  Building2,
  Clock3,
  UserCheck,
} from 'lucide-react';
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
  const [refreshInterval, setRefreshInterval] = useState<number>(5);

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
    if (refreshInterval <= 0) return;
    const timer = window.setInterval(() => {
      // Pause automatic polling if the browser tab is hidden/minimized
      if (typeof document !== 'undefined' && document.hidden) return;
      reload();
      reloadDashboard();
    }, refreshInterval * 1000);
    return () => window.clearInterval(timer);
  }, [refreshInterval, reload, reloadDashboard]);

  const rows = data?.data || [];
  const todayStats = dashboard?.stats;
  const isToday = fromDate === today && toDate === today && !search.trim();

  const punchesCount = isToday
    ? (todayStats?.punchesToday ?? data?.summary?.total ?? (dashboardLoading ? '…' : '—'))
    : (data?.summary?.total ?? (loading ? '…' : '—'));

  const activeStudentsCount = isToday
    ? (todayStats?.activeStudentsToday ?? data?.summary?.students ?? (dashboardLoading ? '…' : '—'))
    : (data?.summary?.students ?? (loading ? '…' : '—'));

  const inPunchCount = isToday
    ? (todayStats?.inToday ?? data?.summary?.inCount ?? (dashboardLoading ? '…' : '—'))
    : (data?.summary?.inCount ?? (loading ? '…' : '—'));

  const outPunchCount = isToday
    ? (todayStats?.outToday ?? data?.summary?.outCount ?? (dashboardLoading ? '…' : '—'))
    : (data?.summary?.outCount ?? (loading ? '…' : '—'));

  const refreshAll = () => {
    reload();
    reloadDashboard();
  };

  const resetRange = () => {
    setFromDate(today);
    setToDate(today);
    setDirection('');
    setSearch('');
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
            'Student ID': punch.reg_no || punch.student_id || '',
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 13, color: 'var(--text-muted, #64748b)', fontWeight: 500 }}>
                Auto-refresh:
              </span>
              <select
                className="ui-input ui-input--inline"
                style={{ padding: '3px 8px', fontSize: 13, height: 32, borderRadius: 6 }}
                value={refreshInterval}
                onChange={(event) => setRefreshInterval(Number(event.target.value))}
              >
                <option value={5}>Every 5s (Live)</option>
                <option value={10}>Every 10s</option>
                <option value={20}>Every 20s</option>
                <option value={30}>Every 30s</option>
                <option value={0}>Off (Manual)</option>
              </select>
            </div>
            <BioRefresh onClick={refreshAll} loading={loading || dashboardLoading} />
            <BioExportButton onClick={handleExport} disabled={!rows.length} />
          </div>
        }
      />

      {error ? <BioErrorNotice message={error} onRetry={reload} /> : null}
      {dashboardError ? <BioErrorNotice message={dashboardError} onRetry={reloadDashboard} /> : null}

      <div style={{ marginTop: 14 }}>
        <BioStatGrid
          items={[
            {
              label: isToday ? 'Punches today' : 'Total punches',
              value: punchesCount,
              sub: isToday ? 'Recorded today' : 'In selected range',
              icon: <Activity size={19} />,
              tone: 'accent',
              onClick: () => {
                setDirection('');
                setPage(1);
              },
            },
            {
              label: isToday ? 'Students active today' : 'Students active',
              value: activeStudentsCount,
              sub: 'Movement recorded',
              icon: <UserCheck size={19} />,
              tone: 'info',
            },
            {
              label: isToday ? 'Inside punch' : 'Inside punches',
              value: inPunchCount,
              sub: isToday ? 'IN movement today' : 'IN movement in range',
              icon: <ArrowDownLeft size={19} />,
              tone: 'success',
              onClick: () => {
                setDirection((prev) => (prev === 'IN' ? '' : 'IN'));
                setPage(1);
              },
              active: direction === 'IN',
            },
            {
              label: isToday ? 'Outside punch' : 'Outside punches',
              value: outPunchCount,
              sub: isToday ? 'OUT movement today' : 'OUT movement in range',
              icon: <ArrowUpRight size={19} />,
              tone: 'warning',
              onClick: () => {
                setDirection((prev) => (prev === 'OUT' ? '' : 'OUT'));
                setPage(1);
              },
              active: direction === 'OUT',
            },
            {
              label: 'Currently inside hostel',
              value: todayStats?.inside ?? (dashboardLoading ? '…' : '—'),
              sub: 'Inside hostel',
              icon: <Building2 size={19} />,
              tone: 'purple',
            },
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
                <th>Student ID</th>
                <th>Student name</th>
                <th>User PIN</th>
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
                colSpan={8}
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
                  <td className="bio-strong">{punch.reg_no || punch.student_id || '—'}</td>
                  <td>
                    <div className="bio-person">
                      <div className="bio-avatar">{String(punch.student_name || '?').slice(0, 2).toUpperCase()}</div>
                      <div>
                        <div className="bio-person-name">{punch.student_name || 'Unregistered'}</div>
                      </div>
                    </div>
                  </td>
                  <td className="bio-subtle">{punch.user_pin || '—'}</td>
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

import { useEffect, useState } from 'react';
import { ArrowDownLeft, ArrowUpRight, Clock3, Radio, Users } from 'lucide-react';
import { BiometricAttendanceAPI } from '../../api/biometricAttendance.api';
import { useApiData } from './hooks';
import {
  BioCardHead,
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

  useEffect(() => {
    setPage(1);
  }, [search, fromDate, toDate, direction]);

  useEffect(() => {
    if (!autoRefresh) return;
    const timer = window.setInterval(reload, 20000);
    return () => window.clearInterval(timer);
  }, [autoRefresh, reload]);

  const rows = data?.data || [];
  const summary = data?.summary;

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
            Direction: punch.direction,
            Student: punch.student_name,
            'Register No': punch.reg_no,
            Room: punch.room_no || '',
            Bed: punch.bed_no || '',
            Mobile: punch.student_mobile || '',
            'Verified by': punch.verified_by || '',
            Device: punch.gate_name || '',
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
            <BioRefresh onClick={reload} loading={loading} />
            <BioExportButton onClick={handleExport} disabled={!rows.length} />
          </>
        }
      />

      {error ? <BioErrorNotice message={error} onRetry={reload} /> : null}

      <div style={{ marginTop: 14 }}>
        <BioStatGrid
          items={[
            { label: 'Total punches', value: summary?.total ?? '—', sub: 'Matching filters', icon: <Radio size={19} />, tone: 'accent' },
            { label: 'IN punches', value: summary?.inCount ?? '—', sub: 'Entries recorded', icon: <ArrowDownLeft size={19} />, tone: 'success' },
            { label: 'OUT punches', value: summary?.outCount ?? '—', sub: 'Exits recorded', icon: <ArrowUpRight size={19} />, tone: 'warning' },
            { label: 'Students seen', value: summary?.students ?? '—', sub: 'Unique students', icon: <Users size={19} />, tone: 'info' },
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
            <button type="button" className="ui-btn ui-btn-primary ui-btn-sm" onClick={reload} disabled={loading}>
              <Clock3 size={14} /> Refresh now
            </button>
          </div>
        </div>

        <div className="bio-table-wrap">
          <table className="ui-table bio-table">
            <thead>
              <tr>
                <th>Date / time</th>
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
                empty={rows.length === 0}
                colSpan={6}
                emptyTitle="No punches in this range"
                emptyText="Try a wider date range, clear the search, or switch the direction filter."
                onRetry={reload}
              />
              {rows.map((punch) => (
                <tr key={punch.id}>
                  <td>
                    <div className="bio-cell-stack">
                      <span className="bio-time">{punch.time_of_punch || formatTime(punch.punch_time)}</span>
                      <span>{formatDate(punch.punch_date)}</span>
                    </div>
                  </td>
                  <td>
                    <div className="bio-person">
                      <div className="bio-avatar">{String(punch.student_name || '?').slice(0, 2).toUpperCase()}</div>
                      <div>
                        <div className="bio-person-name">{punch.student_name || 'Unregistered'}</div>
                        <div className="bio-person-meta">{punch.reg_no || 'No register no.'}</div>
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

      <div className="bio-card">
        <BioCardHead
          title="Punch counter"
          subtitle="All IN and OUT movements in the selected range"
          icon={<Radio size={17} />}
          action={
            <div className="bio-safety-strip">
              <div className="bio-safety-item is-inside">
                <ArrowDownLeft size={16} />
                <span><strong>{summary?.inCount ?? 0}</strong> IN</span>
              </div>
              <div className="bio-safety-item is-outside">
                <ArrowUpRight size={16} />
                <span><strong>{summary?.outCount ?? 0}</strong> OUT</span>
              </div>
            </div>
          }
        />
      </div>
    </>
  );
};

export default LiveMonitor;

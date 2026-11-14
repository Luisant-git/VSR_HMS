import { useEffect, useState } from 'react';
import { CalendarRange, Clock3, TrendingDown, UserCheck, Users } from 'lucide-react';
import { BiometricAttendanceAPI } from '../../api/biometricAttendance.api';
import { useApiData } from './hooks';
import {
  BioCardHead,
  BioErrorNotice,
  BioExportButton,
  BioField,
  BioPageHead,
  BioPager,
  BioRate,
  BioRefresh,
  BioSearchField,
  BioStatGrid,
  BioStatus,
  BioStudent,
  BioTableState,
} from './components/BioUI';
import { currentMonthInput, downloadStamp, exportExcel, formatDate, monthBounds, number, percent } from './utils';

const LIMIT = 15;

const MonthlyAttendance = () => {
  const [mode, setMode] = useState<'month' | 'range'>('month');
  const [month, setMonth] = useState(currentMonthInput());
  const [fromDate, setFromDate] = useState(monthBounds(currentMonthInput()).fromDate);
  const [toDate, setToDate] = useState(monthBounds(currentMonthInput()).toDate);
  const [search, setSearch] = useState('');
  const [lowOnly, setLowOnly] = useState(false);
  const [lowThreshold, setLowThreshold] = useState('15');
  const [page, setPage] = useState(1);

  const { data, loading, error, reload } = useApiData(
    () =>
      BiometricAttendanceAPI.monthly({
        page,
        limit: LIMIT,
        search: search.trim(),
        month: mode === 'month' ? month : undefined,
        fromDate: mode === 'range' ? fromDate : undefined,
        toDate: mode === 'range' ? toDate : undefined,
        lowOnly,
        lowThreshold: Number(lowThreshold) || 15,
      }),
    [page, search, mode, month, fromDate, toDate, lowOnly, lowThreshold],
  );

  useEffect(() => {
    setPage(1);
  }, [search, mode, month, fromDate, toDate, lowOnly, lowThreshold]);

  useEffect(() => {
    if (mode === 'month') {
      const bounds = monthBounds(month);
      setFromDate(bounds.fromDate);
      setToDate(bounds.toDate);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month]);

  const rows = data?.data || [];
  const summary = data?.summary;

  const handleExport = () => {
    if (!rows.length) return;
    exportExcel(
      [
        {
          name: 'Monthly attendance',
          rows: rows.map((row) => ({
            Student: row.student_name,
            'Register No': row.reg_no,
            Room: row.room_no || '',
            'Days present': row.days_present,
            'Total punches': row.total_punches,
            'IN punches': row.total_in_count,
            'OUT punches': row.total_out_count,
            'Attendance %': number(row.attendance_percent),
            'Below threshold': row.low_attendance ? 'Yes' : 'No',
          })),
        },
        {
          name: 'Range summary',
          rows: [
            { Metric: 'From', Value: data?.fromDate || fromDate },
            { Metric: 'To', Value: data?.toDate || toDate },
            { Metric: 'Range days', Value: summary?.rangeDays ?? 0 },
            { Metric: 'Students', Value: summary?.students ?? 0 },
            { Metric: 'Average days present', Value: summary?.avgDaysPresent ?? 0 },
            { Metric: 'Total punches', Value: summary?.totalPunches ?? 0 },
            { Metric: 'Low attendance students', Value: summary?.lowAttendance ?? 0 },
            { Metric: 'Low threshold (days)', Value: summary?.lowThreshold ?? 15 },
          ],
        },
      ],
      `monthly-attendance-${downloadStamp()}.xlsx`,
    );
  };

  return (
    <>
      <BioPageHead
        title="Monthly attendance"
        subtitle={
          data
            ? `${formatDate(data.fromDate)} to ${formatDate(data.toDate)} · ${summary?.rangeDays ?? 0} days`
            : 'Attendance aggregated across a month or custom date range'
        }
        actions={
          <>
            <BioRefresh onClick={reload} loading={loading} />
            <BioExportButton onClick={handleExport} disabled={!rows.length} />
          </>
        }
      />

      {error ? <BioErrorNotice message={error} onRetry={reload} /> : null}

      <div style={{ marginTop: 14 }}>
        <BioStatGrid
          items={[
            { label: 'Students', value: summary?.students ?? '—', sub: 'In this report', icon: <Users size={19} />, tone: 'info' },
            { label: 'Avg days present', value: summary?.avgDaysPresent ?? '—', sub: `Out of ${summary?.rangeDays ?? 0} days`, icon: <UserCheck size={19} />, tone: 'success' },
            { label: 'Total punches', value: summary?.totalPunches ?? '—', sub: 'IN + OUT movements', icon: <Clock3 size={19} />, tone: 'accent' },
            { label: 'Low attendance', value: summary?.lowAttendance ?? '—', sub: `Below ${summary?.lowThreshold ?? 15} days`, icon: <TrendingDown size={19} />, tone: 'danger' },
          ]}
        />
      </div>

      <div className="bio-card" style={{ marginTop: 16 }}>
        <BioCardHead
          title="Attendance summary"
          subtitle="Distinct attendance days per student"
          icon={<CalendarRange size={17} />}
          action={<span className="bio-status is-info">{summary?.rangeDays ?? 0} days in range</span>}
        />

        <div className="bio-toolbar">
          <div className="bio-filters">
            <BioField label="Report period">
              <select className="ui-select" value={mode} onChange={(event) => setMode(event.target.value as 'month' | 'range')}>
                <option value="month">Whole month</option>
                <option value="range">Custom date range</option>
              </select>
            </BioField>
            {mode === 'month' ? (
              <BioField label="Month">
                <input type="month" className="ui-input ui-input--inline" value={month} onChange={(event) => setMonth(event.target.value)} />
              </BioField>
            ) : (
              <>
                <BioField label="From">
                  <input type="date" className="ui-input ui-input--inline" value={fromDate} onChange={(event) => setFromDate(event.target.value)} />
                </BioField>
                <BioField label="To">
                  <input type="date" className="ui-input ui-input--inline" value={toDate} onChange={(event) => setToDate(event.target.value)} />
                </BioField>
              </>
            )}
            <BioField label="Low attendance below (days)">
              <input
                type="number"
                min={1}
                className="ui-input ui-input--inline"
                value={lowThreshold}
                onChange={(event) => setLowThreshold(event.target.value)}
              />
            </BioField>
            <label className="bio-check">
              <input type="checkbox" checked={lowOnly} onChange={(event) => setLowOnly(event.target.checked)} />
              Low attendance only
            </label>
          </div>
          <div className="bio-toolbar-actions">
            <BioSearchField value={search} onChange={setSearch} placeholder="Search monthly register..." />
            <BioRefresh onClick={reload} loading={loading} />
          </div>
        </div>

        <div className="bio-table-wrap">
          <table className="ui-table bio-table">
            <thead>
              <tr>
                <th>Student</th>
                <th>Days present</th>
                <th>Punches</th>
                <th>IN / OUT</th>
                <th>Attendance</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              <BioTableState
                loading={loading && !data}
                error={error && !data ? error : null}
                empty={rows.length === 0}
                colSpan={6}
                emptyTitle="No monthly records"
                emptyText="Try another month or date range, or turn off the low-attendance filter."
                onRetry={reload}
              />
              {rows.map((row) => (
                <tr key={row.reg_no}>
                  <td>
                    <BioStudent name={row.student_name} regNo={row.reg_no} room={row.room_no} />
                  </td>
                  <td>
                    <div className="bio-cell-stack">
                      <span className="bio-strong">{row.days_present} days</span>
                      <span>of {summary?.rangeDays ?? 0}</span>
                    </div>
                  </td>
                  <td className="bio-strong">{row.total_punches}</td>
                  <td>
                    <span className="bio-status is-success">{row.total_in_count} IN</span>{' '}
                    <span className="bio-status is-warning">{row.total_out_count} OUT</span>
                  </td>
                  <td><BioRate value={number(row.attendance_percent)} /></td>
                  <td>
                    <BioStatus status={row.low_attendance ? `Below ${summary?.lowThreshold ?? 15} days` : 'On track'} />
                  </td>
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
        <BioCardHead title="Coverage" subtitle="Average days present against the selected range" icon={<CalendarRange size={17} />} />
        <div className="bio-card-body">
          <BioRate
            value={summary?.rangeDays ? (number(summary?.avgDaysPresent) / summary.rangeDays) * 100 : 0}
            label={`${summary?.avgDaysPresent ?? 0} avg days of ${summary?.rangeDays ?? 0} · ${percent(
              summary?.rangeDays ? (number(summary?.avgDaysPresent) / summary.rangeDays) * 100 : 0,
            )}`}
          />
        </div>
      </div>
    </>
  );
};

export default MonthlyAttendance;

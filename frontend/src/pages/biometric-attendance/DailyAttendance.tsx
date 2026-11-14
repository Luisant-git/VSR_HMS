import { useEffect, useState } from 'react';
import { CalendarCheck, Clock3, LogIn, LogOut, UserCheck } from 'lucide-react';
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
import { exportExcel, formatDate, number, percent, todayInput } from './utils';

const LIMIT = 15;

const DailyAttendance = () => {
  const [fromDate, setFromDate] = useState(todayInput());
  const [toDate, setToDate] = useState(todayInput());
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const { data, loading, error, reload } = useApiData(
    () =>
      BiometricAttendanceAPI.daily({
        page,
        limit: LIMIT,
        search: search.trim(),
        fromDate,
        toDate,
        status: status || undefined,
      }),
    [page, search, fromDate, toDate, status],
  );

  useEffect(() => {
    setPage(1);
  }, [search, fromDate, toDate, status]);

  const rows = data?.data || [];
  const summary = data?.summary;
  const rangeLabel =
    fromDate === toDate || !toDate
      ? formatDate(fromDate)
      : `${formatDate(fromDate)} to ${formatDate(toDate)}`;

  const handleFrom = (value: string) => {
    setFromDate(value);
    if (value && toDate && value > toDate) setToDate(value);
  };

  const handleTo = (value: string) => {
    setToDate(value);
    if (value && fromDate && value < fromDate) setFromDate(value);
  };

  const setToday = () => {
    const today = todayInput();
    setFromDate(today);
    setToDate(today);
  };

  const handleExport = () => {
    if (!rows.length) return;
    exportExcel(
      [
        {
          name: 'Daily attendance',
          rows: rows.map((row) => ({
            Date: formatDate(row.attendance_date),
            Student: row.student_name,
            'Register No': row.reg_no,
            Room: row.room_no || '',
            Bed: row.bed_no || '',
            'First IN': row.first_in_time || '',
            'Last OUT': row.last_out_time || '',
            Punches: row.total_punches,
            'IN count': row.in_count,
            'OUT count': row.out_count,
            'Span hours': number(row.span_hours),
            Status: row.attendance_status,
          })),
        },
      ],
      `daily-attendance-${fromDate}-to-${toDate}.xlsx`,
    );
  };

  return (
    <>
      <BioPageHead
        title="Daily Attendance Register"
        subtitle={`Hostel presence and exit/entry movements for ${rangeLabel}`}
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
            { label: 'Active hostellers', value: summary?.totalStudents ?? '—', sub: 'On the hostel roll', icon: <UserCheck size={19} />, tone: 'info' },
            { label: 'In Hostel (Present)', value: summary?.present ?? '—', sub: 'Inside hostel', icon: <LogIn size={19} />, tone: 'success' },
            { label: 'Currently Outside', value: summary?.absent ?? '—', sub: (summary?.absent || 0) > 0 ? 'Punched OUT (Away)' : 'All hostellers inside', icon: <LogOut size={19} />, tone: (summary?.absent || 0) > 0 ? 'warning' : 'neutral' },
            { label: 'Punches', value: summary?.totalPunches ?? '—', sub: 'IN + OUT movements', icon: <Clock3 size={19} />, tone: 'accent' },
            { label: 'Hostel Presence', value: percent(summary?.attendanceRate), sub: 'Inside vs active roll', icon: <CalendarCheck size={19} />, tone: 'purple' },
          ]}
        />
      </div>

      <div className="bio-card" style={{ marginTop: 16 }}>
        <BioCardHead
          title="Hostel Presence & Movement Register"
          subtitle="Students reside in hostel by default; punching OUT marks exit, punching IN marks return."
          icon={<CalendarCheck size={17} />}
        />

        <div className="bio-toolbar">
          <div className="bio-filters">
            <BioSearchField value={search} onChange={setSearch} placeholder="Search student, reg no. or room..." />
            <BioField label="From">
              <input type="date" className="ui-input ui-input--inline" value={fromDate} onChange={(event) => handleFrom(event.target.value)} />
            </BioField>
            <BioField label="To">
              <input type="date" className="ui-input ui-input--inline" value={toDate} onChange={(event) => handleTo(event.target.value)} />
            </BioField>
            <BioField label="Status">
              <select className="ui-select" value={status} onChange={(event) => setStatus(event.target.value)}>
                <option value="">All students</option>
                <option value="In Hostel">In Hostel (Present)</option>
                <option value="Outside">Currently Outside</option>
                <option value="Moved">Movement Recorded Today</option>
              </select>
            </BioField>
            <button type="button" className="ui-btn ui-btn-secondary ui-btn-sm" onClick={setToday}>
              Today
            </button>
          </div>
          <div className="bio-toolbar-actions">
            <BioRefresh onClick={reload} loading={loading} />
          </div>
        </div>

        <div className="bio-table-wrap">
          <table className="ui-table bio-table">
            <thead>
              <tr>
                <th>Student</th>
                <th>Room</th>
                <th>First In</th>
                <th>Last Out</th>
                <th>Total Punches</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              <BioTableState
                loading={loading && !data}
                error={error && !data ? error : null}
                empty={rows.length === 0}
                colSpan={6}
                emptyTitle="No attendance rows for this date range"
                emptyText="Pick another date range, clear the search, or switch the status filter."
                onRetry={reload}
              />
              {rows.map((row) => (
                <tr key={`${row.reg_no}-${row.attendance_date}`}>
                  <td>
                    <BioStudent name={row.student_name} regNo={row.reg_no} />
                  </td>
                  <td>
                    <div className="bio-cell-stack">
                      <span className="bio-strong">{row.room_no || '—'}</span>
                      {row.bed_no ? <span>{row.bed_no}</span> : null}
                    </div>
                  </td>
                  <td>
                    {row.first_in_time ? (
                      <span className="bio-time" style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                        <LogIn size={13} color="#16a34a" /> {row.first_in_time}
                      </span>
                    ) : (
                      <span className="bio-muted-value">— (In Hostel)</span>
                    )}
                  </td>
                  <td>
                    {row.last_out_time ? (
                      <span className="bio-time" style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                        <LogOut size={13} color="#ea580c" /> {row.last_out_time}
                      </span>
                    ) : (
                      <span className="bio-muted-value">—</span>
                    )}
                  </td>
                  <td className="bio-strong">{row.total_punches}</td>
                  <td><BioStatus status={row.attendance_status || 'In Hostel'} /></td>
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
        <BioCardHead title="Hostel Presence Health" subtitle="Share of active hostellers inside the hostel" icon={<CalendarCheck size={17} />} />
        <div className="bio-card-body">
          <BioRate value={number(summary?.attendanceRate)} label={`${summary?.present ?? 0} inside / ${summary?.totalStudents ?? 0} students`} />
        </div>
      </div>
    </>
  );
};

export default DailyAttendance;

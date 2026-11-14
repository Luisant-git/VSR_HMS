import { useEffect, useState } from 'react';
import { CalendarCheck, Clock3, LogIn, LogOut, UserCheck, UserX } from 'lucide-react';
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
  const [date, setDate] = useState(todayInput());
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const { data, loading, error, reload } = useApiData(
    () =>
      BiometricAttendanceAPI.daily({
        page,
        limit: LIMIT,
        search: search.trim(),
        date,
        status: status || undefined,
      }),
    [page, search, date, status],
  );

  useEffect(() => {
    setPage(1);
  }, [search, date, status]);

  const rows = data?.data || [];
  const summary = data?.summary;

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
      `daily-attendance-${date}.xlsx`,
    );
  };

  return (
    <>
      <BioPageHead
        title="Daily attendance register"
        subtitle={`First IN and last OUT for every hosteller on ${formatDate(date)}`}
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
            { label: 'Active students', value: summary?.totalStudents ?? '—', sub: 'On the hostel roll', icon: <UserCheck size={19} />, tone: 'info' },
            { label: 'Present', value: summary?.present ?? '—', sub: 'At least one IN punch', icon: <LogIn size={19} />, tone: 'success' },
            { label: 'Absent', value: summary?.absent ?? '—', sub: 'No IN punch recorded', icon: <UserX size={19} />, tone: 'danger' },
            { label: 'Punches', value: summary?.totalPunches ?? '—', sub: 'IN + OUT movements', icon: <Clock3 size={19} />, tone: 'accent' },
            { label: 'Attendance rate', value: percent(summary?.attendanceRate), sub: 'Present vs active roll', icon: <CalendarCheck size={19} />, tone: 'purple' },
          ]}
        />
      </div>

      <div className="bio-card" style={{ marginTop: 16 }}>
        <BioCardHead
          title="Register"
          subtitle="Distinct first IN / last OUT are calculated from biometric punches"
          icon={<CalendarCheck size={17} />}
        />

        <div className="bio-toolbar">
          <div className="bio-filters">
            <BioSearchField value={search} onChange={setSearch} />
            <BioField label="Attendance date">
              <input type="date" className="ui-input ui-input--inline" value={date} onChange={(event) => setDate(event.target.value)} />
            </BioField>
            <BioField label="Status">
              <select className="ui-select" value={status} onChange={(event) => setStatus(event.target.value)}>
                <option value="">All students</option>
                <option value="Present">Present</option>
                <option value="Absent">Absent</option>
              </select>
            </BioField>
            <button type="button" className="ui-btn ui-btn-secondary ui-btn-sm" onClick={() => setDate(todayInput())}>
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
                <th>First IN</th>
                <th>Last OUT</th>
                <th>Punches</th>
                <th>IN / OUT</th>
                <th>Span</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              <BioTableState
                loading={loading && !data}
                error={error && !data ? error : null}
                empty={rows.length === 0}
                colSpan={7}
                emptyTitle="No attendance rows for this date"
                emptyText="Pick another date, clear the search, or switch the status filter."
                onRetry={reload}
              />
              {rows.map((row) => (
                <tr key={`${row.reg_no}-${row.attendance_date}`}>
                  <td>
                    <BioStudent name={row.student_name} regNo={row.reg_no} room={row.room_no} bed={row.bed_no} />
                  </td>
                  <td>
                    {row.first_in_time ? (
                      <span className="bio-time" style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                        <LogIn size={13} color="#16a34a" /> {row.first_in_time}
                      </span>
                    ) : (
                      <span className="bio-muted-value">—</span>
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
                  <td>
                    <span className="bio-status is-success">{row.in_count} IN</span>{' '}
                    <span className="bio-status is-warning">{row.out_count} OUT</span>
                  </td>
                  <td className="bio-subtle">{number(row.span_hours)}h</td>
                  <td><BioStatus status={row.attendance_status} /></td>
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
        <BioCardHead title="Attendance health" subtitle="Present share of the active hostel roll" icon={<CalendarCheck size={17} />} />
        <div className="bio-card-body">
          <BioRate value={number(summary?.attendanceRate)} label={`${summary?.present ?? 0} present / ${summary?.totalStudents ?? 0} students`} />
        </div>
      </div>
    </>
  );
};

export default DailyAttendance;

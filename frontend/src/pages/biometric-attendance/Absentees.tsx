import { useEffect, useState } from 'react';
import { CalendarX2, PhoneCall, UserCheck, UserX } from 'lucide-react';
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
  ContactLines,
} from './components/BioUI';
import { exportExcel, formatDate, number, percent, todayInput } from './utils';

const LIMIT = 15;

const Absentees = () => {
  const [date, setDate] = useState(todayInput());
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const { data, loading, error, reload } = useApiData(
    () => BiometricAttendanceAPI.absentees({ page, limit: LIMIT, search: search.trim(), date }),
    [page, search, date],
  );

  useEffect(() => {
    setPage(1);
  }, [search, date]);

  const rows = data?.data || [];
  const summary = data?.summary;

  const handleExport = () => {
    if (!rows.length) return;
    exportExcel(
      [
        {
          name: 'Absentee report',
          rows: rows.map((row) => ({
            Date: formatDate(row.check_date),
            Student: row.student_name,
            'Register No': row.reg_no,
            Room: row.room_no || '',
            Bed: row.bed_no || '',
            Mobile: row.student_mobile || '',
            'Parent name': row.father_name || '',
            'Parent mobile': row.father_mobile || '',
            Status: row.attendance_status,
          })),
        },
      ],
      `absentee-report-${date}.xlsx`,
    );
  };

  return (
    <>
      <BioPageHead
        title="Absentee report"
        subtitle={`Students without a single IN punch on ${formatDate(date)}`}
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
            { label: 'Absent students', value: summary?.absent ?? '—', sub: 'No biometric IN punch', icon: <UserX size={19} />, tone: 'danger' },
            { label: 'Present', value: summary?.present ?? '—', sub: 'Punched in at least once', icon: <UserCheck size={19} />, tone: 'success' },
            { label: 'Active roll', value: summary?.totalStudents ?? '—', sub: 'Students marked In', icon: <CalendarX2 size={19} />, tone: 'info' },
            { label: 'Attendance rate', value: percent(summary?.attendanceRate), sub: 'Present vs active roll', icon: <PhoneCall size={19} />, tone: 'accent' },
          ]}
        />
      </div>

      <div className="bio-card" style={{ marginTop: 16 }}>
        <BioCardHead
          title="Follow-up list"
          subtitle="Contact numbers are ready for guardian communication"
          icon={<UserX size={17} />}
          action={<span className="bio-status is-danger">{summary?.absent ?? 0} absent</span>}
        />

        <div className="bio-toolbar">
          <div className="bio-filters">
            <BioSearchField value={search} onChange={setSearch} placeholder="Search absent students..." />
            <BioField label="Date">
              <input type="date" className="ui-input ui-input--inline" value={date} onChange={(event) => setDate(event.target.value)} />
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
                <th>Room / Bed</th>
                <th>Contact</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              <BioTableState
                loading={loading && !data}
                error={error && !data ? error : null}
                empty={rows.length === 0}
                colSpan={4}
                emptyTitle="No absentees for this date"
                emptyText="Every active hosteller has at least one IN punch recorded. Great attendance!"
                onRetry={reload}
              />
              {rows.map((row) => (
                <tr key={`${row.reg_no}-${row.check_date}`}>
                  <td>
                    <BioStudent name={row.student_name} regNo={row.reg_no} />
                  </td>
                  <td>
                    <div className="bio-cell-stack">
                      <span className="bio-strong">{row.room_no || '—'}</span>
                      <span>{row.bed_no || 'No bed'}</span>
                    </div>
                  </td>
                  <td>
                    <ContactLines self={row.student_mobile} parentName={row.father_name} parent={row.father_mobile} />
                  </td>
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
        <BioCardHead title="Attendance coverage" subtitle="Present share of the active hostel roll" icon={<UserCheck size={17} />} />
        <div className="bio-card-body">
          <BioRate value={number(summary?.attendanceRate)} label={`${summary?.present ?? 0} present / ${summary?.totalStudents ?? 0} students`} />
        </div>
      </div>
    </>
  );
};

export default Absentees;

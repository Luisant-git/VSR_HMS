import { useState } from 'react';
import {
  AlertTriangle,
  Clock,
  LogOut,
  MessageSquare,
  Phone,
  RotateCcw,
  UserX,
} from 'lucide-react';
import { BiometricAttendanceAPI, type LateWarningRow } from '../../api/biometricAttendance.api';
import { useApiData } from './hooks';
import {
  BioCardHead,
  BioErrorNotice,
  BioExportButton,
  BioPageHead,
  BioPager,
  BioRefresh,
  BioSearchField,
  BioStatGrid,
  BioTableState,
} from './components/BioUI';
import { downloadStamp, exportExcel, formatDate, formatDateTime, initials, todayInput } from './utils';

const LIMIT = 20;

type ActiveTab = 'late' | 'absent';

const formatLateDuration = (mins?: number | null) => {
  const m = Number(mins) || 0;
  if (m <= 0) return '—';
  if (m < 60) return `+${m}m late`;
  const hrs = Math.floor(m / 60);
  const remaining = m % 60;
  return `+${hrs}h ${remaining > 0 ? `${remaining}m ` : ''}late`;
};

const BioLateWarnings = () => {
  const [tab, setTab] = useState<ActiveTab>('late');
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [fromDate, setFromDate] = useState(todayInput());
  const [toDate, setToDate] = useState(todayInput());

  const { data, loading, error, reload } = useApiData(
    () =>
      BiometricAttendanceAPI.lateWarnings({
        tab,
        page,
        limit: LIMIT,
        search,
        curfewTime: '19:00',
        fromDate: fromDate || undefined,
        toDate: toDate || undefined,
      }),
    [tab, page, search, fromDate, toDate],
  );

  const summary = data?.summary;
  const rows: LateWarningRow[] = data?.data || [];

  const handleTabChange = (newTab: ActiveTab) => {
    setTab(newTab);
    setPage(1);
  };

  const handleReset = () => {
    setSearch('');
    setFromDate(todayInput());
    setToDate(todayInput());
    setPage(1);
  };

  const handleShowAll = () => {
    setSearch('');
    setFromDate('');
    setToDate('');
    setPage(1);
  };

  const handleExport = () => {
    if (!rows.length) return;
    let exportRows: Record<string, unknown>[] = [];
    const sheetName = tab === 'late' ? 'Late Returns (> 7 PM)' : 'Absent (Not Returned)';

    if (tab === 'late') {
      exportRows = rows.map((r) => ({
        'Student ID': r.reg_no,
        'Student Name': r.student_name,
        Room: r.room_no || '',
        Date: r.punch_date ? formatDate(r.punch_date) : '',
        'College Exit Time (OUT)': r.out_time_formatted || (r.out_time ? formatDateTime(r.out_time) : ''),
        'Hostel Return Time (IN)': r.in_time_formatted || (r.in_time ? formatDateTime(r.in_time) : ''),
        'Minutes Late': r.minutes_late ?? r.minutes_past_curfew ?? '',
        'Delay Past 7 PM': formatLateDuration(r.minutes_late ?? r.minutes_past_curfew),
        'Parent Mobile': r.father_mobile || '',
        'Student Mobile': r.student_mobile || '',
      }));
    } else {
      exportRows = rows.map((r) => ({
        'Student ID': r.reg_no,
        'Student Name': r.student_name,
        Room: r.room_no || '',
        Date: r.punch_date ? formatDate(r.punch_date) : '',
        'College Exit Time (OUT)': r.out_time_formatted || (r.out_time ? formatDateTime(r.out_time) : ''),
        Status: r.status === 'OUT_AT_COLLEGE' ? 'Out at College (Awaiting Return)' : 'ABSENT (Not Returned After 7 PM)',
        'Parent Mobile': r.father_mobile || '',
        'Father Name': r.father_name || '',
        'Student Mobile': r.student_mobile || '',
      }));
    }

    exportExcel(
      [{ name: sheetName, rows: exportRows }],
      `biometric-${tab}-${downloadStamp()}.xlsx`,
    );
  };

  const cleanPhone = (phone?: string | null) => {
    if (!phone) return null;
    const digits = phone.replace(/[^0-9]/g, '');
    return digits.length >= 10 ? digits.slice(-10) : digits;
  };

  return (
    <>
      <BioPageHead
        title="Late Return & Missing Warnings"
        subtitle="Tracking students leaving for college (OUT) and returning in evening (IN). Returns after 07:00 PM are late; unreturned students are absent."
        actions={
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span
              className="bio-status is-warning"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 700, padding: '4px 10px' }}
            >
              <Clock size={13} /> Curfew Cutoff: 07:00 PM
            </span>
            <BioRefresh onClick={reload} loading={loading} />
            <BioExportButton onClick={handleExport} disabled={!rows.length} />
          </div>
        }
      />

      {error ? <BioErrorNotice message={error} onRetry={reload} /> : null}

      {/* Neat 3-Stat Summary */}
      <div style={{ marginTop: 14 }}>
        <BioStatGrid
          items={[
            {
              label: 'Late Returns',
              value: summary?.lateReturnsToday ?? '0',
              sub: 'Punched IN after 07:00 PM',
              icon: <AlertTriangle size={19} />,
              tone: (summary?.lateReturnsToday || 0) > 0 ? 'danger' : 'neutral',
            },
            {
              label: 'Absent / Not Returned',
              value: summary?.absentNotReturned ?? '0',
              sub: 'Left for college, no return after 7 PM',
              icon: <UserX size={19} />,
              tone: (summary?.absentNotReturned || 0) > 0 ? 'danger' : 'neutral',
            },
            {
              label: 'Out at College',
              value: summary?.collegeOutToday ?? '0',
              sub: 'Punched OUT (Awaiting evening return)',
              icon: <LogOut size={19} />,
              tone: (summary?.collegeOutToday || 0) > 0 ? 'warning' : 'neutral',
            },
          ]}
        />
      </div>

      <div className="bio-card" style={{ marginTop: 16 }}>
        <BioCardHead
          title={
            tab === 'late'
              ? 'Late Returns (Checked IN After 07:00 PM)'
              : 'Absent / Not Returned (Punched OUT, No IN Punch After 7 PM)'
          }
          subtitle={
            tab === 'late'
              ? 'Students who punched OUT to college and punched IN back to hostel after the 7:00 PM curfew'
              : 'Students who went OUT to college and failed to punch back IN after 7:00 PM (Hostel Night Absentees)'
          }
          icon={tab === 'late' ? <AlertTriangle size={17} /> : <UserX size={17} />}
          action={
            <div className="ui-btn-group" style={{ display: 'inline-flex' }}>
              <button
                type="button"
                className={`ui-btn ui-btn-sm ${tab === 'late' ? 'ui-btn-primary' : 'ui-btn-secondary'}`}
                onClick={() => handleTabChange('late')}
              >
                Late Returns (&gt; 7 PM) {summary?.lateReturnsToday ? `(${summary.lateReturnsToday})` : ''}
              </button>
              <button
                type="button"
                className={`ui-btn ui-btn-sm ${tab === 'absent' ? 'ui-btn-primary' : 'ui-btn-secondary'}`}
                onClick={() => handleTabChange('absent')}
              >
                Absent / Not Returned {summary?.absentNotReturned ? `(${summary.absentNotReturned})` : summary?.collegeOutToday ? `(${summary.collegeOutToday} Outside)` : ''}
              </button>
            </div>
          }
        />

        {/* Clean, Neat Single-Row Responsive Toolbar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 10,
            flexWrap: 'wrap',
            padding: '12px 20px',
            borderBottom: '1px solid var(--border)',
            background: 'var(--surface)',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              flexWrap: 'wrap',
              flex: '1 1 auto',
            }}
          >
            {/* Search Box */}
            <div style={{ flex: '1 1 200px', maxWidth: 300, minWidth: 180 }}>
              <BioSearchField
                value={search}
                onChange={(val) => {
                  setSearch(val);
                  setPage(1);
                }}
                placeholder="Search Student, Reg No, Room..."
              />
            </div>

            {/* Same-Row Compact "From" & "To" Inline Date Inputs */}
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                height: 38,
                padding: '0 10px',
                background: 'var(--surface-sunken)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius)',
              }}
            >
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)' }}>From:</span>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => {
                  setFromDate(e.target.value);
                  setPage(1);
                }}
                style={{
                  border: 'none',
                  background: 'transparent',
                  fontSize: 13,
                  color: 'inherit',
                  outline: 'none',
                  cursor: 'pointer',
                  width: 125,
                }}
              />
            </div>

            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                height: 38,
                padding: '0 10px',
                background: 'var(--surface-sunken)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius)',
              }}
            >
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)' }}>To:</span>
              <input
                type="date"
                value={toDate}
                onChange={(e) => {
                  setToDate(e.target.value);
                  setPage(1);
                }}
                style={{
                  border: 'none',
                  background: 'transparent',
                  fontSize: 13,
                  color: 'inherit',
                  outline: 'none',
                  cursor: 'pointer',
                  width: 125,
                }}
              />
            </div>

            {/* Quick Action Buttons in Same Row */}
            <button
              type="button"
              className={`ui-btn ui-btn-sm ${fromDate === todayInput() && toDate === todayInput() ? 'ui-btn-primary' : 'ui-btn-secondary'}`}
              style={{ height: 38 }}
              onClick={() => {
                const today = todayInput();
                setFromDate(today);
                setToDate(today);
                setPage(1);
              }}
              title="Filter records for Today"
            >
              Today
            </button>

            <button
              type="button"
              className="ui-btn ui-btn-secondary ui-btn-sm"
              style={{ height: 38, display: 'inline-flex', alignItems: 'center', gap: 5 }}
              onClick={handleReset}
              title="Reset date to Today and clear search"
            >
              <RotateCcw size={13} /> Reset
            </button>

            <button
              type="button"
              className={`ui-btn ui-btn-sm ${!fromDate && !toDate ? 'ui-btn-primary' : 'ui-btn-secondary'}`}
              style={{ height: 38 }}
              onClick={handleShowAll}
              title="Show all records without date filter"
            >
              All Dates
            </button>
          </div>
        </div>

        {/* Clean, Neat, Responsive Table */}
        <div className="bio-table-wrap">
          <table className="ui-table bio-table" style={{ minWidth: 960 }}>
            <thead>
              <tr>
                <th style={{ width: 120 }}>Student ID</th>
                <th style={{ minWidth: 180 }}>Student Name</th>
                <th style={{ width: 90 }}>Room No</th>
                <th style={{ width: 100 }}>Date</th>
                <th style={{ width: 120 }}>College Exit (OUT)</th>
                {tab === 'late' ? (
                  <>
                    <th style={{ width: 130 }}>Hostel Return (IN)</th>
                    <th style={{ width: 120 }}>Delay Past 7 PM</th>
                    <th style={{ width: 100 }}>Status</th>
                  </>
                ) : (
                  <>
                    <th style={{ width: 180 }}>Hostel Evening Status</th>
                  </>
                )}
                <th style={{ width: 120 }}>Parent Mobile</th>
                <th style={{ width: 140 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              <BioTableState
                loading={loading && !data}
                error={error && !data ? error : null}
                empty={rows.length === 0}
                colSpan={tab === 'late' ? 10 : 8}
                emptyTitle="No records found"
                emptyText={
                  tab === 'late'
                    ? 'No late returns found after 07:00 PM for the selected date.'
                    : 'No absent students found. All students who went out are accounted for!'
                }
                onRetry={reload}
              />
              {rows.map((row, idx) => {
                const fPhone = cleanPhone(row.father_mobile);
                const sPhone = cleanPhone(row.student_mobile);
                const isAbsent = row.status === 'ABSENT_NOT_RETURNED';
                return (
                  <tr key={`${row.reg_no}-${row.out_time || idx}`}>
                    <td className="bio-strong bio-mono" style={{ whiteSpace: 'nowrap' }}>
                      {row.reg_no}
                    </td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, whiteSpace: 'nowrap' }}>
                        <span className="bio-avatar" style={{ width: 26, height: 26, fontSize: 11, flexShrink: 0 }}>
                          {initials(row.student_name)}
                        </span>
                        <span className="bio-strong" style={{ whiteSpace: 'nowrap' }}>
                          {row.student_name}
                        </span>
                      </div>
                    </td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      {row.room_no ? (
                        <span className="bio-strong">
                          {row.room_no} {row.bed_no ? <span className="bio-subtle">({row.bed_no})</span> : null}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      {row.punch_date ? formatDate(row.punch_date) : '—'}
                    </td>
                    <td className="bio-time" style={{ whiteSpace: 'nowrap' }}>
                      {row.out_time_formatted || (row.out_time ? formatDateTime(row.out_time) : '—')}
                    </td>

                    {tab === 'late' ? (
                      <>
                        <td className="bio-time" style={{ color: '#dc2626', fontWeight: 600, whiteSpace: 'nowrap' }}>
                          {row.in_time_formatted || (row.in_time ? formatDateTime(row.in_time) : '—')}
                        </td>
                        <td style={{ whiteSpace: 'nowrap' }}>
                          <span className="bio-status is-danger" style={{ fontWeight: 700 }}>
                            {formatLateDuration(row.minutes_late ?? row.minutes_past_curfew)}
                          </span>
                        </td>
                        <td style={{ whiteSpace: 'nowrap' }}>
                          <span className="bio-status is-danger" style={{ fontSize: 11 }}>
                            LATE ENTRY
                          </span>
                        </td>
                      </>
                    ) : (
                      <td style={{ whiteSpace: 'nowrap' }}>
                        {isAbsent ? (
                          <span className="bio-status is-danger" style={{ fontWeight: 700, fontSize: 11 }}>
                            ABSENT (No Return After 7 PM)
                          </span>
                        ) : (
                          <span className="bio-status is-warning" style={{ fontWeight: 600, fontSize: 11 }}>
                            Out at College (Awaiting Return)
                          </span>
                        )}
                      </td>
                    )}

                    <td className="bio-mono" style={{ whiteSpace: 'nowrap' }}>
                      {row.father_mobile || '—'}
                    </td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}>
                        {fPhone ? (
                          <>
                            <a
                              href={`tel:${fPhone}`}
                              className="ui-btn ui-btn-sm ui-btn-secondary"
                              style={{ padding: '3px 8px', fontSize: 11, display: 'inline-flex', alignItems: 'center', gap: 4 }}
                              title={`Call Parent: ${fPhone}`}
                            >
                              <Phone size={12} /> Call
                            </a>
                            <a
                              href={`https://wa.me/91${fPhone}?text=Hello,%20Hostel%20Office%20alert:%20${encodeURIComponent(row.student_name)}%20(Room%20${encodeURIComponent(row.room_no || '')})%20${tab === 'late' ? `returned late after 7 PM (${formatLateDuration(row.minutes_late ?? row.minutes_past_curfew)})` : 'has not returned to the hostel after 7 PM'}.`}
                              target="_blank"
                              rel="noreferrer"
                              className="ui-btn ui-btn-sm ui-btn-secondary"
                              style={{ padding: '3px 8px', fontSize: 11, color: '#16a34a', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                              title="WhatsApp Parent"
                            >
                              <MessageSquare size={12} /> WhatsApp
                            </a>
                          </>
                        ) : sPhone ? (
                          <a
                            href={`tel:${sPhone}`}
                            className="ui-btn ui-btn-sm ui-btn-secondary"
                            style={{ padding: '3px 8px', fontSize: 11, display: 'inline-flex', alignItems: 'center', gap: 4 }}
                            title={`Call Student: ${sPhone}`}
                          >
                            <Phone size={12} /> Call Student
                          </a>
                        ) : (
                          <span className="bio-subtle" style={{ fontSize: 11 }}>
                            No contact
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
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

export default BioLateWarnings;

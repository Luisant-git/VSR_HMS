import { useState } from 'react';
import {
  AlertOctagon,
  AlertTriangle,
  Clock,
  ClockAlert,
  History,
  LayoutGrid,
  List,
  LogOut,
  MessageSquare,
  Phone,
  ShieldAlert,
  UserX,
} from 'lucide-react';
import { BiometricAttendanceAPI, type LateWarningRow } from '../../api/biometricAttendance.api';
import { useApiData } from './hooks';
import {
  BioCardHead,
  BioEmpty,
  BioErrorNotice,
  BioExportButton,
  BioField,
  BioPageHead,
  BioPager,
  BioRefresh,
  BioSearchField,
  BioStatGrid,
  BioTableState,
} from './components/BioUI';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import { downloadStamp, exportExcel, formatDate, formatDateTime, initials, todayInput } from './utils';

const LIMIT = 20;

type ActiveTab = 'curfew' | 'overdue' | 'missing' | 'frequent';

const BioLateWarnings = () => {
  const [tab, setTab] = useState<ActiveTab>('curfew');
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [date, setDate] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [viewMode, setViewMode] = useState<'table' | 'card'>('table');

  const { data, loading, error, reload } = useApiData(
    () =>
      BiometricAttendanceAPI.lateWarnings({
        tab,
        page,
        limit: LIMIT,
        search,
        date: date || undefined,
        fromDate: fromDate || undefined,
        toDate: toDate || undefined,
      }),
    [tab, page, search, date, fromDate, toDate],
  );

  const summary = data?.summary;
  const rows: LateWarningRow[] = data?.data || [];

  const handleTabChange = (newTab: ActiveTab) => {
    setTab(newTab);
    setPage(1);
  };

  const handleExport = () => {
    if (!rows.length) return;
    let exportRows: Record<string, unknown>[] = [];
    let sheetName = 'Late Records';

    if (tab === 'curfew') {
      sheetName = 'Curfew Violations';
      exportRows = rows.map((r) => ({
        'Student ID': r.student_id || '',
        'Reg No': r.reg_no,
        'Student Name': r.student_name,
        Room: r.room_no || '',
        'Violation Date': r.violation_date ? formatDate(r.violation_date) : '',
        'Punch Time': r.punch_time_formatted || (r.punch_time ? formatDateTime(r.punch_time) : ''),
        'Minutes Late': r.minutes_past_curfew ?? '',
        'Student Mobile': r.student_mobile || '',
        'Father Mobile': r.father_mobile || '',
        Device: r.device_id || '',
      }));
    } else if (tab === 'overdue') {
      sheetName = 'Overdue Outside';
      exportRows = rows.map((r) => ({
        'Student ID': r.student_id || '',
        'Reg No': r.reg_no,
        'Student Name': r.student_name,
        Room: r.room_no || '',
        'Out Time': r.out_time_formatted || (r.out_time ? formatDateTime(r.out_time) : ''),
        'Hours Outside': r.hours_outside ?? '',
        'Alert Level': r.alert_level || '',
        'Student Mobile': r.student_mobile || '',
        'Father Name': r.father_name || '',
        'Father Mobile': r.father_mobile || '',
        Device: r.exit_device_id || '',
      }));
    } else if (tab === 'missing') {
      sheetName = 'Missing Hostellers';
      exportRows = rows.map((r) => ({
        'Student ID': r.student_id || '',
        'Reg No': r.reg_no,
        'Student Name': r.student_name,
        Room: r.room_no || '',
        Bed: r.bed_no || '',
        Status: 'No Biometric Punch Recorded Today',
        'Student Mobile': r.student_mobile || '',
        'Father Name': r.father_name || '',
        'Father Mobile': r.father_mobile || '',
      }));
    } else {
      sheetName = 'Frequent Late Comers';
      exportRows = rows.map((r) => ({
        'Student ID': r.student_id || '',
        'Reg No': r.reg_no,
        'Student Name': r.student_name,
        Room: r.room_no || '',
        'Total Late Entries (30d)': r.total_late_entries ?? '',
        'Avg Minutes Late': r.avg_minutes_late ?? '',
        'Last Late Punch': r.last_late_punch_formatted || '',
        'Father Mobile': r.father_mobile || '',
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
        subtitle="Automatic real-time alerts for curfew violations, overdue hostellers outside, and students missing from roll call"
        actions={
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
            <span
              className="bio-status is-warning"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 600, padding: '4px 10px' }}
            >
              <Clock size={13} /> Curfew Cutoff: {summary?.curfewTime || '08:30'} PM
            </span>
            <BioRefresh onClick={reload} loading={loading} />
            <BioExportButton onClick={handleExport} disabled={!rows.length} />
          </div>
        }
      />

      {error ? <BioErrorNotice message={error} onRetry={reload} /> : null}

      <div style={{ marginTop: 14 }}>
        <BioStatGrid
          items={[
            {
              label: 'Late Returns (Today)',
              value: summary?.lateReturnsToday ?? '0',
              sub: 'Punched IN after 08:30 PM',
              icon: <AlertTriangle size={19} />,
              tone: (summary?.lateReturnsToday || 0) > 0 ? 'danger' : 'neutral',
            },
            {
              label: 'Critical Overdue (Now)',
              value: summary?.criticalOverdue ?? '0',
              sub: 'Outside past curfew / >8h',
              icon: <ClockAlert size={19} />,
              tone: (summary?.criticalOverdue || 0) > 0 ? 'danger' : 'neutral',
            },
            {
              label: 'Currently Outside',
              value: summary?.totalOutside ?? '—',
              sub: 'Hostellers currently away',
              icon: <LogOut size={19} />,
              tone: (summary?.totalOutside || 0) > 0 ? 'warning' : 'neutral',
            },
            {
              label: 'No Punch Today',
              value: summary?.missingToday ?? '—',
              sub: 'Unaccounted roll today',
              icon: <UserX size={19} />,
              tone: 'info',
            },
            {
              label: 'Frequent Late Comers',
              value: summary?.frequentViolators ?? '0',
              sub: '≥2 late entries in 30 days',
              icon: <ShieldAlert size={19} />,
              tone: (summary?.frequentViolators || 0) > 0 ? 'purple' : 'neutral',
            },
          ]}
        />
      </div>

      <div className="bio-card" style={{ marginTop: 16 }}>
        <BioCardHead
          title={
            tab === 'curfew'
              ? 'Late Return Punches (Curfew Violations)'
              : tab === 'overdue'
                ? 'Critical Overdue / Outside Past Curfew'
                : tab === 'missing'
                  ? 'Missing / Absent Today (No Punch Recorded)'
                  : 'Frequent Curfew Violators (Last 30 Days)'
          }
          subtitle={
            tab === 'curfew'
              ? 'Hostellers who checked in after the 08:30 PM curfew cutoff'
              : tab === 'overdue'
                ? 'Hostellers currently outside who have not returned past curfew or for excessive hours'
                : tab === 'missing'
                  ? 'Active hostellers with 0 biometric movement recorded today (Night roll check)'
                  : 'Hostellers with repeated late entries requiring disciplinary review'
          }
          icon={
            tab === 'curfew' ? (
              <AlertTriangle size={17} />
            ) : tab === 'overdue' ? (
              <AlertOctagon size={17} />
            ) : tab === 'missing' ? (
              <UserX size={17} />
            ) : (
              <History size={17} />
            )
          }
          action={
            <div className="ui-btn-group" style={{ display: 'inline-flex' }}>
              <button
                type="button"
                className={`ui-btn ui-btn-sm ${tab === 'curfew' ? 'ui-btn-primary' : 'ui-btn-secondary'}`}
                onClick={() => handleTabChange('curfew')}
              >
                Late Returns
              </button>
              <button
                type="button"
                className={`ui-btn ui-btn-sm ${tab === 'overdue' ? 'ui-btn-primary' : 'ui-btn-secondary'}`}
                onClick={() => handleTabChange('overdue')}
              >
                Overdue Outside {summary?.criticalOverdue ? `(${summary.criticalOverdue})` : ''}
              </button>
              <button
                type="button"
                className={`ui-btn ui-btn-sm ${tab === 'missing' ? 'ui-btn-primary' : 'ui-btn-secondary'}`}
                onClick={() => handleTabChange('missing')}
              >
                Missing Today {summary?.missingToday ? `(${summary.missingToday})` : ''}
              </button>
              <button
                type="button"
                className={`ui-btn ui-btn-sm ${tab === 'frequent' ? 'ui-btn-primary' : 'ui-btn-secondary'}`}
                onClick={() => handleTabChange('frequent')}
              >
                Frequent Late
              </button>
            </div>
          }
        />

        {/* Toolbar with Search, Date filter, View switcher */}
        <div className="bio-toolbar">
          <div className="bio-toolbar-filters">
            <BioSearchField
              value={search}
              onChange={(val) => {
                setSearch(val);
                setPage(1);
              }}
              placeholder="Search Student, Reg No, Room..."
            />

            {tab === 'curfew' ? (
              <>
                <BioField label="From Date">
                  <input
                    type="date"
                    className="ui-form-control"
                    value={fromDate}
                    onChange={(e) => {
                      setFromDate(e.target.value);
                      setPage(1);
                    }}
                  />
                </BioField>
                <BioField label="To Date">
                  <input
                    type="date"
                    className="ui-form-control"
                    value={toDate}
                    onChange={(e) => {
                      setToDate(e.target.value);
                      setPage(1);
                    }}
                  />
                </BioField>
              </>
            ) : tab === 'missing' ? (
              <BioField label="Roll Call Date">
                <input
                  type="date"
                  className="ui-form-control"
                  value={date}
                  placeholder={todayInput()}
                  onChange={(e) => {
                    setDate(e.target.value);
                    setPage(1);
                  }}
                />
              </BioField>
            ) : null}

            {search || fromDate || toDate || date ? (
              <button
                type="button"
                className="ui-btn ui-btn-secondary ui-btn-sm"
                style={{ alignSelf: 'flex-end', height: 36 }}
                onClick={() => {
                  setSearch('');
                  setDate('');
                  setFromDate('');
                  setToDate('');
                  setPage(1);
                }}
              >
                Reset filters
              </button>
            ) : null}
          </div>

          <div className="bio-toolbar-actions">
            <div className="ui-btn-group" style={{ display: 'inline-flex' }}>
              <button
                type="button"
                className={`ui-btn ui-btn-sm ${viewMode === 'table' ? 'ui-btn-primary' : 'ui-btn-secondary'}`}
                onClick={() => setViewMode('table')}
                title="Table view"
              >
                <List size={14} /> Table
              </button>
              <button
                type="button"
                className={`ui-btn ui-btn-sm ${viewMode === 'card' ? 'ui-btn-primary' : 'ui-btn-secondary'}`}
                onClick={() => setViewMode('card')}
                title="Card grid view"
              >
                <LayoutGrid size={14} /> Cards
              </button>
            </div>
          </div>
        </div>

        {/* Content Body */}
        {viewMode === 'card' ? (
          <div>
            {loading && !data ? (
              <div className="ui-table-state" style={{ padding: 40 }}>
                <LoadingSpinner text="Loading records..." />
              </div>
            ) : error && !data ? (
              <div style={{ padding: 20 }}>
                <BioEmpty title="Could not load records" text={error} />
              </div>
            ) : rows.length === 0 ? (
              <div style={{ padding: 20 }}>
                <BioEmpty
                  title="No records found"
                  text={
                    tab === 'curfew'
                      ? 'No late entries found for the selected dates. Great hostel discipline!'
                      : tab === 'overdue'
                        ? 'No hostellers currently overdue outside. All students accounted for.'
                        : tab === 'missing'
                          ? 'All active hostellers have recorded attendance for this date!'
                          : 'No frequent curfew violators found in the last 30 days.'
                  }
                />
              </div>
            ) : (
              <div className="bio-users-grid">
                {rows.map((row, idx) => {
                  const sPhone = cleanPhone(row.student_mobile);
                  const fPhone = cleanPhone(row.father_mobile);
                  return (
                    <div
                      key={`${row.reg_no}-${row.punch_time || row.out_time || idx}`}
                      className="bio-user-card"
                    >
                      <div className="bio-user-card-head">
                        <div className="bio-user-card-person">
                          <span className="bio-avatar">{initials(row.student_name)}</span>
                          <div>
                            <div className="bio-strong" style={{ fontSize: 14 }}>
                              {row.student_name}
                            </div>
                            <div className="bio-subtle bio-mono" style={{ fontSize: 12 }}>
                              {row.reg_no}
                            </div>
                          </div>
                        </div>
                        <div>
                          {tab === 'curfew' ? (
                            <span className="bio-status is-danger" style={{ fontSize: 11, padding: '3px 8px' }}>
                              +{row.minutes_past_curfew ?? 0}m Late
                            </span>
                          ) : tab === 'overdue' ? (
                            <span
                              className={`bio-status ${row.alert_level === 'CRITICAL' ? 'is-danger' : 'is-warning'}`}
                              style={{ fontSize: 11, padding: '3px 8px' }}
                            >
                              {row.alert_level === 'CRITICAL' ? 'CRITICAL OVERDUE' : `${row.hours_outside}h Away`}
                            </span>
                          ) : tab === 'missing' ? (
                            <span className="bio-status is-warning" style={{ fontSize: 11, padding: '3px 8px' }}>
                              No Punch Today
                            </span>
                          ) : (
                            <span className="bio-status is-danger" style={{ fontSize: 11, padding: '3px 8px' }}>
                              {row.total_late_entries} Late entries
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="bio-user-card-body">
                        <div className="bio-user-card-field">
                          <span className="bio-user-card-label">Room / Bed</span>
                          <span className="bio-user-card-value">
                            {row.room_no ? `Room ${row.room_no}` : '—'} {row.bed_no ? `(${row.bed_no})` : ''}
                          </span>
                        </div>

                        {tab === 'curfew' ? (
                          <>
                            <div className="bio-user-card-field">
                              <span className="bio-user-card-label">Return Punch</span>
                              <span className="bio-user-card-value bio-time" style={{ color: '#dc2626' }}>
                                {row.punch_time_formatted || (row.punch_time ? formatDateTime(row.punch_time) : '—')}
                              </span>
                            </div>
                            <div className="bio-user-card-field">
                              <span className="bio-user-card-label">Date</span>
                              <span className="bio-user-card-value">
                                {row.violation_date ? formatDate(row.violation_date) : '—'}
                              </span>
                            </div>
                            <div className="bio-user-card-field">
                              <span className="bio-user-card-label">Biometric Device</span>
                              <span className="bio-user-card-value bio-mono">{row.device_id || '—'}</span>
                            </div>
                          </>
                        ) : tab === 'overdue' ? (
                          <>
                            <div className="bio-user-card-field">
                              <span className="bio-user-card-label">Exit Punch Time</span>
                              <span className="bio-user-card-value bio-time">
                                {row.out_time_formatted || (row.out_time ? formatDateTime(row.out_time) : '—')}
                              </span>
                            </div>
                            <div className="bio-user-card-field">
                              <span className="bio-user-card-label">Hours Outside</span>
                              <span className="bio-user-card-value" style={{ color: '#ea580c' }}>
                                {row.hours_outside ?? 0} hrs
                              </span>
                            </div>
                          </>
                        ) : tab === 'frequent' ? (
                          <>
                            <div className="bio-user-card-field">
                              <span className="bio-user-card-label">Avg Minutes Late</span>
                              <span className="bio-user-card-value" style={{ color: '#dc2626' }}>
                                {row.avg_minutes_late ?? 0} mins
                              </span>
                            </div>
                            <div className="bio-user-card-field">
                              <span className="bio-user-card-label">Last Late Punch</span>
                              <span className="bio-user-card-value bio-time">
                                {row.last_late_punch_formatted || (row.last_late_punch ? formatDateTime(row.last_late_punch) : '—')}
                              </span>
                            </div>
                          </>
                        ) : (
                          <div className="bio-user-card-field">
                            <span className="bio-user-card-label">Guardian</span>
                            <span className="bio-user-card-value">{row.father_name || '—'}</span>
                          </div>
                        )}
                      </div>

                      {/* Contact & Emergency Actions */}
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          paddingTop: 10,
                          borderTop: '1px solid var(--border-subtle)',
                        }}
                      >
                        {fPhone ? (
                          <>
                            <a
                              href={`tel:${fPhone}`}
                              className="ui-btn ui-btn-sm ui-btn-secondary"
                              style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, flex: 1, justifyContent: 'center' }}
                              title={`Call Father: ${fPhone}`}
                            >
                              <Phone size={13} /> Call Parent
                            </a>
                            <a
                              href={`https://wa.me/91${fPhone}?text=Hello,%20this%20is%20from%20the%20Hostel%20Office%20regarding%20${encodeURIComponent(row.student_name)}.`}
                              target="_blank"
                              rel="noreferrer"
                              className="ui-btn ui-btn-sm ui-btn-secondary"
                              style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, color: '#16a34a' }}
                              title={`WhatsApp Parent: ${fPhone}`}
                            >
                              <MessageSquare size={13} />
                            </a>
                          </>
                        ) : sPhone ? (
                          <a
                            href={`tel:${sPhone}`}
                            className="ui-btn ui-btn-sm ui-btn-secondary"
                            style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, flex: 1, justifyContent: 'center' }}
                            title={`Call Student: ${sPhone}`}
                          >
                            <Phone size={13} /> Call Student
                          </a>
                        ) : (
                          <span className="bio-subtle" style={{ fontSize: 12 }}>
                            No contact on record
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          <div className="bio-table-wrap">
            <table className="ui-table bio-table">
              <thead>
                <tr>
                  <th>Student ID</th>
                  <th>Student Name</th>
                  <th>Room No</th>
                  {tab === 'curfew' ? (
                    <>
                      <th>Date</th>
                      <th>Return Punch</th>
                      <th>Minutes Late</th>
                      <th>Curfew Status</th>
                      <th>Device ID</th>
                      <th>Parent Mobile</th>
                      <th>Actions</th>
                    </>
                  ) : tab === 'overdue' ? (
                    <>
                      <th>Exit Punch Time</th>
                      <th>Hours Away</th>
                      <th>Alert Level</th>
                      <th>Student Mobile</th>
                      <th>Parent Mobile</th>
                      <th>Actions</th>
                    </>
                  ) : tab === 'missing' ? (
                    <>
                      <th>Bed</th>
                      <th>Roll Call Status</th>
                      <th>Guardian Name</th>
                      <th>Student Mobile</th>
                      <th>Parent Mobile</th>
                      <th>Actions</th>
                    </>
                  ) : (
                    <>
                      <th>Late Entries (30d)</th>
                      <th>Avg Delay</th>
                      <th>Last Late Punch</th>
                      <th>Parent Mobile</th>
                      <th>Actions</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody>
                <BioTableState
                  loading={loading && !data}
                  error={error && !data ? error : null}
                  empty={rows.length === 0}
                  colSpan={10}
                  emptyTitle="No records found"
                  emptyText={
                    tab === 'curfew'
                      ? 'No curfew violations recorded for the selected dates.'
                      : tab === 'overdue'
                        ? 'No hostellers currently overdue outside.'
                        : tab === 'missing'
                          ? 'All hostellers have recorded punches today.'
                          : 'No frequent violators in the last 30 days.'
                  }
                  onRetry={reload}
                />
                {rows.map((row, idx) => {
                  const sPhone = cleanPhone(row.student_mobile);
                  const fPhone = cleanPhone(row.father_mobile);
                  return (
                    <tr key={`${row.reg_no}-${row.punch_time || row.out_time || idx}`}>
                      <td className="bio-strong bio-mono">{row.reg_no}</td>
                      <td>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                          <span className="bio-avatar" style={{ width: 26, height: 26, fontSize: 11 }}>
                            {initials(row.student_name)}
                          </span>
                          <span className="bio-strong">{row.student_name}</span>
                        </div>
                      </td>
                      <td>
                        {row.room_no ? (
                          <span className="bio-strong">
                            {row.room_no} {row.bed_no ? <span className="bio-subtle">({row.bed_no})</span> : null}
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>

                      {tab === 'curfew' ? (
                        <>
                          <td>{row.violation_date ? formatDate(row.violation_date) : '—'}</td>
                          <td className="bio-time" style={{ color: '#dc2626', fontWeight: 600 }}>
                            {row.punch_time_formatted || (row.punch_time ? formatDateTime(row.punch_time) : '—')}
                          </td>
                          <td>
                            <span className="bio-status is-danger" style={{ fontWeight: 600 }}>
                              +{row.minutes_past_curfew ?? 0} mins
                            </span>
                          </td>
                          <td>
                            <span className="bio-status is-danger" style={{ fontSize: 11 }}>
                              LATE ENTRY
                            </span>
                          </td>
                          <td className="bio-mono bio-subtle">{row.device_id || '—'}</td>
                          <td className="bio-mono">{row.father_mobile || '—'}</td>
                          <td>
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                              {fPhone ? (
                                <>
                                  <a
                                    href={`tel:${fPhone}`}
                                    className="ui-btn ui-btn-sm ui-btn-secondary"
                                    style={{ padding: '3px 8px', fontSize: 11 }}
                                    title={`Call Father: ${fPhone}`}
                                  >
                                    <Phone size={12} /> Call
                                  </a>
                                  <a
                                    href={`https://wa.me/91${fPhone}?text=Hello,%20Hostel%20Office%20alert:%20${encodeURIComponent(row.student_name)}%20returned%20late%20after%20curfew%20at%20${encodeURIComponent(row.punch_time_formatted || '')}.`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="ui-btn ui-btn-sm ui-btn-secondary"
                                    style={{ padding: '3px 8px', fontSize: 11, color: '#16a34a' }}
                                    title="WhatsApp Parent"
                                  >
                                    <MessageSquare size={12} />
                                  </a>
                                </>
                              ) : sPhone ? (
                                <a
                                  href={`tel:${sPhone}`}
                                  className="ui-btn ui-btn-sm ui-btn-secondary"
                                  style={{ padding: '3px 8px', fontSize: 11 }}
                                  title={`Call Student: ${sPhone}`}
                                >
                                  <Phone size={12} /> Call
                                </a>
                              ) : (
                                '—'
                              )}
                            </div>
                          </td>
                        </>
                      ) : tab === 'overdue' ? (
                        <>
                          <td className="bio-time">
                            {row.out_time_formatted || (row.out_time ? formatDateTime(row.out_time) : '—')}
                          </td>
                          <td>
                            <span
                              className="bio-strong"
                              style={{ color: (row.hours_outside || 0) >= 8 ? '#dc2626' : '#ea580c' }}
                            >
                              {row.hours_outside ?? 0} hrs
                            </span>
                          </td>
                          <td>
                            <span
                              className={`bio-status ${row.alert_level === 'CRITICAL' ? 'is-danger' : 'is-warning'}`}
                              style={{ fontWeight: 600, fontSize: 11 }}
                            >
                              {row.alert_level === 'CRITICAL' ? 'CRITICAL OVERDUE' : 'AWAY'}
                            </span>
                          </td>
                          <td className="bio-mono">{row.student_mobile || '—'}</td>
                          <td className="bio-mono">{row.father_mobile || '—'}</td>
                          <td>
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                              {fPhone ? (
                                <>
                                  <a
                                    href={`tel:${fPhone}`}
                                    className="ui-btn ui-btn-sm ui-btn-secondary"
                                    style={{ padding: '3px 8px', fontSize: 11 }}
                                    title={`Call Parent: ${fPhone}`}
                                  >
                                    <Phone size={12} /> Parent
                                  </a>
                                  <a
                                    href={`https://wa.me/91${fPhone}?text=Hello,%20Hostel%20Office%20alert:%20${encodeURIComponent(row.student_name)}%20is%20still%20outside%20the%20hostel%20for%20${row.hours_outside}%20hours.`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="ui-btn ui-btn-sm ui-btn-secondary"
                                    style={{ padding: '3px 8px', fontSize: 11, color: '#16a34a' }}
                                    title="WhatsApp Parent"
                                  >
                                    <MessageSquare size={12} />
                                  </a>
                                </>
                              ) : null}
                              {sPhone ? (
                                <a
                                  href={`tel:${sPhone}`}
                                  className="ui-btn ui-btn-sm ui-btn-secondary"
                                  style={{ padding: '3px 8px', fontSize: 11 }}
                                  title={`Call Student: ${sPhone}`}
                                >
                                  <Phone size={12} /> Student
                                </a>
                              ) : null}
                            </div>
                          </td>
                        </>
                      ) : tab === 'missing' ? (
                        <>
                          <td>{row.bed_no || '—'}</td>
                          <td>
                            <span className="bio-status is-warning" style={{ fontWeight: 600, fontSize: 11 }}>
                              No Punch Recorded
                            </span>
                          </td>
                          <td>{row.father_name || '—'}</td>
                          <td className="bio-mono">{row.student_mobile || '—'}</td>
                          <td className="bio-mono">{row.father_mobile || '—'}</td>
                          <td>
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                              {fPhone ? (
                                <a
                                  href={`tel:${fPhone}`}
                                  className="ui-btn ui-btn-sm ui-btn-secondary"
                                  style={{ padding: '3px 8px', fontSize: 11 }}
                                  title={`Call Parent: ${fPhone}`}
                                >
                                  <Phone size={12} /> Parent
                                </a>
                              ) : null}
                              {sPhone ? (
                                <a
                                  href={`tel:${sPhone}`}
                                  className="ui-btn ui-btn-sm ui-btn-secondary"
                                  style={{ padding: '3px 8px', fontSize: 11 }}
                                  title={`Call Student: ${sPhone}`}
                                >
                                  <Phone size={12} /> Student
                                </a>
                              ) : null}
                            </div>
                          </td>
                        </>
                      ) : (
                        <>
                          <td>
                            <span className="bio-status is-danger" style={{ fontWeight: 600 }}>
                              {row.total_late_entries} Late Entries
                            </span>
                          </td>
                          <td>
                            <span className="bio-strong" style={{ color: '#dc2626' }}>
                              +{row.avg_minutes_late ?? 0} mins
                            </span>
                          </td>
                          <td className="bio-time">
                            {row.last_late_punch_formatted || (row.last_late_punch ? formatDateTime(row.last_late_punch) : '—')}
                          </td>
                          <td className="bio-mono">{row.father_mobile || '—'}</td>
                          <td>
                            {fPhone ? (
                              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                                <a
                                  href={`tel:${fPhone}`}
                                  className="ui-btn ui-btn-sm ui-btn-secondary"
                                  style={{ padding: '3px 8px', fontSize: 11 }}
                                  title={`Call Parent: ${fPhone}`}
                                >
                                  <Phone size={12} /> Call Parent
                                </a>
                                <a
                                  href={`https://wa.me/91${fPhone}?text=Hello,%20Hostel%20Office%20disciplinary%20notice:%20${encodeURIComponent(row.student_name)}%20has%20${row.total_late_entries}%20repeated%20late%20curfew%20entries.`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="ui-btn ui-btn-sm ui-btn-secondary"
                                  style={{ padding: '3px 8px', fontSize: 11, color: '#16a34a' }}
                                  title="WhatsApp Parent"
                                >
                                  <MessageSquare size={12} />
                                </a>
                              </div>
                            ) : (
                              '—'
                            )}
                          </td>
                        </>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

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

import { useEffect, useState } from 'react';
import {
  AlertOctagon,
  AlertTriangle,
  Calendar,
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
type DatePreset = 'today' | 'yesterday' | 'all' | 'custom';

const yesterdayDateStr = () => {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().split('T')[0];
};

const formatLateDuration = (mins?: number | null) => {
  if (mins === undefined || mins === null) return '—';
  if (mins < 60) return `+${mins}m late`;
  const hrs = Math.floor(mins / 60);
  const remaining = mins % 60;
  return `+${hrs}h ${remaining > 0 ? `${remaining}m ` : ''}late`;
};

const BioLateWarnings = () => {
  const [tab, setTab] = useState<ActiveTab>('curfew');
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [datePreset, setDatePreset] = useState<DatePreset>('all');
  const [date, setDate] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [viewMode, setViewMode] = useState<'table' | 'card'>('table');

  // Automatically default to card view on small mobile screens
  useEffect(() => {
    if (window.innerWidth < 768) {
      setViewMode('card');
    }
  }, []);

  // Compute effective query date
  const effectiveDate =
    datePreset === 'today'
      ? todayInput()
      : datePreset === 'yesterday'
        ? yesterdayDateStr()
        : datePreset === 'custom'
          ? date
          : undefined;

  const { data, loading, error, reload } = useApiData(
    () =>
      BiometricAttendanceAPI.lateWarnings({
        tab,
        page,
        limit: LIMIT,
        search,
        curfewTime: '19:00',
        date: effectiveDate,
        fromDate: datePreset === 'custom' && fromDate ? fromDate : undefined,
        toDate: datePreset === 'custom' && toDate ? toDate : undefined,
      }),
    [tab, page, search, datePreset, effectiveDate, fromDate, toDate],
  );

  const summary = data?.summary;
  const rows: LateWarningRow[] = data?.data || [];

  const handleTabChange = (newTab: ActiveTab) => {
    setTab(newTab);
    setPage(1);
  };

  const handlePresetChange = (preset: DatePreset) => {
    setDatePreset(preset);
    setPage(1);
    if (preset !== 'custom') {
      setDate('');
      setFromDate('');
      setToDate('');
    }
  };

  const handleExport = () => {
    if (!rows.length) return;
    let exportRows: Record<string, unknown>[] = [];
    let sheetName = 'Late Records';

    if (tab === 'curfew') {
      sheetName = 'Curfew Violations (After 7 PM)';
      exportRows = rows.map((r) => ({
        'Student ID': r.reg_no,
        'Student Name': r.student_name,
        Room: r.room_no || '',
        'Violation Date': r.violation_date ? formatDate(r.violation_date) : '',
        'Punch Time': r.punch_time_formatted || (r.punch_time ? formatDateTime(r.punch_time) : ''),
        'Minutes Late (Past 7 PM)': r.minutes_past_curfew ?? '',
        'Formatted Delay': formatLateDuration(r.minutes_past_curfew),
        'Student Mobile': r.student_mobile || '',
        'Father Mobile': r.father_mobile || '',
        Device: r.device_id || '',
      }));
    } else if (tab === 'overdue') {
      sheetName = 'Overdue Outside (Past 7 PM)';
      exportRows = rows.map((r) => ({
        'Student ID': r.reg_no,
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
        'Student ID': r.reg_no,
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
        'Student ID': r.reg_no,
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
        subtitle="Automatic real-time alerts for hostellers returning after 07:00 PM curfew, overdue outside, and students missing from roll call"
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

      <div style={{ marginTop: 14 }}>
        <BioStatGrid
          items={[
            {
              label: 'Late Returns (Today)',
              value: summary?.lateReturnsToday ?? '0',
              sub: 'Punched IN after 07:00 PM',
              icon: <AlertTriangle size={19} />,
              tone: (summary?.lateReturnsToday || 0) > 0 ? 'danger' : 'neutral',
            },
            {
              label: 'Critical Overdue (Now)',
              value: summary?.criticalOverdue ?? '0',
              sub: 'Outside past 07:00 PM / >8h',
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
              ? 'Late Return Punches (Curfew Violations > 07:00 PM)'
              : tab === 'overdue'
                ? 'Critical Overdue / Outside Past 07:00 PM'
                : tab === 'missing'
                  ? 'Missing / Absent Today (No Punch Recorded)'
                  : 'Frequent Curfew Violators (Last 30 Days)'
          }
          subtitle={
            tab === 'curfew'
              ? 'Hostellers who checked in after 07:00 PM evening curfew'
              : tab === 'overdue'
                ? 'Hostellers currently outside who have not returned past 07:00 PM or for excessive hours'
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
            <div className="ui-btn-group" style={{ display: 'inline-flex', flexWrap: 'wrap' }}>
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

        {/* Toolbar with Search, Date Quick Filters, View Switcher */}
        <div className="bio-toolbar">
          <div className="bio-filters" style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <BioSearchField
              value={search}
              onChange={(val) => {
                setSearch(val);
                setPage(1);
              }}
              placeholder="Search Student, Reg No, Room..."
            />

            {/* Quick Date Presets */}
            {tab === 'curfew' ? (
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                <div className="ui-btn-group">
                  <button
                    type="button"
                    className={`ui-btn ui-btn-sm ${datePreset === 'all' ? 'ui-btn-primary' : 'ui-btn-secondary'}`}
                    onClick={() => handlePresetChange('all')}
                  >
                    All Dates
                  </button>
                  <button
                    type="button"
                    className={`ui-btn ui-btn-sm ${datePreset === 'today' ? 'ui-btn-primary' : 'ui-btn-secondary'}`}
                    onClick={() => handlePresetChange('today')}
                  >
                    Today
                  </button>
                  <button
                    type="button"
                    className={`ui-btn ui-btn-sm ${datePreset === 'yesterday' ? 'ui-btn-primary' : 'ui-btn-secondary'}`}
                    onClick={() => handlePresetChange('yesterday')}
                  >
                    Yesterday (15/11)
                  </button>
                  <button
                    type="button"
                    className={`ui-btn ui-btn-sm ${datePreset === 'custom' ? 'ui-btn-primary' : 'ui-btn-secondary'}`}
                    onClick={() => handlePresetChange('custom')}
                  >
                    <Calendar size={13} /> Custom
                  </button>
                </div>

                {datePreset === 'custom' ? (
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <BioField label="From">
                      <input
                        type="date"
                        className="ui-input ui-input--inline"
                        value={fromDate}
                        onChange={(e) => {
                          setFromDate(e.target.value);
                          setPage(1);
                        }}
                      />
                    </BioField>
                    <BioField label="To">
                      <input
                        type="date"
                        className="ui-input ui-input--inline"
                        value={toDate}
                        onChange={(e) => {
                          setToDate(e.target.value);
                          setPage(1);
                        }}
                      />
                    </BioField>
                  </div>
                ) : null}
              </div>
            ) : tab === 'missing' ? (
              <BioField label="Roll Call Date">
                <input
                  type="date"
                  className="ui-input ui-input--inline"
                  value={date}
                  placeholder={todayInput()}
                  onChange={(e) => {
                    setDate(e.target.value);
                    setPage(1);
                  }}
                />
              </BioField>
            ) : null}

            {search || datePreset !== 'all' || date ? (
              <button
                type="button"
                className="ui-btn ui-btn-secondary ui-btn-sm"
                onClick={() => {
                  setSearch('');
                  setDatePreset('all');
                  setDate('');
                  setFromDate('');
                  setToDate('');
                  setPage(1);
                }}
              >
                Reset
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
                title="Card grid view (Mobile optimized)"
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
                      ? 'No late entries found after 07:00 PM for the selected date. Great hostel discipline!'
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
                          <span className="bio-avatar" style={{ flexShrink: 0 }}>
                            {initials(row.student_name)}
                          </span>
                          <div style={{ minWidth: 0 }}>
                            <div className="bio-strong" style={{ fontSize: 14, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {row.student_name}
                            </div>
                            <div className="bio-subtle bio-mono" style={{ fontSize: 12 }}>
                              {row.reg_no}
                            </div>
                          </div>
                        </div>
                        <div>
                          {tab === 'curfew' ? (
                            <span className="bio-status is-danger" style={{ fontSize: 11, padding: '3px 8px', fontWeight: 700 }}>
                              {formatLateDuration(row.minutes_past_curfew)}
                            </span>
                          ) : tab === 'overdue' ? (
                            <span
                              className={`bio-status ${row.alert_level === 'CRITICAL' ? 'is-danger' : 'is-warning'}`}
                              style={{ fontSize: 11, padding: '3px 8px', fontWeight: 700 }}
                            >
                              {row.alert_level === 'CRITICAL' ? 'CRITICAL OVERDUE' : `${row.hours_outside}h Away`}
                            </span>
                          ) : tab === 'missing' ? (
                            <span className="bio-status is-warning" style={{ fontSize: 11, padding: '3px 8px', fontWeight: 600 }}>
                              No Punch Today
                            </span>
                          ) : (
                            <span className="bio-status is-danger" style={{ fontSize: 11, padding: '3px 8px', fontWeight: 700 }}>
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
                                {formatLateDuration(row.avg_minutes_late)}
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
                              title={`Call Parent: ${fPhone}`}
                            >
                              <Phone size={13} /> Call Parent
                            </a>
                            <a
                              href={`https://wa.me/91${fPhone}?text=Hello,%20this%20is%20from%20the%20Hostel%20Office%20regarding%20${encodeURIComponent(row.student_name)}%20(Room%20${encodeURIComponent(row.room_no || '')}).`}
                              target="_blank"
                              rel="noreferrer"
                              className="ui-btn ui-btn-sm ui-btn-secondary"
                              style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, color: '#16a34a' }}
                              title={`WhatsApp Parent: ${fPhone}`}
                            >
                              <MessageSquare size={13} /> WhatsApp
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
            <table className="ui-table bio-table" style={{ minWidth: 980 }}>
              <thead>
                <tr>
                  <th>Student ID</th>
                  <th>Student Name</th>
                  <th>Room No</th>
                  {tab === 'curfew' ? (
                    <>
                      <th>Date</th>
                      <th>Return Punch</th>
                      <th>Delay Past 7 PM</th>
                      <th>Status</th>
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
                      ? 'No late entries found after 07:00 PM for the selected date.'
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

                      {tab === 'curfew' ? (
                        <>
                          <td style={{ whiteSpace: 'nowrap' }}>
                            {row.violation_date ? formatDate(row.violation_date) : '—'}
                          </td>
                          <td className="bio-time" style={{ color: '#dc2626', fontWeight: 600, whiteSpace: 'nowrap' }}>
                            {row.punch_time_formatted || (row.punch_time ? formatDateTime(row.punch_time) : '—')}
                          </td>
                          <td style={{ whiteSpace: 'nowrap' }}>
                            <span className="bio-status is-danger" style={{ fontWeight: 700 }}>
                              {formatLateDuration(row.minutes_past_curfew)}
                            </span>
                          </td>
                          <td style={{ whiteSpace: 'nowrap' }}>
                            <span className="bio-status is-danger" style={{ fontSize: 11 }}>
                              LATE ENTRY
                            </span>
                          </td>
                          <td className="bio-mono bio-subtle" style={{ whiteSpace: 'nowrap' }}>
                            {row.device_id || '—'}
                          </td>
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
                                    title={`Call Father: ${fPhone}`}
                                  >
                                    <Phone size={12} /> Call
                                  </a>
                                  <a
                                    href={`https://wa.me/91${fPhone}?text=Hello,%20Hostel%20Office%20alert:%20${encodeURIComponent(row.student_name)}%20returned%20late%20after%207%20PM%20curfew%20at%20${encodeURIComponent(row.punch_time_formatted || '')}%20(${formatLateDuration(row.minutes_past_curfew)}).`}
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
                          <td className="bio-time" style={{ whiteSpace: 'nowrap' }}>
                            {row.out_time_formatted || (row.out_time ? formatDateTime(row.out_time) : '—')}
                          </td>
                          <td style={{ whiteSpace: 'nowrap' }}>
                            <span
                              className="bio-strong"
                              style={{ color: (row.hours_outside || 0) >= 8 ? '#dc2626' : '#ea580c' }}
                            >
                              {row.hours_outside ?? 0} hrs
                            </span>
                          </td>
                          <td style={{ whiteSpace: 'nowrap' }}>
                            <span
                              className={`bio-status ${row.alert_level === 'CRITICAL' ? 'is-danger' : 'is-warning'}`}
                              style={{ fontWeight: 700, fontSize: 11 }}
                            >
                              {row.alert_level === 'CRITICAL' ? 'CRITICAL OVERDUE' : 'AWAY'}
                            </span>
                          </td>
                          <td className="bio-mono" style={{ whiteSpace: 'nowrap' }}>
                            {row.student_mobile || '—'}
                          </td>
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
                                    <Phone size={12} /> Parent
                                  </a>
                                  <a
                                    href={`https://wa.me/91${fPhone}?text=Hello,%20Hostel%20Office%20alert:%20${encodeURIComponent(row.student_name)}%20is%20still%20outside%20the%20hostel%20for%20${row.hours_outside}%20hours.`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="ui-btn ui-btn-sm ui-btn-secondary"
                                    style={{ padding: '3px 8px', fontSize: 11, color: '#16a34a', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                                    title="WhatsApp Parent"
                                  >
                                    <MessageSquare size={12} /> WhatsApp
                                  </a>
                                </>
                              ) : null}
                              {sPhone ? (
                                <a
                                  href={`tel:${sPhone}`}
                                  className="ui-btn ui-btn-sm ui-btn-secondary"
                                  style={{ padding: '3px 8px', fontSize: 11, display: 'inline-flex', alignItems: 'center', gap: 4 }}
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
                          <td style={{ whiteSpace: 'nowrap' }}>{row.bed_no || '—'}</td>
                          <td style={{ whiteSpace: 'nowrap' }}>
                            <span className="bio-status is-warning" style={{ fontWeight: 600, fontSize: 11 }}>
                              No Punch Recorded
                            </span>
                          </td>
                          <td style={{ whiteSpace: 'nowrap' }}>{row.father_name || '—'}</td>
                          <td className="bio-mono" style={{ whiteSpace: 'nowrap' }}>
                            {row.student_mobile || '—'}
                          </td>
                          <td className="bio-mono" style={{ whiteSpace: 'nowrap' }}>
                            {row.father_mobile || '—'}
                          </td>
                          <td style={{ whiteSpace: 'nowrap' }}>
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}>
                              {fPhone ? (
                                <a
                                  href={`tel:${fPhone}`}
                                  className="ui-btn ui-btn-sm ui-btn-secondary"
                                  style={{ padding: '3px 8px', fontSize: 11, display: 'inline-flex', alignItems: 'center', gap: 4 }}
                                  title={`Call Parent: ${fPhone}`}
                                >
                                  <Phone size={12} /> Parent
                                </a>
                              ) : null}
                              {sPhone ? (
                                <a
                                  href={`tel:${sPhone}`}
                                  className="ui-btn ui-btn-sm ui-btn-secondary"
                                  style={{ padding: '3px 8px', fontSize: 11, display: 'inline-flex', alignItems: 'center', gap: 4 }}
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
                          <td style={{ whiteSpace: 'nowrap' }}>
                            <span className="bio-status is-danger" style={{ fontWeight: 700 }}>
                              {row.total_late_entries} Late Entries
                            </span>
                          </td>
                          <td style={{ whiteSpace: 'nowrap' }}>
                            <span className="bio-strong" style={{ color: '#dc2626' }}>
                              {formatLateDuration(row.avg_minutes_late)}
                            </span>
                          </td>
                          <td className="bio-time" style={{ whiteSpace: 'nowrap' }}>
                            {row.last_late_punch_formatted || (row.last_late_punch ? formatDateTime(row.last_late_punch) : '—')}
                          </td>
                          <td className="bio-mono" style={{ whiteSpace: 'nowrap' }}>
                            {row.father_mobile || '—'}
                          </td>
                          <td style={{ whiteSpace: 'nowrap' }}>
                            {fPhone ? (
                              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}>
                                <a
                                  href={`tel:${fPhone}`}
                                  className="ui-btn ui-btn-sm ui-btn-secondary"
                                  style={{ padding: '3px 8px', fontSize: 11, display: 'inline-flex', alignItems: 'center', gap: 4 }}
                                  title={`Call Parent: ${fPhone}`}
                                >
                                  <Phone size={12} /> Call Parent
                                </a>
                                <a
                                  href={`https://wa.me/91${fPhone}?text=Hello,%20Hostel%20Office%20disciplinary%20notice:%20${encodeURIComponent(row.student_name)}%20has%20${row.total_late_entries}%20repeated%20late%20curfew%20entries.`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="ui-btn ui-btn-sm ui-btn-secondary"
                                  style={{ padding: '3px 8px', fontSize: 11, color: '#16a34a', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                                  title="WhatsApp Parent"
                                >
                                  <MessageSquare size={12} /> WhatsApp
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

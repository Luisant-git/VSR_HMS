import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import Select from 'react-select';
import {
  Users, Clock, Check, X, Search,
  RefreshCw, CheckCircle2, AlertCircle, Calendar, Phone, History
} from 'lucide-react';
import Swal from 'sweetalert2';
import { PageHeader } from '../components/PageHeader';
import { LoadingRow } from '../components/LoadingSpinner';
import { StaffAPI, type StaffAttendanceItem, type StaffMember } from '../api/staff.api';
import { getRoleBadgeStyle } from './StaffMaster';
import { formatDateDMY } from '../utils/date';

const historyStaffSelectStyles = {
  control: (base: any, state: any) => ({
    ...base,
    minHeight: '38px',
    borderRadius: '8px',
    borderColor: state.isFocused ? 'var(--accent)' : 'var(--border)',
    boxShadow: state.isFocused ? '0 0 0 3px var(--accent-soft)' : 'none',
    '&:hover': { borderColor: state.isFocused ? 'var(--accent)' : 'var(--border-strong)' },
    fontSize: '13px',
    background: 'var(--surface-muted)',
    minWidth: '220px'
  }),
  option: (base: any, state: any) => ({
    ...base,
    fontSize: '13px',
    backgroundColor: state.isSelected ? 'var(--accent)' : state.isFocused ? 'var(--surface-muted)' : 'white',
    color: state.isSelected ? 'white' : '#334155',
    cursor: 'pointer'
  }),
  menuPortal: (base: any) => ({ ...base, zIndex: 9999 })
};

export default function StaffAttendance() {
  const navigate = useNavigate();

  // Active tab: 'daily' | 'history'
  const [activeTab, setActiveTab] = useState<'daily' | 'history'>('daily');

  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().slice(0, 10)
  );
  const [roster, setRoster] = useState<StaffAttendanceItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Pagination matching Hostellers.tsx
  const [page, setPage] = useState<number>(1);
  const [limit, setLimit] = useState<number>(10);

  // Modal State
  const [modalOpen, setModalOpen] = useState<boolean>(false);
  const [activeItem, setActiveItem] = useState<StaffAttendanceItem | null>(null);
  const [submitting, setSubmitting] = useState<boolean>(false);

  // Modal Form State (without Shift field)
  const [formData, setFormData] = useState({
    checkInTime: '',
    checkOutTime: '',
    status: 'Present',
    remarks: ''
  });

  // ── Logs History Tab State ──────────────────────────────────────────────
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [historyFromDate, setHistoryFromDate] = useState<string>('');
  const [historyToDate, setHistoryToDate] = useState<string>('');
  const [historyStaffId, setHistoryStaffId] = useState<string>('ALL');
  const [historySearch, setHistorySearch] = useState<string>('');
  const [historyRecords, setHistoryRecords] = useState<any[]>([]);
  const [historyTotal, setHistoryTotal] = useState<number>(0);
  const [historySummary, setHistorySummary] = useState<{ present: number; absent: number; halfDay: number; onLeave: number }>({ present: 0, absent: 0, halfDay: 0, onLeave: 0 });
  const [historyPage, setHistoryPage] = useState<number>(1);
  const [historyLimit, setHistoryLimit] = useState<number>(25);
  const [historyTotalPages, setHistoryTotalPages] = useState<number>(1);
  const [historyLoading, setHistoryLoading] = useState<boolean>(false);
  // ───────────────────────────────────────────────────────────────────────

  const historyStaffOptions = useMemo(() => {
    return [
      { value: 'ALL', label: 'All Staff Members' },
      ...staffList.map(s => ({ value: s.id, label: `${s.name} (${s.staffCode})` }))
    ];
  }, [staffList]);

  const fetchRoster = async () => {
    try {
      setLoading(true);
      const data = await StaffAPI.getAttendanceRoster(selectedDate);
      setRoster(data || []);
    } catch (err: any) {
      console.error('Failed to fetch attendance roster:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchStaffList = async () => {
    try {
      const data = await StaffAPI.getAll({ status: 'Active' });
      setStaffList(data || []);
    } catch (err) {
      console.error('Failed to load staff list:', err);
    }
  };

  const fetchHistory = async (pg = historyPage) => {
    setHistoryLoading(true);
    try {
      const res = await StaffAPI.getAttendanceHistory({
        staffId: historyStaffId !== 'ALL' ? historyStaffId : undefined,
        fromDate: historyFromDate || undefined,
        toDate: historyToDate || undefined,
        search: historySearch || undefined,
        page: pg,
        limit: historyLimit,
      });
      setHistoryRecords(res.records || []);
      setHistoryTotal(res.total || 0);
      setHistorySummary(res.summary || { present: 0, absent: 0, halfDay: 0, onLeave: 0 });
      setHistoryTotalPages(res.totalPages || 1);
    } catch (err) {
      console.error('Failed to load history:', err);
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    fetchRoster();
  }, [selectedDate]);

  useEffect(() => {
    fetchStaffList();
  }, []);

  useEffect(() => {
    if (activeTab === 'history') {
      fetchHistory(historyPage);
    }
  }, [activeTab, historyPage, historyStaffId, historyFromDate, historyToDate, historySearch, historyLimit]);
  // Returns current time as HH:MM (24-hour) for <input type="time">
  const getCurrentTime24 = () => {
    const now = new Date();
    const h = String(now.getHours()).padStart(2, '0');
    const m = String(now.getMinutes()).padStart(2, '0');
    return `${h}:${m}`;
  };

  // Converts stored time strings ("09:00 AM" or "13:30") to HH:MM for <input type="time">
  const to24h = (timeStr: string): string => {
    if (!timeStr || timeStr === '--:--') return '';
    // Already HH:MM (24h)
    const match24 = timeStr.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
    if (match24) {
      return `${String(parseInt(match24[1], 10)).padStart(2, '0')}:${match24[2]}`;
    }
    // 12-hour format
    const match12 = timeStr.match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)$/i);
    if (match12) {
      let h = parseInt(match12[1], 10);
      const mn = match12[2];
      const mer = match12[3].toUpperCase();
      if (mer === 'AM' && h === 12) h = 0;
      else if (mer === 'PM' && h !== 12) h += 12;
      return `${String(h).padStart(2, '0')}:${mn}`;
    }
    return '';
  };

  const parseTimeToMinutes = (timeStr?: string | null): number | null => {
    if (!timeStr) return null;
    const s = timeStr.trim();
    if (s === '' || s === '--:--') return null;

    if (s.includes('T') || (s.includes('-') && s.length >= 10)) {
      const d = new Date(s);
      if (!isNaN(d.getTime())) return d.getHours() * 60 + d.getMinutes();
    }

    const match12 = s.match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)$/i);
    if (match12) {
      let hours = parseInt(match12[1], 10);
      const minutes = parseInt(match12[2], 10);
      const meridiem = match12[3].toUpperCase();
      if (hours === 12 && meridiem === 'AM') hours = 0;
      else if (hours < 12 && meridiem === 'PM') hours += 12;
      return hours * 60 + minutes;
    }

    const match24 = s.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
    if (match24) {
      const hours = parseInt(match24[1], 10);
      const minutes = parseInt(match24[2], 10);
      if (hours >= 0 && hours < 24 && minutes >= 0 && minutes < 60) {
        return hours * 60 + minutes;
      }
    }

    return null;
  };

  // Converts stored time strings ("09:00", "18:00", "05:30 PM") to 12-hour format ("09:00 AM", "06:00 PM")
  const to12h = (timeStr?: string): string => {
    if (!timeStr || timeStr === '--:--') return '--:--';
    const mins = parseTimeToMinutes(timeStr);
    if (mins === null) return timeStr;
    let h = Math.floor(mins / 60);
    const m = mins % 60;
    const mer = h >= 12 ? 'PM' : 'AM';
    if (h === 0) h = 12;
    else if (h > 12) h -= 12;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')} ${mer}`;
  };

  const calculateTimeDuration = (inTime?: string, outTime?: string) => {
    const inMin = parseTimeToMinutes(inTime);
    const outMin = parseTimeToMinutes(outTime);
    if (inMin === null || outMin === null) return null;

    const diff = outMin >= inMin ? outMin - inMin : (1440 - inMin) + outMin;
    const h = Math.floor(diff / 60);
    const m = diff % 60;
    const text = `${h}h ${m}m`;

    let suggestedStatus = 'Present';
    let badgeColor = '#16a34a';
    let label = 'Full Day (≥ 8 hrs)';
    if (diff >= 480) {
      suggestedStatus = 'Present';
      badgeColor = '#16a34a';
      label = 'Full Day (≥ 8 hrs)';
    } else if (diff >= 240) {
      suggestedStatus = 'Half Day';
      badgeColor = '#ea580c';
      label = 'Half Day (≥ 4 hrs)';
    } else {
      suggestedStatus = 'Absent';
      badgeColor = '#dc2626';
      label = 'Insufficient (< 4 hrs)';
    }

    return { minutes: diff, text, suggestedStatus, badgeColor, label };
  };

  const openAttendanceModal = (item: StaffAttendanceItem) => {
    setActiveItem(item);
    // Convert to HH:MM 24h for <input type="time">
    const existingCheckIn = item.checkInTime && item.checkInTime !== '--:--'
      ? to24h(item.checkInTime)
      : getCurrentTime24();
    const existingCheckOut = item.checkOutTime && item.checkOutTime !== '--:--'
      ? to24h(item.checkOutTime)
      : '';
    let existingStatus = item.status && item.status !== 'Not Marked' ? item.status : 'Present';

    // Auto classify if check-in and check-out exist and not manually set to On Leave/Absent
    const dur = calculateTimeDuration(existingCheckIn, existingCheckOut);
    if (dur && existingStatus !== 'On Leave' && existingStatus !== 'Absent') {
      existingStatus = dur.suggestedStatus;
    }

    setFormData({
      checkInTime: existingCheckIn,
      checkOutTime: existingCheckOut,
      status: existingStatus,
      remarks: item.remarks || ''
    });
    setModalOpen(true);
  };

  const handleSaveAttendance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeItem) return;

    setSubmitting(true);
    try {
      await StaffAPI.saveAttendance({
        staffId: activeItem.staffId,
        dateStr: selectedDate,
        checkInTime: formData.checkInTime.trim() || undefined,
        checkOutTime: formData.checkOutTime.trim() || undefined,
        status: formData.status,
        remarks: formData.remarks.trim() || undefined
      });

      Swal.fire({
        icon: 'success',
        title: 'Attendance Saved',
        text: `Attendance for "${activeItem.name}" updated successfully.`,
        confirmButtonColor: '#2563eb',
        timer: 1500
      });

      setModalOpen(false);
      fetchRoster();
    } catch (err: any) {
      console.error(err);
      Swal.fire({
        icon: 'error',
        title: 'Failed to Save',
        text: err.message || 'Could not save attendance log',
        confirmButtonColor: '#ef4444'
      });
    } finally {
      setSubmitting(false);
    }
  };

  // Filter calculations
  const filteredRoster = useMemo(() => {
    return roster.filter((item) => {
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const matchName = item.name.toLowerCase().includes(term);
        const matchCode = item.staffCode.toLowerCase().includes(term);
        const matchRole = item.role.toLowerCase().includes(term);
        if (!matchName && !matchCode && !matchRole) return false;
      }
      if (statusFilter !== 'ALL' && item.status !== statusFilter) {
        return false;
      }
      return true;
    });
  }, [roster, searchTerm, statusFilter]);

  const totalRecords = filteredRoster.length;
  const totalPages = Math.ceil(totalRecords / limit) || 1;

  const paginatedRoster = useMemo(() => {
    if (limit >= 99999) return filteredRoster;
    const start = (page - 1) * limit;
    return filteredRoster.slice(start, start + limit);
  }, [filteredRoster, page, limit]);

  // Summary counts
  const presentCount = roster.filter(r => r.status === 'Present').length;
  const absentCount = roster.filter(r => r.status === 'Absent').length;
  const onLeaveCount = roster.filter(r => r.status === 'On Leave').length;
  const halfDayCount = roster.filter(r => r.status === 'Half Day').length;

  // When filtering the Logs History, top stats cards reflect the filtered result set
  const hasHistoryFilter = historyStaffId !== 'ALL' || !!historyFromDate || !!historyToDate || !!historySearch.trim();
  const showHistoryStats = activeTab === 'history' && hasHistoryFilter;
  const statsPresent = showHistoryStats ? historySummary.present : presentCount;
  const statsHalfDay = showHistoryStats ? historySummary.halfDay : halfDayCount;
  const statsAbsent = showHistoryStats ? historySummary.absent : absentCount;
  const statsOnLeave = showHistoryStats ? historySummary.onLeave : onLeaveCount;

  const formatDisplayDate = (dStr: string) => {
    try {
      const d = new Date(dStr);
      return d.toLocaleDateString('en-GB', {
        weekday: 'short',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      });
    } catch {
      return dStr;
    }
  };

  return (
    <div className="ui-page">
      {/* PageHeader matching Hostellers.tsx */}
      <PageHeader
        title="Staff Gate In / Out Daily Attendance"
        subtitle={`Record duty check-in/out timestamps and monitor staff presence for ${formatDisplayDate(selectedDate)}`}
        showBack={true}
        icon={<Clock size={24} color="#fff" />} iconBg="linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)"
        rightContent={
          <div className="att-header-actions">
            <button
              onClick={() => navigate('/staff')}
              className="ui-btn ui-btn-primary"
            >
              <Users size={16} />
              Staff Master
            </button>
          </div>
        }
      />

      {/* Quick Stats Summary */}
      <div className="ui-stat-grid">
        <div className="ui-stat">
          <div className="ui-stat-icon is-success">
            <CheckCircle2 size={22} />
          </div>
          <div>
            <div className="ui-stat-label">Present</div>
            <div className="ui-stat-value is-success">{statsPresent}</div>
          </div>
        </div>

        <div className="ui-stat">
          <div className="ui-stat-icon is-warning">
            <Clock size={22} />
          </div>
          <div>
            <div className="ui-stat-label">Half Day</div>
            <div className="ui-stat-value is-warning">{statsHalfDay}</div>
          </div>
        </div>

        <div className="ui-stat">
          <div className="ui-stat-icon is-danger">
            <AlertCircle size={22} />
          </div>
          <div>
            <div className="ui-stat-label">Absent</div>
            <div className="ui-stat-value is-danger">{statsAbsent}</div>
          </div>
        </div>

        <div className="ui-stat">
          <div className="ui-stat-icon is-info">
            <Calendar size={22} />
          </div>
          <div>
            <div className="ui-stat-label">On Leave</div>
            <div className="ui-stat-value is-accent">{statsOnLeave}</div>
          </div>
        </div>
      </div>

      {/* ── Tab Navigation ─────────────────────────────────────── */}
      <div className="ui-tabs">
        <button
          onClick={() => setActiveTab('daily')}
          className={`ui-tab ${activeTab === 'daily' ? 'active' : ''}`}
        >
          <Calendar size={15} /> Daily Roster
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`ui-tab ${activeTab === 'history' ? 'active' : ''}`}
        >
          <History size={15} /> Logs History
        </button>
      </div>

      {/* ── DAILY ROSTER TAB ────────────────────────────────────── */}
      {activeTab === 'daily' && (
      <>
      {/* Filter and Search Bar matching Hostellers.tsx */}
      <div className="ui-toolbar">
        {/* Entries per page */}
        <div className="ui-toolbar-group">
          <span className="ui-toolbar-label">Show</span>
          <select
            value={limit}
            onChange={e => { setLimit(Number(e.target.value)); setPage(1); }}
            className="ui-select ui-select-sm"
          >
            <option value={10}>10</option>
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
            <option value={99999}>All</option>
          </select>
          <span className="ui-toolbar-label">entries</span>
        </div>
        <div className="ui-toolbar-divider"></div>

        {/* Date filter */}
        <div className="ui-toolbar-group">
          <Calendar size={16} color="var(--text-muted)" />
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="ui-input"
          />
        </div>

        <div className="ui-toolbar-divider"></div>

        {/* Search input with icon */}
        <div className="ui-search">
          <Search size={16} />
          <input
            type="text"
            placeholder="Search by staff name, code, designation..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setPage(1);
            }}
            className="ui-input att-search-input"
          />
        </div>

        {/* Status Filter */}
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="ui-select"
        >
          <option value="ALL">-- All Status --</option>
          <option value="Present">Present</option>
          <option value="Not Marked">Not Marked</option>
          <option value="Absent">Absent</option>
          <option value="Half Day">Half Day</option>
          <option value="On Leave">On Leave</option>
        </select>

        {/* Clear All Filters button */}
        {(searchTerm !== '' || statusFilter !== 'ALL') && (
          <button
            onClick={() => {
              setSearchTerm('');
              setStatusFilter('ALL');
              setPage(1);
            }}
            title="Clear all filters"
            className="ui-btn ui-btn-secondary"
          >
            <X size={14} strokeWidth={3} /> Clear All
          </button>
        )}

        <div className="ui-toolbar-spacer"></div>

        {/* Refresh button */}
        <button
          onClick={fetchRoster}
          title="Refresh Roster"
          className="ui-btn ui-btn-secondary"
        >
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {/* Duty Attendance Roster Table Card matching Hostellers.tsx */}
      <div className="ui-table-wrap">
        <table className="ui-table">
          <thead>
            <tr>
              <th>STAFF CODE</th>
              <th>STAFF MEMBER</th>
              <th>DESIGNATION</th>
              <th>CHECK-IN TIME</th>
              <th>CHECK-OUT TIME</th>
              <th>ATTENDANCE STATUS</th>
              <th className="is-right">UPDATE / MARK</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <LoadingRow colSpan={7} text="Loading Attendance Roster..." />
            ) : paginatedRoster.length === 0 ? (
              <tr>
                <td colSpan={7}>
                  <div className="ui-empty">
                    <Users size={36} />
                    <div className="ui-empty-title">No staff attendance records found</div>
                    <div className="ui-empty-text">All active staff members appear here automatically for the selected date.</div>
                  </div>
                </td>
              </tr>
            ) : (
              paginatedRoster.map((item) => {
                const isCheckedIn = item.checkInTime && item.checkInTime !== '--:--';
                const isCheckedOut = item.checkOutTime && item.checkOutTime !== '--:--';

                let statusVariant = 'ui-badge-neutral';
                if (item.status === 'Present') statusVariant = 'ui-badge-success';
                else if (item.status === 'Absent') statusVariant = 'ui-badge-danger';
                else if (item.status === 'Half Day') statusVariant = 'ui-badge-warning';
                else if (item.status === 'On Leave') statusVariant = 'ui-badge-purple';

                const roleBadge = getRoleBadgeStyle(item.role);

                return (
                  <tr key={item.staffId}>
                    <td>
                      <span className="ui-code">{item.staffCode}</span>
                    </td>
                    <td>
                      <div className="ui-cell-title">{item.name}</div>
                      {item.phone && (
                        <div className="ui-cell-sub">
                          <Phone size={11} /> {item.phone}
                        </div>
                      )}
                    </td>

                    <td>
                      <span
                        className="ui-badge"
                        style={{
                          background: roleBadge.bg,
                          color: roleBadge.color,
                          borderColor: roleBadge.border
                        }}
                      >
                        {item.role}
                      </span>
                    </td>

                    <td>
                      {isCheckedIn ? (
                        <span className="att-time-in">
                          <Clock size={13} /> {item.checkInTime}
                        </span>
                      ) : (
                        <span className="att-time-muted">--:--</span>
                      )}
                    </td>

                    <td>
                      {isCheckedOut ? (
                        <div>
                          <span className="att-time-out">
                            <Clock size={13} /> {to12h(item.checkOutTime)}
                          </span>
                          {item.workDuration && item.workDuration !== '--' && (
                            <div className="att-duration">
                              <span className="att-duration-pill">⏱️ {item.workDuration}</span>
                            </div>
                          )}
                        </div>
                      ) : isCheckedIn ? (
                        <div>
                          <span className="att-time-muted">--:--</span>
                          <div className="att-pending">
                            (On Duty • Pending Out)
                          </div>
                        </div>
                      ) : (
                        <span className="att-time-muted">--:--</span>
                      )}
                    </td>

                    <td>
                      <span className={`ui-badge ${statusVariant}`}>
                        {item.status === 'Present' && <Check size={11} strokeWidth={3} />}
                        {item.status === 'Absent' && <X size={11} strokeWidth={3} />}
                        {item.status === 'Half Day' && <Clock size={11} strokeWidth={3} />}
                        <span>
                          {item.status === 'Present' && isCheckedOut ? 'Full Day' : (item.status === 'Present' ? 'Present (On Duty)' : (item.status || 'Not Marked'))}
                        </span>
                      </span>
                    </td>

                    <td className="is-right">
                      <button
                        onClick={() => openAttendanceModal(item)}
                        className="ui-btn ui-btn-secondary"
                        title="Update check-in, check-out or status"
                      >
                        <Clock size={13} />
                        <span>Update / Mark</span>
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>

        {/* Pagination Controls matching Hostellers.tsx */}
        {totalPages > 0 && (
          <div className="ui-pagination">
            <div className="ui-page-info">
              Showing {totalRecords === 0 ? 0 : (page - 1) * limit + 1} to {Math.min(page * limit, totalRecords)} of {totalRecords} entries
            </div>
            <div className="ui-page-controls">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="ui-page-btn"
              >
                Previous
              </button>
              <button className="ui-page-btn is-current">
                {page}
              </button>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages || totalPages === 0}
                className="ui-page-btn"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
      </> /* end daily tab */
      )}

      {/* ── LOGS HISTORY TAB ────────────────────────────────────── */}
      {activeTab === 'history' && (
        <div className="ui-section">

          {/* Filters bar */}
          <div className="ui-toolbar">
            {/* Entries per page */}
            <div className="ui-toolbar-group">
              <span className="ui-toolbar-label">Show</span>
              <select
                value={historyLimit}
                onChange={e => { setHistoryLimit(Number(e.target.value)); setHistoryPage(1); }}
                className="ui-select ui-select-sm"
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
                <option value={99999}>All</option>
              </select>
              <span className="ui-toolbar-label">entries</span>
            </div>
            <div className="ui-toolbar-divider"></div>

            {/* Search bar */}
            <div className="ui-search">
              <Search size={16} />
              <input
                type="text"
                placeholder="Search logs by name, code, status..."
                value={historySearch}
                onChange={(e) => { setHistorySearch(e.target.value); setHistoryPage(1); }}
                className="ui-input att-search-history"
              />
            </div>

            {/* Staff filter (searchable) */}
            <div className="ui-toolbar-group">
              <Users size={15} color="#64748b" />
              <Select
                options={historyStaffOptions}
                value={historyStaffOptions.find(o => o.value === historyStaffId) || null}
                onChange={(opt) => { setHistoryStaffId(opt ? opt.value : 'ALL'); setHistoryPage(1); }}
                placeholder="Search staff..."
                styles={historyStaffSelectStyles}
                menuPortalTarget={typeof document !== 'undefined' ? document.body : null}
                menuPosition="fixed"
                isClearable={false}
              />
            </div>

            {/* Date From */}
            <div className="ui-toolbar-group">
              <span className="ui-toolbar-label is-strong">From:</span>
              <input
                type="date"
                value={historyFromDate}
                onChange={(e) => { setHistoryFromDate(e.target.value); setHistoryPage(1); }}
                className="ui-input"
              />
            </div>

            {/* Date To */}
            <div className="ui-toolbar-group">
              <span className="ui-toolbar-label is-strong">To:</span>
              <input
                type="date"
                value={historyToDate}
                onChange={(e) => { setHistoryToDate(e.target.value); setHistoryPage(1); }}
                className="ui-input"
              />
            </div>

            {/* Clear */}
            {(historyStaffId !== 'ALL' || historyFromDate || historyToDate) && (
              <button
                onClick={() => { setHistoryStaffId('ALL'); setHistoryFromDate(''); setHistoryToDate(''); setHistoryPage(1); }}
                className="ui-btn ui-btn-danger"
              >
                <X size={14} strokeWidth={3} /> Clear
              </button>
            )}

            <div className="ui-toolbar-spacer" />

            {/* Refresh */}
            <button
              onClick={() => fetchHistory(1)}
              className="ui-btn ui-btn-secondary"
            >
              <RefreshCw size={14} /> Refresh
            </button>
          </div>

          {/* History Table */}
          <div className="ui-table-wrap">
            <table className="ui-table">
              <thead>
                <tr>
                  <th>DATE</th>
                  <th>STAFF CODE</th>
                  <th>STAFF MEMBER</th>
                  <th>DESIGNATION</th>
                  <th>CHECK-IN</th>
                  <th>CHECK-OUT</th>
                  <th>STATUS</th>
                  <th>REMARKS</th>
                </tr>
              </thead>
              <tbody>
                {historyLoading ? (
                  <LoadingRow colSpan={8} text="Loading logs..." />
                ) : historyRecords.length === 0 ? (
                  <tr>
                    <td colSpan={8}>
                      <div className="ui-empty">
                        <History size={36} />
                        <div className="ui-empty-title">No attendance logs found</div>
                        <div className="ui-empty-text">Try adjusting the date range or staff filter.</div>
                      </div>
                    </td>
                  </tr>
                ) : (
                  historyRecords.map((r: any) => {
                    const roleBadge = getRoleBadgeStyle(r.staffRole || 'Staff');
                    let statusVariant = 'ui-badge-neutral';
                    if (r.status === 'Present') statusVariant = 'ui-badge-success';
                    else if (r.status === 'Absent') statusVariant = 'ui-badge-danger';
                    else if (r.status === 'Half Day') statusVariant = 'ui-badge-warning';
                    else if (r.status === 'On Leave') statusVariant = 'ui-badge-info';

                    return (
                      <tr key={r.id}>
                        <td>
                          <span className="att-date">{formatDateDMY(r.dateStr)}</span>
                        </td>
                        <td>
                          <span className="ui-code">{r.staffCode}</span>
                        </td>
                        <td>
                          <div className="ui-cell-title">{r.staffName}</div>
                          {r.phone && <div className="ui-cell-sub"><Phone size={10} />{r.phone}</div>}
                        </td>
                        <td>
                          <span
                            className="ui-badge"
                            style={{ background: roleBadge.bg, color: roleBadge.color, borderColor: roleBadge.border }}
                          >
                            {r.staffRole || 'Staff'}
                          </span>
                        </td>
                        <td>
                          <span className={r.checkInTime && r.checkInTime !== '--:--' ? 'att-time-in' : 'att-time-muted'}>
                            {r.checkInTime && r.checkInTime !== '--:--' ? <><Clock size={12} />{r.checkInTime}</> : '--:--'}
                          </span>
                        </td>
                        <td>
                          <span className={r.checkOutTime && r.checkOutTime !== '--:--' ? 'att-time-out' : 'att-time-muted'}>
                            {r.checkOutTime && r.checkOutTime !== '--:--' ? <><Clock size={12} />{to12h(r.checkOutTime)}</> : '--:--'}
                          </span>
                        </td>
                        <td>
                          <span className={`ui-badge ${statusVariant}`}>
                            {r.status === 'Present' && <Check size={11} strokeWidth={3} />}
                            {r.status === 'Absent' && <X size={11} strokeWidth={3} />}
                            {r.status === 'Half Day' && <Clock size={11} strokeWidth={2.5} />}
                            {r.status || 'Not Marked'}
                          </span>
                        </td>
                        <td className="att-remarks">{r.remarks || '—'}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>

            {/* History Pagination */}
            {historyTotal > 0 && (
              <div className="ui-pagination">
                <div className="ui-page-info">
                  Showing {historyTotal === 0 ? 0 : (historyPage - 1) * historyLimit + 1} to {Math.min(historyPage * historyLimit, historyTotal)} of {historyTotal} records
                </div>
                <div className="ui-page-controls">
                  <button
                    onClick={() => { const np = Math.max(1, historyPage - 1); setHistoryPage(np); }}
                    disabled={historyPage === 1}
                    className="ui-page-btn"
                  >Previous</button>
                  <button className="ui-page-btn is-current">{historyPage}</button>
                  <button
                    onClick={() => { const np = Math.min(historyTotalPages, historyPage + 1); setHistoryPage(np); }}
                    disabled={historyPage >= historyTotalPages}
                    className="ui-page-btn"
                  >Next</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {modalOpen && activeItem && (
        <div className="ui-modal-overlay" onClick={() => setModalOpen(false)}>
          <div className="ui-modal is-sm" onClick={(e) => e.stopPropagation()}>
            <div className="ui-modal-header is-accent">
              <div>
                <div className="ui-modal-title">
                  Staff Attendance: {activeItem.name}
                </div>
                <div className="ui-modal-subtitle">
                  {activeItem.staffCode} • {activeItem.role}
                </div>
              </div>
              <button
                onClick={() => setModalOpen(false)}
                className="ui-modal-close"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveAttendance}>
              <div className="ui-modal-body">
                <div className="ui-form-row">
                  <div className="ui-form-group">
                    <label className="ui-form-label">Check-In Time</label>
                    <div className="att-relative">
                      <input
                        type="time"
                        value={formData.checkInTime}
                        onChange={(e) => setFormData({ ...formData, checkInTime: e.target.value })}
                        className="ui-form-control att-time-input"
                      />
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, checkInTime: getCurrentTime24() })}
                        className="att-now-btn"
                      >
                        Now
                      </button>
                    </div>
                  </div>

                  <div className="ui-form-group">
                    <label className="ui-form-label">Check-Out Time</label>
                    <div className="att-relative">
                      <input
                        type="time"
                        value={formData.checkOutTime}
                        onChange={(e) => {
                          const val = e.target.value;
                          const dur = calculateTimeDuration(formData.checkInTime, val);
                          setFormData(prev => ({
                            ...prev,
                            checkOutTime: val,
                            status: (dur && prev.status !== 'On Leave' && prev.status !== 'Absent') ? dur.suggestedStatus : prev.status
                          }));
                        }}
                        className="ui-form-control att-time-input"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const nowStr = getCurrentTime24();
                          const dur = calculateTimeDuration(formData.checkInTime, nowStr);
                          setFormData(prev => ({
                            ...prev,
                            checkOutTime: nowStr,
                            status: (dur && prev.status !== 'On Leave' && prev.status !== 'Absent') ? dur.suggestedStatus : prev.status
                          }));
                        }}
                        className="att-now-btn"
                      >
                        Now
                      </button>
                    </div>
                  </div>
                </div>

                {/* Real-time Working Duration & Auto Classification Info */}
                {(() => {
                  const dur = calculateTimeDuration(formData.checkInTime, formData.checkOutTime);
                  if (dur) {
                    return (
                      <div className="att-duration-box">
                        <div>
                          <span className="att-duration-label">Total Working Duration: </span>
                          <strong className="att-duration-value">{dur.text}</strong>
                        </div>
                        <span
                          className="att-duration-tag"
                          style={{ color: dur.badgeColor, background: `${dur.badgeColor}15` }}
                        >
                          Auto: {dur.label}
                        </span>
                      </div>
                    );
                  }
                  return (
                    <div className="ui-note">
                      💡 <strong>Biometric Policy:</strong> ≥ 8 hrs = Full Day • ≥ 4 hrs = Half Day • &lt; 4 hrs = Insufficient
                    </div>
                  );
                })()}

                <div className="ui-form-group">
                  <label className="ui-form-label">Attendance Status</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    className="ui-form-control is-strong"
                  >
                    <option value="Present">Present (Full Duty)</option>
                    <option value="Half Day">Half Day</option>
                    <option value="Absent">Absent</option>
                    <option value="On Leave">On Leave</option>
                    <option value="Not Marked">Not Marked</option>
                  </select>
                </div>

                <div className="ui-form-group">
                  <label className="ui-form-label">Remarks / Duty Note (Optional)</label>
                  <textarea
                    rows={2}
                    value={formData.remarks}
                    onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                    placeholder="e.g. Left early for medical reason, overtime duty..."
                    className="ui-form-control"
                  />
                </div>
              </div>

              <div className="ui-modal-footer">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="ui-btn ui-btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="ui-btn ui-btn-primary"
                >
                  {submitting ? 'Saving...' : 'Save Attendance'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

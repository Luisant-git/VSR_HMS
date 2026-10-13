import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import Select from 'react-select';
import {
  Users, Clock, Check, X, Search,
  RefreshCw, CheckCircle2, AlertCircle, Calendar, Phone, History
} from 'lucide-react';
import Swal from 'sweetalert2';
import { PageHeader } from '../components/PageHeader';
import { StaffAPI, type StaffAttendanceItem, type StaffMember } from '../api/staff.api';
import { getRoleBadgeStyle } from './StaffMaster';

const historyStaffSelectStyles = {
  control: (base: any, state: any) => ({
    ...base,
    minHeight: '38px',
    borderRadius: '8px',
    borderColor: state.isFocused ? 'var(--sidebar-active)' : '#cbd5e1',
    boxShadow: state.isFocused ? '0 0 0 1px var(--sidebar-active)' : 'none',
    '&:hover': { borderColor: state.isFocused ? 'var(--sidebar-active)' : '#94a3b8' },
    fontSize: '13px',
    background: '#f8fafc',
    minWidth: '220px'
  }),
  option: (base: any, state: any) => ({
    ...base,
    fontSize: '13px',
    backgroundColor: state.isSelected ? 'var(--sidebar-active)' : state.isFocused ? '#f8f9fa' : 'white',
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
    new Date().toISOString().split('T')[0]
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
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      });
    } catch {
      return dStr;
    }
  };

  return (
    <div className="page-container" style={{ padding: '24px 30px', background: '#f8fafc', minHeight: '100vh', color: '#0f172a' }}>
      <style>{`
        .att-stat-card {
          background: #ffffff;
          border-radius: 12px;
          padding: 16px 20px;
          border: 1px solid var(--border-color);
          box-shadow: 0 2px 10px rgba(0,0,0,0.02);
          display: flex;
          align-items: center;
          gap: 14px;
          flex: 1;
          min-width: 220px;
        }

        .data-table th {
          padding: 15px 20px;
          font-size: 12px;
          color: #64748b;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          background: #ffffff;
          border-bottom: 1px solid #eaedf1;
          white-space: nowrap;
        }

        .data-table td {
          padding: 15px 20px;
          border-bottom: 1px solid #f1f5f9;
          vertical-align: middle;
          font-size: 13.5px;
        }

        .data-table tr:hover td {
          background: #f8fafc;
        }

        .staff-code-badge {
          color: var(--sidebar-active);
          font-weight: 700;
          font-size: 13px;
        }

        .designation-badge {
          background: #f1f5f9;
          color: #334155;
          padding: 4px 10px;
          border-radius: 6px;
          font-size: 12.5px;
          font-weight: 600;
          display: inline-block;
          border: 1px solid #e2e8f0;
        }

        .att-status-pill {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 4px 10px;
          border-radius: 9999px;
          font-size: 11.5px;
          font-weight: 700;
          letter-spacing: 0.2px;
        }

        .att-status-present {
          background: #dcfce7;
          color: #15803d;
          border: 1px solid #bbf7d0;
        }

        .att-status-not-marked {
          background: #fef9c3;
          color: #a16207;
          border: 1px solid #fef08a;
        }

        .att-status-absent {
          background: #fee2e2;
          color: #b91c1c;
          border: 1px solid #fecaca;
        }

        .att-status-halfday {
          background: #ffedd5;
          color: #c2410c;
          border: 1px solid #fed7aa;
        }

        .att-status-leave {
          background: #f3e8ff;
          color: #7e22ce;
          border: 1px solid #e9d5ff;
        }

        .btn-log-inout {
          border: 1px solid #cbd5e1;
          background: #ffffff;
          color: #0284c7;
          padding: 6px 14px;
          border-radius: 8px;
          font-weight: 700;
          font-size: 12.5px;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          transition: all 0.15s ease;
          box-shadow: 0 1px 2px rgba(0,0,0,0.02);
        }

        .btn-log-inout:hover {
          background: #0284c7;
          color: #ffffff;
          border-color: #0284c7;
        }

        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(15, 23, 42, 0.65);
          backdrop-filter: blur(4px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 9999;
          padding: 16px;
        }

        .modal-card-blue-header {
          background: #ffffff;
          border-radius: 14px;
          width: 100%;
          max-width: 480px;
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
          overflow: hidden;
          animation: modalAppear 0.2s cubic-bezier(0.16, 1, 0.3, 1);
        }

        @keyframes modalAppear {
          from {
            opacity: 0;
            transform: scale(0.96) translateY(8px);
          }
          to {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }

        .modal-header-blue {
          background: linear-gradient(135deg, #1d4ed8 0%, #2563eb 100%);
          color: #ffffff;
          padding: 16px 20px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .modal-body-pad {
          padding: 22px 24px;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .form-row-2 {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 14px;
        }

        .form-group label {
          display: block;
          font-size: 13px;
          font-weight: 600;
          color: #334155;
          margin-bottom: 6px;
        }

        .form-control {
          width: 100%;
          padding: 9px 12px;
          border-radius: 8px;
          border: 1px solid var(--border-color);
          font-size: 13px;
          color: #0f172a;
          outline: none;
          background: #ffffff;
          box-sizing: border-box;
        }

        .form-control:focus {
          border-color: #2563eb;
          box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.12);
        }

        .btn-cancel {
          background: #64748b;
          color: #ffffff;
          border: none;
          padding: 9px 18px;
          border-radius: 8px;
          font-weight: 600;
          font-size: 13.5px;
          cursor: pointer;
        }

        .btn-save-attendance {
          background: #2563eb;
          color: #ffffff;
          border: none;
          padding: 9px 20px;
          border-radius: 8px;
          font-weight: 600;
          font-size: 13.5px;
          cursor: pointer;
        }

        .btn-save-attendance:hover {
          background: #1d4ed8;
        }
      `}</style>

      {/* PageHeader matching Hostellers.tsx */}
      <PageHeader
        title="Staff Gate In / Out Daily Attendance"
        subtitle={`Record duty check-in/out timestamps and monitor staff presence for ${formatDisplayDate(selectedDate)}`}
        showBack={true}
rightContent={
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
           

            <button
              onClick={() => navigate('/staff')}
              style={{
                background: 'var(--sidebar-active)',
                color: 'white',
                border: 'none',
                padding: '12px 22px',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: 600,
                cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(74, 114, 250, 0.25)',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <Users size={16} />
              Staff Master
            </button>
          </div>
        }
      />

      {/* Quick Stats Summary */}
      <div style={{ display: 'flex', gap: '15px', marginBottom: '20px', flexWrap: 'wrap' }}>
        <div className="att-stat-card">
          <div style={{ width: 44, height: 44, borderRadius: 10, background: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#16a34a' }}>
            <CheckCircle2 size={22} />
          </div>
          <div>
            <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>Present</div>
            <div style={{ fontSize: '20px', fontWeight: 800, color: '#16a34a' }}>{statsPresent}</div>
          </div>
        </div>

        <div className="att-stat-card">
          <div style={{ width: 44, height: 44, borderRadius: 10, background: '#fffbeb', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#d97706' }}>
            <Clock size={22} />
          </div>
          <div>
            <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>Half Day</div>
            <div style={{ fontSize: '20px', fontWeight: 800, color: '#b45309' }}>{statsHalfDay}</div>
          </div>
        </div>

        <div className="att-stat-card">
          <div style={{ width: 44, height: 44, borderRadius: 10, background: '#fef2f2', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#dc2626' }}>
            <AlertCircle size={22} />
          </div>
          <div>
            <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>Absent</div>
            <div style={{ fontSize: '20px', fontWeight: 800, color: '#dc2626' }}>{statsAbsent}</div>
          </div>
        </div>

        <div className="att-stat-card">
          <div style={{ width: 44, height: 44, borderRadius: 10, background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2563eb' }}>
            <Calendar size={22} />
          </div>
          <div>
            <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>On Leave</div>
            <div style={{ fontSize: '20px', fontWeight: 800, color: '#1d4ed8' }}>{statsOnLeave}</div>
          </div>
        </div>
      </div>

      {/* ── Tab Navigation ─────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '20px', background: 'white', padding: '6px', borderRadius: '12px', border: '1px solid var(--border-color)', boxShadow: '0 2px 6px rgba(0,0,0,0.02)', width: 'fit-content' }}>
        <button
          onClick={() => setActiveTab('daily')}
          style={{
            display: 'flex', alignItems: 'center', gap: '7px',
            padding: '9px 20px', borderRadius: '8px', fontSize: '13.5px', fontWeight: 600,
            cursor: 'pointer', border: 'none', transition: 'all 0.15s',
            background: activeTab === 'daily' ? 'var(--sidebar-active)' : 'transparent',
            color: activeTab === 'daily' ? 'white' : '#64748b',
            boxShadow: activeTab === 'daily' ? '0 2px 8px rgba(37,99,235,0.2)' : 'none'
          }}
        >
          <Calendar size={15} /> Daily Roster
        </button>
        <button
          onClick={() => setActiveTab('history')}
          style={{
            display: 'flex', alignItems: 'center', gap: '7px',
            padding: '9px 20px', borderRadius: '8px', fontSize: '13.5px', fontWeight: 600,
            cursor: 'pointer', border: 'none', transition: 'all 0.15s',
            background: activeTab === 'history' ? 'var(--sidebar-active)' : 'transparent',
            color: activeTab === 'history' ? 'white' : '#64748b',
            boxShadow: activeTab === 'history' ? '0 2px 8px rgba(37,99,235,0.2)' : 'none'
          }}
        >
          <History size={15} /> Logs History
        </button>
      </div>

      {/* ── DAILY ROSTER TAB ────────────────────────────────────── */}
      {activeTab === 'daily' && (
      <>
      {/* Filter and Search Bar matching Hostellers.tsx */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: '15px',
        padding: '15px 20px',
        background: 'white',
        border: '1px solid var(--border-color)',
        borderRadius: '12px',
        marginBottom: '20px',
        boxShadow: '0 2px 10px rgba(0,0,0,0.02)'
      }}>
        {/* Entries per page */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '13px', color: '#64748b' }}>Show</span>
          <select
            value={limit}
            onChange={e => { setLimit(Number(e.target.value)); setPage(1); }}
            style={{ padding: '6px 8px', borderRadius: '6px', border: '1px solid var(--border-color)', fontSize: '13px', outline: 'none', cursor: 'pointer', background: '#f8fafc' }}
          >
            <option value={10}>10</option>
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
            <option value={99999}>All</option>
          </select>
          <span style={{ fontSize: '13px', color: '#64748b' }}>entries</span>
        </div>
        <div style={{ width: '1px', height: '24px', background: 'var(--border-color)', margin: '0 5px' }}></div>

        {/* Search input with icon */}
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
          <Search size={16} color="var(--text-muted)" style={{ position: 'absolute', left: '12px' }} />
          <input
            type="text"
            placeholder="Search by staff name, code, designation..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setPage(1);
            }}
            style={{
              padding: '8px 12px 8px 36px',
              borderRadius: '8px',
              border: '1px solid var(--border-color)',
              fontSize: '13px',
              outline: 'none',
              width: '280px'
            }}
          />
        </div>

        {/* Status Filter */}
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '13px', outline: 'none', cursor: 'pointer', background: '#f8fafc' }}
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
            style={{
              background: '#f1f5f9',
              color: '#64748b',
              border: 'none',
              padding: '8px 16px',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.2s'
            }}
            onMouseOver={(e) => { e.currentTarget.style.background = '#e2e8f0'; e.currentTarget.style.color = '#334155'; }}
            onMouseOut={(e) => { e.currentTarget.style.background = '#f1f5f9'; e.currentTarget.style.color = '#64748b'; }}
          >
            <X size={14} strokeWidth={3} /> Clear All
          </button>
        )}

        <div style={{ flex: 1 }}></div>

        {/* Refresh button */}
        <button
          onClick={fetchRoster}
          title="Refresh Roster"
          style={{
            background: '#f8fafc',
            color: '#475569',
            border: '1px solid var(--border-color)',
            padding: '8px 14px',
            borderRadius: '8px',
            fontSize: '13px',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {/* Duty Attendance Roster Table Card matching Hostellers.tsx */}
      <div style={{ overflowX: 'auto', background: 'white', borderRadius: '12px', padding: '0', border: '1px solid var(--border-color)', boxShadow: '0 2px 10px rgba(0,0,0,0.02)' }}>
        <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'white', borderBottom: '1px solid #eaedf1', textAlign: 'left' }}>
              <th>STAFF CODE</th>
              <th>STAFF MEMBER</th>
              <th>DESIGNATION</th>
              <th>CHECK-IN TIME</th>
              <th>CHECK-OUT TIME</th>
              <th>ATTENDANCE STATUS</th>
              <th style={{ textAlign: 'right' }}>UPDATE / MARK</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>
                  Loading Attendance Roster...
                </td>
              </tr>
            ) : paginatedRoster.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: '50px 20px', color: '#64748b' }}>
                  <Users size={36} color="#cbd5e1" style={{ margin: '0 auto 10px' }} />
                  <div style={{ fontWeight: 600, color: '#334155' }}>No staff attendance records found</div>
                  <div style={{ fontSize: '12px', marginTop: '4px' }}>All active staff members appear here automatically for the selected date.</div>
                </td>
              </tr>
            ) : (
              paginatedRoster.map((item) => {
                const isCheckedIn = item.checkInTime && item.checkInTime !== '--:--';
                const isCheckedOut = item.checkOutTime && item.checkOutTime !== '--:--';

                let statusClass = 'att-status-not-marked';
                if (item.status === 'Present') statusClass = 'att-status-present';
                else if (item.status === 'Absent') statusClass = 'att-status-absent';
                else if (item.status === 'Half Day') statusClass = 'att-status-halfday';
                else if (item.status === 'On Leave') statusClass = 'att-status-leave';

                const roleBadge = getRoleBadgeStyle(item.role);

                return (
                  <tr key={item.staffId}>
                    <td>
                      <span className="staff-code-badge">{item.staffCode}</span>
                    </td>
                    <td>
                      <div style={{ fontWeight: 600, color: '#0f172a' }}>{item.name}</div>
                      {item.phone && (
                        <div style={{ fontSize: '12px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                          <Phone size={11} /> {item.phone}
                        </div>
                      )}
                    </td>

                    <td>
                      <span style={{
                        background: roleBadge.bg,
                        color: roleBadge.color,
                        border: `1px solid ${roleBadge.border}`,
                        padding: '5px 12px',
                        borderRadius: '8px',
                        fontSize: '12.5px',
                        fontWeight: 700,
                        display: 'inline-block',
                        boxShadow: '0 1px 2px rgba(0,0,0,0.03)'
                      }}>
                        {item.role}
                      </span>
                    </td>

                    <td>
                      {isCheckedIn ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', color: '#15803d', fontWeight: 700, fontSize: '13px' }}>
                          <Clock size={13} /> {item.checkInTime}
                        </span>
                      ) : (
                        <span style={{ color: '#94a3b8', fontSize: '13px', fontStyle: 'italic' }}>--:--</span>
                      )}
                    </td>

                    <td>
                      {isCheckedOut ? (
                        <div>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', color: '#0284c7', fontWeight: 700, fontSize: '13px' }}>
                            <Clock size={13} /> {to12h(item.checkOutTime)}
                          </span>
                          {item.workDuration && item.workDuration !== '--' && (
                            <div style={{ fontSize: '11px', color: '#475569', fontWeight: 600, marginTop: '2px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <span style={{ background: '#f1f5f9', padding: '1px 6px', borderRadius: '4px', border: '1px solid #e2e8f0', color: '#334155' }}>
                                ⏱️ {item.workDuration}
                              </span>
                            </div>
                          )}
                        </div>
                      ) : isCheckedIn ? (
                        <div>
                          <span style={{ color: '#94a3b8', fontSize: '13px', fontStyle: 'italic' }}>--:--</span>
                          <div style={{ fontSize: '11px', color: '#d97706', fontWeight: 600, marginTop: '2px' }}>
                            (On Duty • Pending Out)
                          </div>
                        </div>
                      ) : (
                        <span style={{ color: '#94a3b8', fontSize: '13px', fontStyle: 'italic' }}>--:--</span>
                      )}
                    </td>

                    <td>
                      <span className={`att-status-pill ${statusClass}`}>
                        {item.status === 'Present' && <Check size={11} strokeWidth={3} />}
                        {item.status === 'Absent' && <X size={11} strokeWidth={3} />}
                        {item.status === 'Half Day' && <Clock size={11} strokeWidth={3} />}
                        <span>
                          {item.status === 'Present' && isCheckedOut ? 'Full Day' : (item.status === 'Present' ? 'Present (On Duty)' : (item.status || 'Not Marked'))}
                        </span>
                      </span>
                    </td>

                    <td style={{ textAlign: 'right' }}>
                      <button
                        onClick={() => openAttendanceModal(item)}
                        className="btn-log-inout"
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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 24px', borderTop: '1px solid #e2e8f0', background: '#f8fafc', borderBottomLeftRadius: '12px', borderBottomRightRadius: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
              <div style={{ fontSize: '13px', color: '#64748b', fontWeight: 500 }}>
                Showing {totalRecords === 0 ? 0 : (page - 1) * limit + 1} to {Math.min(page * limit, totalRecords)} of {totalRecords} entries
              </div>
            </div>
            <div style={{ display: 'flex', gap: '4px' }}>
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', background: page === 1 ? '#f1f5f9' : 'white', color: page === 1 ? '#94a3b8' : '#334155', cursor: page === 1 ? 'not-allowed' : 'pointer', fontSize: '13px', fontWeight: 600 }}>
                Previous
              </button>
              <button
                style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid var(--sidebar-active)', background: 'var(--sidebar-active)', color: 'white', cursor: 'default', fontSize: '13px', fontWeight: 600 }}>
                {page}
              </button>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages || totalPages === 0}
                style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', background: (page === totalPages || totalPages === 0) ? '#f1f5f9' : 'white', color: (page === totalPages || totalPages === 0) ? '#94a3b8' : '#334155', cursor: (page === totalPages || totalPages === 0) ? 'not-allowed' : 'pointer', fontSize: '13px', fontWeight: 600 }}>
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

          {/* Filters bar */}
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '12px', padding: '15px 20px', background: 'white', border: '1px solid var(--border-color)', borderRadius: '12px', boxShadow: '0 2px 6px rgba(0,0,0,0.02)' }}>
            {/* Entries per page */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '13px', color: '#64748b' }}>Show</span>
              <select
                value={historyLimit}
                onChange={e => { setHistoryLimit(Number(e.target.value)); setHistoryPage(1); }}
                style={{ padding: '6px 8px', borderRadius: '6px', border: '1px solid var(--border-color)', fontSize: '13px', outline: 'none', cursor: 'pointer', background: '#f8fafc' }}
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
                <option value={99999}>All</option>
              </select>
              <span style={{ fontSize: '13px', color: '#64748b' }}>entries</span>
            </div>
            <div style={{ width: '1px', height: '24px', background: 'var(--border-color)', margin: '0 5px' }}></div>

            {/* Search bar */}
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <Search size={16} color="#94a3b8" style={{ position: 'absolute', left: '12px' }} />
              <input
                type="text"
                placeholder="Search logs by name, code, status..."
                value={historySearch}
                onChange={(e) => { setHistorySearch(e.target.value); setHistoryPage(1); }}
                style={{ padding: '8px 12px 8px 36px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', outline: 'none', width: '260px', background: '#f8fafc' }}
              />
            </div>

            {/* Staff filter (searchable) */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
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
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '13px', fontWeight: 600, color: '#64748b' }}>From:</span>
              <input
                type="date"
                value={historyFromDate}
                onChange={(e) => { setHistoryFromDate(e.target.value); setHistoryPage(1); }}
                style={{ padding: '8px 10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', outline: 'none', background: '#f8fafc' }}
              />
            </div>

            {/* Date To */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '13px', fontWeight: 600, color: '#64748b' }}>To:</span>
              <input
                type="date"
                value={historyToDate}
                onChange={(e) => { setHistoryToDate(e.target.value); setHistoryPage(1); }}
                style={{ padding: '8px 10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', outline: 'none', background: '#f8fafc' }}
              />
            </div>

            {/* Clear */}
            {(historyStaffId !== 'ALL' || historyFromDate || historyToDate) && (
              <button
                onClick={() => { setHistoryStaffId('ALL'); setHistoryFromDate(''); setHistoryToDate(''); setHistoryPage(1); }}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', borderRadius: '8px', border: '1px solid #fecaca', background: '#fef2f2', color: '#dc2626', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}
              >
                <X size={14} strokeWidth={3} /> Clear
              </button>
            )}

            <div style={{ flex: 1 }} />

            {/* Refresh */}
            <button
              onClick={() => fetchHistory(1)}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#f8fafc', color: '#475569', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}
            >
              <RefreshCw size={14} /> Refresh
            </button>
          </div>

          {/* History Table */}
          <div style={{ overflowX: 'auto', background: 'white', borderRadius: '12px', border: '1px solid var(--border-color)', boxShadow: '0 2px 10px rgba(0,0,0,0.02)' }}>
            <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'white', borderBottom: '1px solid #eaedf1', textAlign: 'left' }}>
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
                  <tr><td colSpan={8} style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>Loading logs...</td></tr>
                ) : historyRecords.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', padding: '50px 20px', color: '#64748b' }}>
                      <History size={36} color="#cbd5e1" style={{ margin: '0 auto 10px' }} />
                      <div style={{ fontWeight: 600, color: '#334155' }}>No attendance logs found</div>
                      <div style={{ fontSize: '12px', marginTop: '4px' }}>Try adjusting the date range or staff filter.</div>
                    </td>
                  </tr>
                ) : (
                  historyRecords.map((r: any) => {
                    const roleBadge = getRoleBadgeStyle(r.staffRole || 'Staff');
                    let statusBg = '#f1f5f9'; let statusColor = '#64748b'; let statusBorder = '#e2e8f0';
                    if (r.status === 'Present') { statusBg = '#f0fdf4'; statusColor = '#16a34a'; statusBorder = '#bbf7d0'; }
                    else if (r.status === 'Absent') { statusBg = '#fef2f2'; statusColor = '#dc2626'; statusBorder = '#fecaca'; }
                    else if (r.status === 'Half Day') { statusBg = '#fffbeb'; statusColor = '#d97706'; statusBorder = '#fde68a'; }
                    else if (r.status === 'On Leave') { statusBg = '#eff6ff'; statusColor = '#2563eb'; statusBorder = '#bfdbfe'; }

                    return (
                      <tr key={r.id}>
                        <td>
                          <span style={{ fontWeight: 700, color: '#334155', fontFamily: 'monospace', fontSize: '13px' }}>{r.dateStr}</span>
                        </td>
                        <td>
                          <span className="staff-code-badge">{r.staffCode}</span>
                        </td>
                        <td>
                          <div style={{ fontWeight: 600, color: '#0f172a' }}>{r.staffName}</div>
                          {r.phone && <div style={{ fontSize: '11.5px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '3px', marginTop: '2px' }}><Phone size={10} />{r.phone}</div>}
                        </td>
                        <td>
                          <span style={{ background: roleBadge.bg, color: roleBadge.color, border: `1px solid ${roleBadge.border}`, padding: '3px 9px', borderRadius: '6px', fontSize: '12px', fontWeight: 700, display: 'inline-block' }}>
                            {r.staffRole || 'Staff'}
                          </span>
                        </td>
                        <td>
                          <span style={{ color: r.checkInTime && r.checkInTime !== '--:--' ? '#15803d' : '#94a3b8', fontWeight: r.checkInTime && r.checkInTime !== '--:--' ? 700 : 400, fontSize: '13px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            {r.checkInTime && r.checkInTime !== '--:--' ? <><Clock size={12} />{r.checkInTime}</> : '--:--'}
                          </span>
                        </td>
                        <td>
                          <span style={{ color: r.checkOutTime && r.checkOutTime !== '--:--' ? '#0284c7' : '#94a3b8', fontWeight: r.checkOutTime && r.checkOutTime !== '--:--' ? 700 : 400, fontSize: '13px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            {r.checkOutTime && r.checkOutTime !== '--:--' ? <><Clock size={12} />{to12h(r.checkOutTime)}</> : '--:--'}
                          </span>
                        </td>
                        <td>
                          <span style={{ background: statusBg, color: statusColor, border: `1px solid ${statusBorder}`, padding: '3px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                            {r.status === 'Present' && <Check size={11} strokeWidth={3} />}
                            {r.status === 'Absent' && <X size={11} strokeWidth={3} />}
                            {r.status === 'Half Day' && <Clock size={11} strokeWidth={2.5} />}
                            {r.status || 'Not Marked'}
                          </span>
                        </td>
                        <td style={{ fontSize: '12.5px', color: '#64748b' }}>{r.remarks || '—'}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>

            {/* History Pagination */}
            {historyTotal > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 24px', borderTop: '1px solid #e2e8f0', background: '#f8fafc', borderBottomLeftRadius: '12px', borderBottomRightRadius: '12px' }}>
                <div style={{ fontSize: '13px', color: '#64748b', fontWeight: 500 }}>
                  Showing {historyTotal === 0 ? 0 : (historyPage - 1) * historyLimit + 1} to {Math.min(historyPage * historyLimit, historyTotal)} of {historyTotal} records
                </div>
                <div style={{ display: 'flex', gap: '4px' }}>
                  <button
                    onClick={() => { const np = Math.max(1, historyPage - 1); setHistoryPage(np); }}
                    disabled={historyPage === 1}
                    style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', background: historyPage === 1 ? '#f1f5f9' : 'white', color: historyPage === 1 ? '#94a3b8' : '#334155', cursor: historyPage === 1 ? 'not-allowed' : 'pointer', fontSize: '13px', fontWeight: 600 }}
                  >Previous</button>
                  <button style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid var(--sidebar-active)', background: 'var(--sidebar-active)', color: 'white', cursor: 'default', fontSize: '13px', fontWeight: 600 }}>{historyPage}</button>
                  <button
                    onClick={() => { const np = Math.min(historyTotalPages, historyPage + 1); setHistoryPage(np); }}
                    disabled={historyPage >= historyTotalPages}
                    style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', background: historyPage >= historyTotalPages ? '#f1f5f9' : 'white', color: historyPage >= historyTotalPages ? '#94a3b8' : '#334155', cursor: historyPage >= historyTotalPages ? 'not-allowed' : 'pointer', fontSize: '13px', fontWeight: 600 }}
                  >Next</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {modalOpen && activeItem && (
        <div className="modal-overlay" onClick={() => setModalOpen(false)}>
          <div className="modal-card-blue-header" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header-blue">
              <div>
                <div style={{ fontSize: '15px', fontWeight: 700 }}>
                  Staff Attendance: {activeItem.name}
                </div>
                <div style={{ fontSize: '12px', color: '#bfdbfe', marginTop: '2px' }}>
                  {activeItem.staffCode} • {activeItem.role}
                </div>
              </div>
              <button
                onClick={() => setModalOpen(false)}
                style={{ background: 'none', border: 'none', color: '#ffffff', cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center', opacity: 0.8 }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveAttendance}>
              <div className="modal-body-pad">
                <div className="form-row-2">
                  <div className="form-group">
                    <label>Check-In Time</label>
                    <div style={{ position: 'relative' }}>
                      <input
                        type="time"
                        value={formData.checkInTime}
                        onChange={(e) => setFormData({ ...formData, checkInTime: e.target.value })}
                        className="form-control"
                        style={{ paddingRight: '70px' }}
                      />
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, checkInTime: getCurrentTime24() })}
                        style={{ position: 'absolute', right: '6px', top: '7px', fontSize: '11px', background: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe', borderRadius: '5px', padding: '2px 6px', cursor: 'pointer', fontWeight: 600 }}
                      >
                        Now
                      </button>
                    </div>
                  </div>

                  <div className="form-group">
                    <label>Check-Out Time</label>
                    <div style={{ position: 'relative' }}>
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
                        className="form-control"
                        style={{ paddingRight: '70px' }}
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
                        style={{ position: 'absolute', right: '6px', top: '7px', fontSize: '11px', background: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe', borderRadius: '5px', padding: '2px 6px', cursor: 'pointer', fontWeight: 600 }}
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
                      <div style={{ background: '#f8fafc', border: `1px solid ${dur.badgeColor}33`, padding: '10px 14px', borderRadius: '8px', marginBottom: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>Total Working Duration: </span>
                          <strong style={{ fontSize: '13px', color: '#0f172a' }}>{dur.text}</strong>
                        </div>
                        <span style={{ fontSize: '12px', fontWeight: 700, color: dur.badgeColor, background: `${dur.badgeColor}15`, padding: '3px 10px', borderRadius: '6px' }}>
                          Auto: {dur.label}
                        </span>
                      </div>
                    );
                  }
                  return (
                    <div style={{ fontSize: '11.5px', color: '#64748b', marginBottom: '14px', background: '#f8fafc', padding: '8px 12px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                      💡 <strong>Biometric Policy:</strong> ≥ 8 hrs = Full Day • ≥ 4 hrs = Half Day • &lt; 4 hrs = Insufficient
                    </div>
                  );
                })()}

                <div className="form-group">
                  <label>Attendance Status</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    className="form-control"
                    style={{ fontWeight: 600 }}
                  >
                    <option value="Present">Present (Full Duty)</option>
                    <option value="Half Day">Half Day</option>
                    <option value="Absent">Absent</option>
                    <option value="On Leave">On Leave</option>
                    <option value="Not Marked">Not Marked</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Remarks / Duty Note (Optional)</label>
                  <textarea
                    rows={2}
                    value={formData.remarks}
                    onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                    placeholder="e.g. Left early for medical reason, overtime duty..."
                    className="form-control"
                    style={{ resize: 'vertical' }}
                  />
                </div>
              </div>

              <div style={{ padding: '16px 24px', background: '#f8fafc', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="btn-cancel"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="btn-save-attendance"
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

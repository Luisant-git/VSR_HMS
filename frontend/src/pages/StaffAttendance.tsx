import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users, Clock, Check, X, Search,
  RefreshCw, CheckCircle2, AlertCircle, Calendar
} from 'lucide-react';
import Swal from 'sweetalert2';
import { PageHeader } from '../components/PageHeader';
import { StaffAPI, type StaffAttendanceItem } from '../api/staff.api';
import { getRoleBadgeStyle } from './StaffMaster';

export default function StaffAttendance() {
  const navigate = useNavigate();
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

  const fetchRoster = async () => {
    try {
      setLoading(true);
      const data = await StaffAPI.getAttendanceRoster(selectedDate);
      setRoster(data || []);
    } catch (err: any) {
      console.error(err);
      Swal.fire({
        icon: 'error',
        title: 'Error Loading Attendance',
        text: err.message || 'Could not fetch attendance roster',
        confirmButtonColor: '#2563eb'
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRoster();
  }, [selectedDate]);

  const getCurrentTimeString = () => {
    return new Date().toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
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
    const existingCheckIn = item.checkInTime && item.checkInTime !== '--:--' ? item.checkInTime : getCurrentTimeString();
    const existingCheckOut = item.checkOutTime && item.checkOutTime !== '--:--' ? item.checkOutTime : '';
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
  const totalCount = roster.length;
  const presentCount = roster.filter(r => r.status === 'Present').length;
  const notMarkedCount = roster.filter(r => r.status === 'Not Marked' || !r.status).length;
  const absentCount = roster.filter(r => r.status === 'Absent' || r.status === 'On Leave').length;
  const halfDayCount = roster.filter(r => r.status === 'Half Day').length;
  const fullDayCount = roster.filter(r => r.status === 'Present' && r.checkOutTime && r.checkOutTime !== '--:--').length;

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

        .modal-card-dark-header {
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

        .modal-header-dark {
          background: #1e293b;
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
            {/* Date Picker matching Hostellers UI style */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#ffffff', padding: '8px 14px', borderRadius: '8px', border: '1px solid var(--border-color)', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
              <Calendar size={16} color="#64748b" />
              <span style={{ fontSize: '13px', fontWeight: 600, color: '#475569' }}>Date:</span>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => {
                  setSelectedDate(e.target.value);
                  setPage(1);
                }}
                style={{ border: 'none', outline: 'none', fontSize: '13.5px', fontWeight: 700, color: '#0f172a', background: 'transparent', cursor: 'pointer' }}
              />
            </div>

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
          <div style={{ width: 44, height: 44, borderRadius: 10, background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2563eb' }}>
            <Users size={22} />
          </div>
          <div>
            <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>Total Active Staff</div>
            <div style={{ fontSize: '20px', fontWeight: 800, color: '#0f172a' }}>{totalCount}</div>
          </div>
        </div>

        <div className="att-stat-card">
          <div style={{ width: 44, height: 44, borderRadius: 10, background: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#16a34a' }}>
            <CheckCircle2 size={22} />
          </div>
          <div>
            <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>Present on Duty</div>
            <div style={{ fontSize: '20px', fontWeight: 800, color: '#16a34a' }}>{presentCount}</div>
            <div style={{ fontSize: '11px', color: '#15803d', fontWeight: 600, marginTop: '1px' }}>
              Full: {fullDayCount} • Half: {halfDayCount}
            </div>
          </div>
        </div>

        <div className="att-stat-card">
          <div style={{ width: 44, height: 44, borderRadius: 10, background: '#fefce8', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ca8a04' }}>
            <Clock size={22} />
          </div>
          <div>
            <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>Not Marked Yet</div>
            <div style={{ fontSize: '20px', fontWeight: 800, color: '#ca8a04' }}>{notMarkedCount}</div>
          </div>
        </div>

        <div className="att-stat-card">
          <div style={{ width: 44, height: 44, borderRadius: 10, background: '#fef2f2', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#dc2626' }}>
            <AlertCircle size={22} />
          </div>
          <div>
            <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>Absent / On Leave</div>
            <div style={{ fontSize: '20px', fontWeight: 800, color: '#dc2626' }}>{absentCount}</div>
          </div>
        </div>
      </div>

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
                <td colSpan={6} style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>
                  Loading Attendance Roster...
                </td>
              </tr>
            ) : paginatedRoster.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: '50px 20px', color: '#64748b' }}>
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
                      <div style={{ fontWeight: 600, color: '#0f172a' }}>{item.name}</div>
                      <div style={{ fontSize: '12px', color: '#0284c7', fontWeight: 600, marginTop: '2px' }}>
                        {item.staffCode}
                      </div>
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
                            <Clock size={13} /> {item.checkOutTime}
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

      {/* QUICK UPDATE ATTENDANCE MODAL (without Shift field) */}
      {modalOpen && activeItem && (
        <div className="modal-overlay" onClick={() => setModalOpen(false)}>
          <div className="modal-card-dark-header" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header-dark">
              <div>
                <div style={{ fontSize: '15px', fontWeight: 700 }}>
                  Staff Attendance: {activeItem.name}
                </div>
                <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '2px' }}>
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
                        type="text"
                        value={formData.checkInTime}
                        onChange={(e) => setFormData({ ...formData, checkInTime: e.target.value })}
                        placeholder="09:00 AM"
                        className="form-control"
                      />
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, checkInTime: getCurrentTimeString() })}
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
                        type="text"
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
                        placeholder="06:00 PM"
                        className="form-control"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const nowStr = getCurrentTimeString();
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

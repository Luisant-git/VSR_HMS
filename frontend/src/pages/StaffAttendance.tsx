import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users, Clock, Check, X, Search,
  RefreshCw, CheckCircle2, AlertCircle, ArrowLeft
} from 'lucide-react';
import Swal from 'sweetalert2';
import { StaffAPI, type StaffAttendanceItem } from '../api/staff.api';

export default function StaffAttendance() {
  const navigate = useNavigate();
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [roster, setRoster] = useState<StaffAttendanceItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

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

  const openMarkModal = (item: StaffAttendanceItem) => {
    setActiveItem(item);
    const defaultCheckIn = item.checkInTime !== '--:--' ? item.checkInTime : getCurrentTimeString();
    const defaultCheckOut = item.checkOutTime !== '--:--' ? item.checkOutTime : '';
    const defaultStatus = item.status !== 'Not Marked' ? item.status : 'Present';

    setFormData({
      checkInTime: defaultCheckIn,
      checkOutTime: defaultCheckOut,
      status: defaultStatus,
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
        text: `Attendance for ${activeItem.name} updated successfully!`,
        confirmButtonColor: '#2563eb',
        timer: 1800,
        showConfirmButton: false
      });

      setModalOpen(false);
      fetchRoster();
    } catch (err: any) {
      Swal.fire({
        icon: 'error',
        title: 'Save Failed',
        text: err.message || 'Could not save attendance record',
        confirmButtonColor: '#ef4444'
      });
    } finally {
      setSubmitting(false);
    }
  };

  // Format date for display heading
  const formatDisplayDate = (dStr: string) => {
    try {
      const d = new Date(dStr + 'T00:00:00');
      return d.toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      });
    } catch {
      return dStr;
    }
  };

  // Filter roster
  const filteredRoster = roster.filter(item => {
    const matchesSearch =
      item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.staffCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.role.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = statusFilter === 'ALL' || item.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Quick stats
  const totalCount = roster.length;
  const presentCount = roster.filter(r => r.status === 'Present').length;
  const notMarkedCount = roster.filter(r => r.status === 'Not Marked').length;
  const absentCount = roster.filter(r => r.status === 'Absent' || r.status === 'On Leave').length;

  return (
    <div className="staff-attendance-page" style={{ padding: '24px 30px', background: '#f8fafc', minHeight: '100vh', color: '#0f172a' }}>
      <style>{`
        .att-header-banner {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 24px;
          flex-wrap: wrap;
          gap: 16px;
        }

        .att-stat-card {
          background: #ffffff;
          border-radius: 14px;
          padding: 16px 20px;
          border: 1px solid #e2e8f0;
          box-shadow: 0 1px 3px rgba(0,0,0,0.04);
          display: flex;
          align-items: center;
          gap: 14px;
          flex: 1;
          min-width: 180px;
        }

        .att-table-card {
          background: #ffffff;
          border-radius: 16px;
          border: 1px solid #e2e8f0;
          box-shadow: 0 1px 3px rgba(0,0,0,0.04);
          overflow: hidden;
        }

        .att-table {
          width: 100%;
          border-collapse: collapse;
          text-align: left;
          font-size: 13.5px;
        }

        .att-table th {
          background: #f8fafc;
          padding: 14px 20px;
          font-size: 11.5px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: #64748b;
          border-bottom: 1px solid #e2e8f0;
          white-space: nowrap;
        }

        .att-table td {
          padding: 16px 20px;
          border-bottom: 1px solid #f1f5f9;
          vertical-align: middle;
        }

        .att-table tr:hover td {
          background: #fbfcfe;
        }

        .designation-badge {
          background: #f1f5f9;
          color: #475569;
          padding: 4px 10px;
          border-radius: 6px;
          font-size: 12px;
          font-weight: 600;
          display: inline-block;
          border: 1px solid #e2e8f0;
        }

        /* Status Pills matching Image 2 */
        .att-status-pill {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 4px 10px;
          border-radius: 9999px;
          font-size: 12px;
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

        /* Log In/Out Action Button */
        .btn-log-inout {
          border: 1.5px solid #0284c7;
          background: #f0f9ff;
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
        }

        .btn-log-inout:hover {
          background: #0284c7;
          color: #ffffff;
        }

        /* Modal Styles matching Image 1 */
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
          border-radius: 9px;
          border: 1px solid #cbd5e1;
          font-size: 13.5px;
          color: #0f172a;
          outline: none;
          transition: border-color 0.15s ease, box-shadow 0.15s ease;
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
          transition: background 0.15s ease;
        }

        .btn-cancel:hover {
          background: #475569;
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
          transition: background 0.15s ease;
        }

        .btn-save-attendance:hover {
          background: #1d4ed8;
        }
      `}</style>

      {/* Top Banner Header matching Image 2 */}
      <div className="att-header-banner">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
            <button
              onClick={() => navigate('/staff')}
              style={{ background: 'none', border: 'none', color: '#0284c7', fontSize: '13px', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px', cursor: 'pointer', padding: 0 }}
            >
              <ArrowLeft size={14} /> Staff Master Directory
            </button>
            <span style={{ color: '#cbd5e1' }}>/</span>
            <span style={{ fontSize: '13px', color: '#64748b', fontWeight: 500 }}>Gate In / Out</span>
          </div>
          <h1 style={{ fontSize: '24px', fontWeight: 800, margin: '0 0 4px', color: '#0f172a', letterSpacing: '-0.3px' }}>
            Staff In / Out Daily Attendance
          </h1>
          <p style={{ margin: 0, fontSize: '13.5px', color: '#64748b' }}>
            Record duty check-in/out timestamps, and daily presence
          </p>
        </div>

        {/* Date Selector matching Image 2 top right */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#ffffff', padding: '6px 14px', borderRadius: '10px', border: '1px solid #cbd5e1', boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
            <span style={{ fontSize: '13px', fontWeight: 600, color: '#475569' }}>Date:</span>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              style={{ border: 'none', outline: 'none', fontSize: '13.5px', fontWeight: 700, color: '#0f172a', background: 'transparent', cursor: 'pointer' }}
            />
          </div>

          <button
            onClick={() => navigate('/staff')}
            style={{ background: '#ffffff', border: '1px solid #cbd5e1', color: '#334155', padding: '8px 14px', borderRadius: '9px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <Users size={15} />
            <span>Staff Master</span>
          </button>
        </div>
      </div>

      {/* Quick Stats Summary */}
      <div style={{ display: 'flex', gap: '14px', marginBottom: '22px', flexWrap: 'wrap' }}>
        <div className="att-stat-card">
          <div style={{ width: 44, height: 44, borderRadius: 12, background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2563eb' }}>
            <Users size={22} />
          </div>
          <div>
            <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>Total Active Staff</div>
            <div style={{ fontSize: '20px', fontWeight: 800, color: '#0f172a' }}>{totalCount}</div>
          </div>
        </div>

        <div className="att-stat-card">
          <div style={{ width: 44, height: 44, borderRadius: 12, background: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#16a34a' }}>
            <CheckCircle2 size={22} />
          </div>
          <div>
            <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>Present on Duty</div>
            <div style={{ fontSize: '20px', fontWeight: 800, color: '#16a34a' }}>{presentCount}</div>
          </div>
        </div>

        <div className="att-stat-card">
          <div style={{ width: 44, height: 44, borderRadius: 12, background: '#fefce8', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ca8a04' }}>
            <Clock size={22} />
          </div>
          <div>
            <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>Not Marked Yet</div>
            <div style={{ fontSize: '20px', fontWeight: 800, color: '#ca8a04' }}>{notMarkedCount}</div>
          </div>
        </div>

        <div className="att-stat-card">
          <div style={{ width: 44, height: 44, borderRadius: 12, background: '#fef2f2', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#dc2626' }}>
            <AlertCircle size={22} />
          </div>
          <div>
            <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>Absent / On Leave</div>
            <div style={{ fontSize: '20px', fontWeight: 800, color: '#dc2626' }}>{absentCount}</div>
          </div>
        </div>
      </div>

      {/* Main Roster Section matching Image 2 */}
      <div className="att-table-card">
        {/* Roster Title & Toolbar */}
        <div style={{ padding: '18px 22px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px', background: '#ffffff' }}>
          <div>
            <h2 style={{ fontSize: '17px', fontWeight: 800, margin: 0, color: '#0f172a' }}>
              Duty Attendance Roster - {formatDisplayDate(selectedDate)}
            </h2>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            {/* Search Input */}
            <div style={{ position: 'relative', width: '220px' }}>
              <Search size={15} style={{ position: 'absolute', left: 10, top: 10, color: '#94a3b8' }} />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search staff, code, role..."
                className="form-control"
                style={{ paddingLeft: '32px', fontSize: '12.5px' }}
              />
            </div>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="form-control"
              style={{ width: '130px', fontSize: '12.5px' }}
            >
              <option value="ALL">All Status</option>
              <option value="Present">Present</option>
              <option value="Not Marked">Not Marked</option>
              <option value="Absent">Absent</option>
              <option value="Half Day">Half Day</option>
              <option value="On Leave">On Leave</option>
            </select>

            <button
              onClick={fetchRoster}
              title="Refresh Roster"
              style={{ padding: '8px 10px', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#f8fafc', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
            >
              <RefreshCw size={14} color="#64748b" />
            </button>
          </div>
        </div>

        {/* Table Content matching Image 2 (without Shift column) */}
        <div style={{ overflowX: 'auto' }}>
          <table className="att-table">
            <thead>
              <tr>
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
                    Loading Duty Roster for {formatDisplayDate(selectedDate)}...
                  </td>
                </tr>
              ) : filteredRoster.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '50px 20px', color: '#64748b' }}>
                    <Users size={36} color="#cbd5e1" style={{ margin: '0 auto 10px' }} />
                    <div style={{ fontWeight: 600, color: '#334155' }}>No active staff found</div>
                  </td>
                </tr>
              ) : (
                filteredRoster.map((item) => (
                  <tr key={item.staffId}>
                    {/* STAFF MEMBER */}
                    <td>
                      <div style={{ fontWeight: 700, color: '#0f172a', fontSize: '14.5px' }}>{item.name}</div>
                      <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 600, marginTop: '2px' }}>{item.staffCode}</div>
                    </td>

                    {/* DESIGNATION */}
                    <td>
                      <span className="designation-badge">{item.role}</span>
                    </td>

                    {/* CHECK-IN TIME */}
                    <td>
                      <span style={{ fontWeight: 600, color: item.checkInTime !== '--:--' ? '#0f172a' : '#94a3b8', fontSize: '13.5px' }}>
                        {item.checkInTime}
                      </span>
                    </td>

                    {/* CHECK-OUT TIME */}
                    <td>
                      <span style={{ fontWeight: 600, color: item.checkOutTime !== '--:--' ? '#0f172a' : '#94a3b8', fontSize: '13.5px' }}>
                        {item.checkOutTime}
                      </span>
                    </td>

                    {/* ATTENDANCE STATUS */}
                    <td>
                      <span className={`att-status-pill ${
                        item.status === 'Present' ? 'att-status-present' :
                        item.status === 'Not Marked' ? 'att-status-not-marked' :
                        item.status === 'Absent' ? 'att-status-absent' :
                        item.status === 'Half Day' ? 'att-status-halfday' : 'att-status-leave'
                      }`}>
                        {item.status === 'Present' && <Check size={11} strokeWidth={3} />}
                        <span>{item.status}</span>
                      </span>
                    </td>

                    {/* UPDATE / MARK BUTTON */}
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <button
                        onClick={() => openMarkModal(item)}
                        className="btn-log-inout"
                      >
                        <Clock size={13} strokeWidth={2.4} />
                        <span>Log In/Out</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL MATCHING IMAGE 1 (Shift field completely removed) */}
      {modalOpen && activeItem && (
        <div className="modal-overlay" onClick={() => setModalOpen(false)}>
          <div className="modal-card-dark-header" onClick={(e) => e.stopPropagation()}>
            {/* Header: Dark / Navy matching Image 1 */}
            <div className="modal-header-dark">
              <div style={{ fontSize: '16px', fontWeight: 700, letterSpacing: '-0.2px' }}>
                Staff Attendance: {activeItem.name}
              </div>
              <button
                onClick={() => setModalOpen(false)}
                style={{ background: 'none', border: 'none', color: '#ffffff', cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center', opacity: 0.85 }}
              >
                <X size={19} />
              </button>
            </div>

            {/* Modal Form matching Image 1 */}
            <form onSubmit={handleSaveAttendance}>
              <div className="modal-body-pad">
                {/* Row 1: Check-In Time & Check-Out Time */}
                <div className="form-row-2">
                  <div className="form-group">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                      <label style={{ margin: 0 }}>Check-In Time</label>
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, checkInTime: getCurrentTimeString() })}
                        style={{ background: 'none', border: 'none', color: '#0284c7', fontSize: '11px', fontWeight: 700, cursor: 'pointer', padding: 0 }}
                      >
                        Set Now
                      </button>
                    </div>
                    <div style={{ position: 'relative' }}>
                      <input
                        type="text"
                        value={formData.checkInTime}
                        onChange={(e) => setFormData({ ...formData, checkInTime: e.target.value })}
                        placeholder="01:14 PM"
                        className="form-control"
                        style={{ paddingRight: '32px', fontWeight: 600 }}
                      />
                      <Clock size={15} style={{ position: 'absolute', right: 10, top: 11, color: '#94a3b8', pointerEvents: 'none' }} />
                    </div>
                  </div>

                  <div className="form-group">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                      <label style={{ margin: 0 }}>Check-Out Time</label>
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, checkOutTime: getCurrentTimeString() })}
                        style={{ background: 'none', border: 'none', color: '#0284c7', fontSize: '11px', fontWeight: 700, cursor: 'pointer', padding: 0 }}
                      >
                        Set Now
                      </button>
                    </div>
                    <div style={{ position: 'relative' }}>
                      <input
                        type="text"
                        value={formData.checkOutTime}
                        onChange={(e) => setFormData({ ...formData, checkOutTime: e.target.value })}
                        placeholder="--:-- --"
                        className="form-control"
                        style={{ paddingRight: '32px', fontWeight: 600 }}
                      />
                      <Clock size={15} style={{ position: 'absolute', right: 10, top: 11, color: '#94a3b8', pointerEvents: 'none' }} />
                    </div>
                  </div>
                </div>

                {/* (Note: SHIFT FIELD REMOVED as requested by user) */}

                {/* Row 2: Attendance Status matching Image 1 */}
                <div className="form-group">
                  <label>Attendance Status</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    className="form-control"
                    style={{ fontWeight: 600 }}
                  >
                    <option value="Present">Present</option>
                    <option value="Absent">Absent</option>
                    <option value="Half Day">Half Day</option>
                    <option value="On Leave">On Leave</option>
                    <option value="Not Marked">Not Marked</option>
                  </select>
                </div>

                {/* Row 3: Remarks matching Image 1 */}
                <div className="form-group">
                  <label>Remarks</label>
                  <input
                    type="text"
                    value={formData.remarks}
                    onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                    placeholder="Optional duty note"
                    className="form-control"
                  />
                </div>
              </div>

              {/* Modal Buttons matching Image 1 */}
              <div style={{ padding: '16px 24px', background: '#ffffff', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
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

import React, { useState, useEffect } from 'react';
import {
  Users, UserPlus, Search, Edit2, Trash2, CheckCircle2,
  X, Calendar, Phone, Mail, DollarSign,
  ShieldCheck, RefreshCw, Check, Eye
} from 'lucide-react';
import Swal from 'sweetalert2';
import { StaffAPI, type StaffMember } from '../api/staff.api';

const STANDARD_ROLES = [
  'Gate Security Guard',
  'Hostel Warden',
  'Assistant Warden',
  'Head Canteen Cook',
  'Canteen Assistant',
  'Housekeeping / Cleaning',
  'Maintenance & Electrician',
  'Plumber & Sanitary Staff',
  'Supervisor',
  'Accountant / Office Staff'
];

const SALARY_BASIS_OPTIONS = [
  'Monthly Fixed',
  'Daily Wage',
  'Hourly Rate'
];

export default function StaffMaster() {
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [salaryFilter, setSalaryFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<StaffMember | null>(null);
  const [viewingStaff, setViewingStaff] = useState<StaffMember | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    staffCode: '',
    name: '',
    joiningDate: new Date().toISOString().split('T')[0],
    role: 'Gate Security Guard',
    customRole: '',
    phone: '',
    email: '',
    salaryBasis: 'Monthly Fixed',
    baseSalary: '18000.00',
    status: 'Active',
    notes: ''
  });

  const fetchStaff = async () => {
    try {
      setLoading(true);
      const data = await StaffAPI.getAll({
        search: searchTerm || undefined,
        role: roleFilter !== 'ALL' ? roleFilter : undefined,
        salaryBasis: salaryFilter !== 'ALL' ? salaryFilter : undefined,
        status: statusFilter !== 'ALL' ? statusFilter : undefined,
      });
      setStaffList(data);
    } catch (err: any) {
      console.error(err);
      Swal.fire({
        icon: 'error',
        title: 'Error Loading Staff',
        text: err.message || err.response?.data?.message || 'Could not fetch staff directory',
        confirmButtonColor: '#2563eb'
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStaff();
  }, [searchTerm, roleFilter, salaryFilter, statusFilter]);

  const openRegisterModal = async () => {
    setEditingStaff(null);
    let nextCode = 'STF-001';
    try {
      const res = await StaffAPI.getNextCode();
      if (res?.nextCode) nextCode = res.nextCode;
    } catch (e) {
      console.error(e);
    }

    setFormData({
      staffCode: nextCode,
      name: '',
      joiningDate: new Date().toISOString().split('T')[0],
      role: 'Gate Security Guard',
      customRole: '',
      phone: '',
      email: '',
      salaryBasis: 'Monthly Fixed',
      baseSalary: '18000.00',
      status: 'Active',
      notes: ''
    });
    setModalOpen(true);
  };

  const openEditModal = (staff: StaffMember) => {
    setEditingStaff(staff);
    const isStandard = STANDARD_ROLES.includes(staff.role);
    setFormData({
      staffCode: staff.staffCode,
      name: staff.name,
      joiningDate: staff.joiningDate ? new Date(staff.joiningDate).toISOString().split('T')[0] : '',
      role: isStandard ? staff.role : 'Other',
      customRole: isStandard ? '' : staff.role,
      phone: staff.phone || '',
      email: staff.email || '',
      salaryBasis: staff.salaryBasis || 'Monthly Fixed',
      baseSalary: staff.baseSalary !== undefined ? String(staff.baseSalary) : '0.00',
      status: staff.status || 'Active',
      notes: staff.notes || ''
    });
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      Swal.fire({ icon: 'warning', title: 'Full Name Required', text: 'Please enter the staff member legal name.', confirmButtonColor: '#2563eb' });
      return;
    }

    const finalRole = formData.role === 'Other' ? formData.customRole.trim() : formData.role;
    if (!finalRole) {
      Swal.fire({ icon: 'warning', title: 'Role Required', text: 'Please select or enter a role/job title.', confirmButtonColor: '#2563eb' });
      return;
    }

    const payload = {
      staffCode: formData.staffCode.trim(),
      name: formData.name.trim(),
      joiningDate: formData.joiningDate,
      role: finalRole,
      phone: formData.phone.trim(),
      email: formData.email.trim(),
      salaryBasis: formData.salaryBasis,
      baseSalary: parseFloat(formData.baseSalary) || 0,
      status: formData.status,
      notes: formData.notes.trim()
    };

    setSubmitting(true);
    try {
      if (editingStaff) {
        await StaffAPI.update(editingStaff.id, payload);
        Swal.fire({
          icon: 'success',
          title: 'Staff Updated',
          text: `"${payload.name}" details updated successfully!`,
          confirmButtonColor: '#2563eb',
          timer: 2000
        });
      } else {
        await StaffAPI.create(payload);
        Swal.fire({
          icon: 'success',
          title: 'Staff Registered',
          text: `Staff member "${payload.name}" (${payload.staffCode}) registered successfully!`,
          confirmButtonColor: '#2563eb',
          timer: 2000
        });
      }
      setModalOpen(false);
      fetchStaff();
    } catch (err: any) {
      Swal.fire({
        icon: 'error',
        title: 'Save Failed',
        text: err.message || err.response?.data?.message || 'Failed to save staff record',
        confirmButtonColor: '#ef4444'
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (staff: StaffMember) => {
    const result = await Swal.fire({
      title: 'Delete Staff Member?',
      html: `Are you sure you want to remove <b>${staff.name}</b> (<code>${staff.staffCode}</code>)?<br/>This action cannot be undone.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'Yes, Delete Staff'
    });

    if (result.isConfirmed) {
      try {
        await StaffAPI.delete(staff.id);
        Swal.fire({
          icon: 'success',
          title: 'Deleted',
          text: 'Staff member removed successfully.',
          confirmButtonColor: '#2563eb',
          timer: 1500
        });
        fetchStaff();
      } catch (err: any) {
        Swal.fire({
          icon: 'error',
          title: 'Delete Failed',
          text: err.message || err.response?.data?.message || 'Could not delete staff member',
          confirmButtonColor: '#ef4444'
        });
      }
    }
  };

  const handleToggleStatus = async (staff: StaffMember) => {
    try {
      await StaffAPI.toggleStatus(staff.id);
      fetchStaff();
    } catch (err: any) {
      Swal.fire({
        icon: 'error',
        title: 'Status Update Failed',
        text: err.message || err.response?.data?.message || 'Could not change status',
        confirmButtonColor: '#ef4444'
      });
    }
  };

  // Calculations
  const totalStaff = staffList.length;
  const activeStaff = staffList.filter(s => s.status === 'Active').length;
  const totalMonthlyPayroll = staffList
    .filter(s => s.status === 'Active')
    .reduce((sum, s) => sum + (s.baseSalary || 0), 0);

  const formatCurrency = (val: number) => {
    return '₹' + Number(val || 0).toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  };

  const formatDate = (dStr?: string) => {
    if (!dStr) return '-';
    try {
      const d = new Date(dStr);
      if (isNaN(d.getTime())) return dStr;
      return d.toLocaleDateString('en-GB'); // DD/MM/YYYY
    } catch {
      return dStr;
    }
  };

  // Today formatted pill
  const todayFormatted = new Date().toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });

  return (
    <div className="staff-master-page" style={{ padding: '24px 30px', background: '#f8fafc', minHeight: '100vh', color: '#0f172a' }}>
      <style>{`
        .staff-header-banner {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 24px;
          flex-wrap: wrap;
          gap: 16px;
        }

        .staff-stat-card {
          background: #ffffff;
          border-radius: 14px;
          padding: 16px 20px;
          border: 1px solid #e2e8f0;
          box-shadow: 0 1px 3px rgba(0,0,0,0.04);
          display: flex;
          align-items: center;
          gap: 14px;
          flex: 1;
          min-width: 200px;
        }

        .staff-table-card {
          background: #ffffff;
          border-radius: 16px;
          border: 1px solid #e2e8f0;
          box-shadow: 0 1px 3px rgba(0,0,0,0.04);
          overflow: hidden;
        }

        .staff-table {
          width: 100%;
          border-collapse: collapse;
          text-align: left;
          font-size: 13.5px;
        }

        .staff-table th {
          background: #f8fafc;
          padding: 13px 18px;
          font-size: 11.5px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: #64748b;
          border-bottom: 1px solid #e2e8f0;
          white-space: nowrap;
        }

        .staff-table td {
          padding: 14px 18px;
          border-bottom: 1px solid #f1f5f9;
          vertical-align: middle;
        }

        .staff-table tr:hover td {
          background: #fbfcfe;
        }

        .staff-code-badge {
          color: #0284c7;
          font-weight: 700;
          font-size: 13.5px;
          letter-spacing: -0.2px;
        }

        .salary-basis-pill {
          display: inline-block;
          padding: 3px 8px;
          border-radius: 6px;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.04em;
          text-transform: uppercase;
          background: #334155;
          color: #ffffff;
        }

        .status-pill {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 4px 10px;
          border-radius: 9999px;
          font-size: 11.5px;
          font-weight: 600;
        }

        .status-active {
          background: #dcfce7;
          color: #15803d;
          border: 1px solid #bbf7d0;
        }

        .status-inactive {
          background: #fee2e2;
          color: #b91c1c;
          border: 1px solid #fecaca;
        }

        /* Modal Styles */
        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(15, 23, 42, 0.6);
          backdrop-filter: blur(4px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 9999;
          padding: 16px;
        }

        .modal-card {
          background: #ffffff;
          border-radius: 16px;
          width: 100%;
          max-width: 580px;
          box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
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
          background: #1d4ed8;
          color: #ffffff;
          padding: 16px 22px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .modal-form-body {
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

        .btn-blue-primary {
          background: #1d4ed8;
          color: #ffffff;
          border: none;
          padding: 9px 20px;
          border-radius: 9px;
          font-weight: 600;
          font-size: 13.5px;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 7px;
          transition: all 0.15s ease;
        }

        .btn-blue-primary:hover {
          background: #1e40af;
        }

        .btn-cancel {
          background: #475569;
          color: #ffffff;
          border: none;
          padding: 9px 18px;
          border-radius: 9px;
          font-weight: 600;
          font-size: 13.5px;
          cursor: pointer;
          transition: background 0.15s ease;
        }

        .btn-cancel:hover {
          background: #334155;
        }

        .btn-dark {
          background: #0f172a;
          color: #ffffff;
          border: none;
          padding: 9px 18px;
          border-radius: 9px;
          font-weight: 600;
          font-size: 13.5px;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 7px;
          transition: all 0.15s ease;
        }

        .btn-dark:hover {
          background: #1e293b;
        }

        @media (max-width: 640px) {
          .form-row-2 {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>

      {/* Top Banner Header */}
      <div className="staff-header-banner">
        <div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: '#f1f5f9', border: '1px solid #e2e8f0', padding: '4px 10px', borderRadius: '8px', fontSize: '12px', color: '#475569', fontWeight: 600, marginBottom: '8px' }}>
            <Calendar size={13} color="#64748b" />
            <span>{todayFormatted}</span>
          </div>
          <h1 style={{ fontSize: '24px', fontWeight: 800, margin: '0 0 4px', color: '#0f172a', letterSpacing: '-0.3px' }}>
            Hostel Staff Master Data
          </h1>
          <p style={{ margin: 0, fontSize: '13.5px', color: '#64748b' }}>
            Manage wardens, security guards, canteen staff, housekeeping & payroll details
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button onClick={openRegisterModal} className="btn-blue-primary">
            <UserPlus size={16} />
            <span>Register New Staff</span>
          </button>
          <button className="btn-dark">
            <CheckCircle2 size={16} />
            <span>Staff Attendance</span>
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div style={{ display: 'flex', gap: '14px', marginBottom: '22px', flexWrap: 'wrap' }}>
        <div className="staff-stat-card">
          <div style={{ width: 44, height: 44, borderRadius: 12, background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2563eb' }}>
            <Users size={22} />
          </div>
          <div>
            <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>Total Staff Members</div>
            <div style={{ fontSize: '20px', fontWeight: 800, color: '#0f172a' }}>{totalStaff}</div>
          </div>
        </div>

        <div className="staff-stat-card">
          <div style={{ width: 44, height: 44, borderRadius: 12, background: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#16a34a' }}>
            <ShieldCheck size={22} />
          </div>
          <div>
            <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>Active On Duty</div>
            <div style={{ fontSize: '20px', fontWeight: 800, color: '#16a34a' }}>{activeStaff}</div>
          </div>
        </div>

        <div className="staff-stat-card">
          <div style={{ width: 44, height: 44, borderRadius: 12, background: '#faf5ff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9333ea' }}>
            <DollarSign size={22} />
          </div>
          <div>
            <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>Total Monthly Payroll</div>
            <div style={{ fontSize: '20px', fontWeight: 800, color: '#0f172a' }}>{formatCurrency(totalMonthlyPayroll)}</div>
          </div>
        </div>
      </div>

      {/* Directory Table Card */}
      <div className="staff-table-card">
        {/* Table Filters Toolbar */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', background: '#ffffff' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ fontSize: '15px', fontWeight: 700, color: '#0f172a' }}>
              Staff Directory <span style={{ color: '#64748b', fontWeight: 500, fontSize: '13px' }}>({staffList.length} Staff Members)</span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            {/* Search Box */}
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

            {/* Role Filter */}
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="form-control"
              style={{ width: '160px', fontSize: '12.5px' }}
            >
              <option value="ALL">All Roles</option>
              {STANDARD_ROLES.map(r => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>

            {/* Salary Basis Filter */}
            <select
              value={salaryFilter}
              onChange={(e) => setSalaryFilter(e.target.value)}
              className="form-control"
              style={{ width: '140px', fontSize: '12.5px' }}
            >
              <option value="ALL">All Basis</option>
              {SALARY_BASIS_OPTIONS.map(b => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="form-control"
              style={{ width: '110px', fontSize: '12.5px' }}
            >
              <option value="ALL">All Status</option>
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </select>

            <button
              onClick={fetchStaff}
              title="Refresh Directory"
              style={{ padding: '8px 10px', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#f8fafc', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
            >
              <RefreshCw size={14} color="#64748b" />
            </button>
          </div>
        </div>

        {/* Table Content */}
        <div style={{ overflowX: 'auto' }}>
          <table className="staff-table">
            <thead>
              <tr>
                <th>STAFF CODE</th>
                <th>FULL NAME</th>
                <th>ROLE / JOB TITLE</th>
                <th>MOBILE PHONE</th>
                <th>JOINING DATE</th>
                <th>SALARY BASIS</th>
                <th>BASE WAGE</th>
                <th>STATUS</th>
                <th style={{ textAlign: 'right' }}>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={9} style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>
                    Loading Staff Directory...
                  </td>
                </tr>
              ) : staffList.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ textAlign: 'center', padding: '50px 20px', color: '#64748b' }}>
                    <Users size={36} color="#cbd5e1" style={{ margin: '0 auto 10px' }} />
                    <div style={{ fontWeight: 600, color: '#334155' }}>No staff members found</div>
                    <div style={{ fontSize: '12px', marginTop: '4px' }}>Click "+ Register New Staff" to add staff members.</div>
                  </td>
                </tr>
              ) : (
                staffList.map((staff) => (
                  <tr key={staff.id}>
                    <td>
                      <span className="staff-code-badge">{staff.staffCode}</span>
                    </td>
                    <td>
                      <div style={{ fontWeight: 700, color: '#0f172a' }}>{staff.name}</div>
                      {staff.email && (
                        <div style={{ fontSize: '11.5px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '3px', marginTop: '2px' }}>
                          <Mail size={11} /> {staff.email}
                        </div>
                      )}
                    </td>
                    <td>
                      <span style={{ fontWeight: 600, color: '#334155' }}>{staff.role}</span>
                    </td>
                    <td>
                      {staff.phone ? (
                        <span style={{ color: '#475569', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Phone size={12} color="#94a3b8" />
                          {staff.phone}
                        </span>
                      ) : (
                        <span style={{ color: '#94a3b8' }}>-</span>
                      )}
                    </td>
                    <td>
                      <span style={{ color: '#475569' }}>{formatDate(staff.joiningDate)}</span>
                    </td>
                    <td>
                      <span className="salary-basis-pill">
                        {staff.salaryBasis ? staff.salaryBasis.toUpperCase().replace(' FIXED', '') : 'MONTHLY'}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontWeight: 700, color: '#0f172a', fontSize: '14px' }}>
                        {formatCurrency(staff.baseSalary)}
                      </span>
                    </td>
                    <td>
                      <button
                        onClick={() => handleToggleStatus(staff)}
                        title="Click to toggle status"
                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                      >
                        <span className={`status-pill ${staff.status === 'Active' ? 'status-active' : 'status-inactive'}`}>
                          {staff.status === 'Active' ? <Check size={11} strokeWidth={3} /> : <X size={11} strokeWidth={3} />}
                          <span>{staff.status || 'Active'}</span>
                        </span>
                      </button>
                    </td>
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <button
                        onClick={() => setViewingStaff(staff)}
                        title="View Staff Details"
                        style={{ padding: '6px 8px', borderRadius: '6px', border: '1px solid #e0e7ff', background: '#eef2ff', color: '#4f46e5', cursor: 'pointer', marginRight: '6px' }}
                      >
                        <Eye size={14} />
                      </button>
                      <button
                        onClick={() => openEditModal(staff)}
                        title="Edit Staff Member"
                        style={{ padding: '6px 8px', borderRadius: '6px', border: '1px solid #e2e8f0', background: '#f8fafc', color: '#0284c7', cursor: 'pointer', marginRight: '6px' }}
                      >
                        <Edit2 size={14} />
                      </button>
                      <button
                        onClick={() => handleDelete(staff)}
                        title="Delete Staff Member"
                        style={{ padding: '6px 8px', borderRadius: '6px', border: '1px solid #fee2e2', background: '#fff5f5', color: '#ef4444', cursor: 'pointer' }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* REGISTER / EDIT STAFF MODAL */}
      {modalOpen && (
        <div className="modal-overlay" onClick={() => setModalOpen(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            {/* Modal Blue Header matching screenshot */}
            <div className="modal-header-blue">
              <div style={{ fontSize: '16px', fontWeight: 700, letterSpacing: '-0.2px' }}>
                {editingStaff ? 'Edit Staff Member' : 'Register New Staff Member'}
              </div>
              <button
                onClick={() => setModalOpen(false)}
                style={{ background: 'none', border: 'none', color: '#ffffff', cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center', opacity: 0.85 }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSave}>
              <div className="modal-form-body">
                {/* Row 1: Staff Code & Joining Date */}
                <div className="form-row-2">
                  <div className="form-group">
                    <label>Staff Code</label>
                    <input
                      type="text"
                      required
                      value={formData.staffCode}
                      onChange={(e) => setFormData({ ...formData, staffCode: e.target.value })}
                      placeholder="e.g. STF-005"
                      className="form-control"
                      style={{ fontWeight: 600, color: '#1e3a8a' }}
                    />
                  </div>
                  <div className="form-group">
                    <label>Joining Date</label>
                    <input
                      type="date"
                      required
                      value={formData.joiningDate}
                      onChange={(e) => setFormData({ ...formData, joiningDate: e.target.value })}
                      className="form-control"
                    />
                  </div>
                </div>

                {/* Row 2: Full Name */}
                <div className="form-group">
                  <label>Full Name</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Staff member's legal name"
                    className="form-control"
                  />
                </div>

                {/* Row 3: Role / Job Title */}
                <div className="form-group">
                  <label>Role / Job Title</label>
                  <select
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                    className="form-control"
                  >
                    {STANDARD_ROLES.map((r) => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                    <option value="Other">Other / Custom Role...</option>
                  </select>
                  {formData.role === 'Other' && (
                    <input
                      type="text"
                      required
                      value={formData.customRole}
                      onChange={(e) => setFormData({ ...formData, customRole: e.target.value })}
                      placeholder="Type custom role title..."
                      className="form-control"
                      style={{ marginTop: '8px' }}
                    />
                  )}
                </div>

                {/* Row 4: Mobile Phone & Email */}
                <div className="form-row-2">
                  <div className="form-group">
                    <label>Mobile Phone</label>
                    <input
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      placeholder="10-digit mobile number"
                      className="form-control"
                    />
                  </div>
                  <div className="form-group">
                    <label>Email (Optional)</label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      placeholder="name@hostel.com"
                      className="form-control"
                    />
                  </div>
                </div>

                {/* Row 5: Salary Basis & Base Salary */}
                <div className="form-row-2">
                  <div className="form-group">
                    <label>Salary Basis</label>
                    <select
                      value={formData.salaryBasis}
                      onChange={(e) => setFormData({ ...formData, salaryBasis: e.target.value })}
                      className="form-control"
                    >
                      {SALARY_BASIS_OPTIONS.map((b) => (
                        <option key={b} value={b}>{b}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Base Salary (₹)</label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={formData.baseSalary}
                      onChange={(e) => setFormData({ ...formData, baseSalary: e.target.value })}
                      placeholder="18000.00"
                      className="form-control"
                      style={{ fontWeight: 600 }}
                    />
                  </div>
                </div>
              </div>

              {/* Modal Buttons matching screenshot */}
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
                  className="btn-blue-primary"
                >
                  {submitting ? 'Saving...' : 'Save Staff Member'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* VIEW STAFF DETAILS MODAL */}
      {viewingStaff && (
        <div className="modal-overlay" onClick={() => setViewingStaff(null)}>
          <div className="modal-card" style={{ maxWidth: '540px' }} onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div style={{ background: '#0f172a', color: '#ffffff', padding: '16px 22px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Users size={18} color="#38bdf8" />
                <span style={{ fontSize: '16px', fontWeight: 700 }}>Staff Member Details</span>
              </div>
              <button
                onClick={() => setViewingStaff(null)}
                style={{ background: 'none', border: 'none', color: '#ffffff', cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center', opacity: 0.8 }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Profile Summary Card */}
            <div style={{ padding: '22px 24px', background: '#ffffff' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', paddingBottom: '18px', borderBottom: '1px solid #f1f5f9' }}>
                <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#e0f2fe', color: '#0284c7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', fontWeight: 800 }}>
                  {viewingStaff.name.charAt(0).toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: '#0f172a' }}>{viewingStaff.name}</h3>
                    <span className={`status-pill ${viewingStaff.status === 'Active' ? 'status-active' : 'status-inactive'}`}>
                      {viewingStaff.status === 'Active' ? <Check size={11} strokeWidth={3} /> : <X size={11} strokeWidth={3} />}
                      <span>{viewingStaff.status}</span>
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px', flexWrap: 'wrap' }}>
                    <span style={{ background: '#f1f5f9', color: '#475569', padding: '2px 8px', borderRadius: '6px', fontSize: '12px', fontWeight: 600 }}>
                      {viewingStaff.role}
                    </span>
                    <span style={{ color: '#0284c7', fontWeight: 700, fontSize: '12.5px' }}>
                      {viewingStaff.staffCode}
                    </span>
                  </div>
                </div>
              </div>

              {/* Detail Items Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', paddingTop: '18px' }}>
                <div>
                  <div style={{ fontSize: '11.5px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Staff Code</div>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: '#0284c7', marginTop: '3px' }}>{viewingStaff.staffCode}</div>
                </div>

                <div>
                  <div style={{ fontSize: '11.5px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Joining Date</div>
                  <div style={{ fontSize: '14px', fontWeight: 600, color: '#0f172a', marginTop: '3px' }}>{formatDate(viewingStaff.joiningDate)}</div>
                </div>

                <div>
                  <div style={{ fontSize: '11.5px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Mobile Phone</div>
                  <div style={{ fontSize: '14px', fontWeight: 600, color: '#0f172a', marginTop: '3px' }}>
                    {viewingStaff.phone || <span style={{ color: '#94a3b8' }}>Not Provided</span>}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: '11.5px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Email Address</div>
                  <div style={{ fontSize: '14px', fontWeight: 600, color: '#0f172a', marginTop: '3px', wordBreak: 'break-all' }}>
                    {viewingStaff.email || <span style={{ color: '#94a3b8' }}>Not Provided</span>}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: '11.5px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Salary Basis</div>
                  <div style={{ marginTop: '4px' }}>
                    <span className="salary-basis-pill">
                      {viewingStaff.salaryBasis ? viewingStaff.salaryBasis.toUpperCase().replace(' FIXED', '') : 'MONTHLY'}
                    </span>
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: '11.5px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Base Wage / Salary</div>
                  <div style={{ fontSize: '16px', fontWeight: 800, color: '#0f172a', marginTop: '3px' }}>
                    {formatCurrency(viewingStaff.baseSalary)}
                  </div>
                </div>
              </div>

              {viewingStaff.notes && (
                <div style={{ marginTop: '16px', padding: '12px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: '11.5px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Notes</div>
                  <div style={{ fontSize: '13px', color: '#334155', marginTop: '4px' }}>{viewingStaff.notes}</div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div style={{ padding: '14px 24px', background: '#f8fafc', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setViewingStaff(null)}
                className="btn-cancel"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => {
                  const s = viewingStaff;
                  setViewingStaff(null);
                  openEditModal(s);
                }}
                className="btn-blue-primary"
              >
                <Edit2 size={14} />
                <span>Edit Staff</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

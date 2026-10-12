import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import Select from 'react-select';
import {
  Users, UserPlus, Search, Edit2, Trash2,
  X, Phone, DollarSign,
  ShieldCheck, RefreshCw, Check, Eye, Clock
} from 'lucide-react';
import Swal from 'sweetalert2';
import { PageHeader } from '../components/PageHeader';
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

const roleFilterOptions = [
  { value: 'ALL', label: '-- All Roles --' },
  ...STANDARD_ROLES.map(r => ({ value: r, label: r }))
];

const modalRoleOptions = [
  ...STANDARD_ROLES.map(r => ({ value: r, label: r })),
  { value: 'Other', label: 'Other / Custom Role...' }
];

export const getRoleBadgeStyle = (role: string) => {
  const r = (role || '').toLowerCase();
  if (r.includes('warden')) {
    return { bg: '#f3e8ff', color: '#6b21a8', border: '#e9d5ff' };
  }
  if (r.includes('security') || r.includes('guard')) {
    return { bg: '#e0f2fe', color: '#0369a1', border: '#bae6fd' };
  }
  if (r.includes('cook') || r.includes('canteen')) {
    return { bg: '#ffedd5', color: '#c2410c', border: '#fed7aa' };
  }
  if (r.includes('clean') || r.includes('housekeep')) {
    return { bg: '#ecfdf5', color: '#047857', border: '#a7f3d0' };
  }
  if (r.includes('electric') || r.includes('plumb') || r.includes('maint')) {
    return { bg: '#fef3c7', color: '#b45309', border: '#fde68a' };
  }
  return { bg: '#f1f5f9', color: '#334155', border: '#cbd5e1' };
};

const filterRoleSelectStyles = {
  control: (base: any, state: any) => ({
    ...base,
    minHeight: '38px',
    height: '38px',
    borderRadius: '8px',
    borderColor: state.isFocused ? 'var(--sidebar-active)' : 'var(--border-color)',
    boxShadow: state.isFocused ? '0 0 0 1px var(--sidebar-active)' : 'none',
    '&:hover': { borderColor: state.isFocused ? 'var(--sidebar-active)' : '#cbd5e1' },
    fontSize: '13px',
    cursor: 'pointer',
    width: '210px',
    background: '#f8fafc'
  }),
  valueContainer: (base: any) => ({
    ...base,
    padding: '0 8px'
  }),
  input: (base: any) => ({
    ...base,
    margin: 0,
    padding: 0
  }),
  option: (base: any, state: any) => ({
    ...base,
    fontSize: '13px',
    backgroundColor: state.isSelected ? 'var(--sidebar-active)' : state.isFocused ? '#f1f5f9' : 'white',
    color: state.isSelected ? 'white' : '#334155',
    cursor: 'pointer'
  }),
  menuPortal: (base: any) => ({ ...base, zIndex: 9999 })
};

const modalRoleSelectStyles = {
  control: (base: any, state: any) => ({
    ...base,
    minHeight: '40px',
    borderRadius: '8px',
    borderColor: state.isFocused ? '#2563eb' : 'var(--border-color)',
    boxShadow: state.isFocused ? '0 0 0 3px rgba(37, 99, 235, 0.12)' : 'none',
    '&:hover': { borderColor: state.isFocused ? '#2563eb' : '#cbd5e1' },
    fontSize: '13px',
    cursor: 'pointer',
    background: '#ffffff'
  }),
  valueContainer: (base: any) => ({
    ...base,
    padding: '0 10px'
  }),
  option: (base: any, state: any) => ({
    ...base,
    fontSize: '13px',
    backgroundColor: state.isSelected ? '#2563eb' : state.isFocused ? '#f1f5f9' : 'white',
    color: state.isSelected ? 'white' : '#0f172a',
    cursor: 'pointer'
  }),
  menuPortal: (base: any) => ({ ...base, zIndex: 99999 })
};

export default function StaffMaster() {
  const navigate = useNavigate();
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [salaryFilter, setSalaryFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Pagination matching Hostellers.tsx
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);

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
      const data = await StaffAPI.getAll();
      setStaffList(data || []);
    } catch (err: any) {
      console.error('Failed to load staff directory:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStaff();
  }, []);

  // Filter & Pagination Calculations
  const filteredStaff = useMemo(() => {
    return staffList.filter(s => {
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const matchName = s.name.toLowerCase().includes(term);
        const matchCode = s.staffCode.toLowerCase().includes(term);
        const matchRole = s.role.toLowerCase().includes(term);
        const matchPhone = s.phone?.toLowerCase().includes(term);
        const matchEmail = s.email?.toLowerCase().includes(term);
        if (!matchName && !matchCode && !matchRole && !matchPhone && !matchEmail) return false;
      }
      if (roleFilter !== 'ALL' && s.role !== roleFilter) return false;
      if (salaryFilter !== 'ALL' && s.salaryBasis !== salaryFilter) return false;
      if (statusFilter !== 'ALL' && s.status !== statusFilter) return false;
      return true;
    });
  }, [staffList, searchTerm, roleFilter, salaryFilter, statusFilter]);

  const totalRecords = filteredStaff.length;
  const totalPages = Math.ceil(totalRecords / limit) || 1;

  const paginatedStaff = useMemo(() => {
    if (limit >= 99999) return filteredStaff;
    const start = (page - 1) * limit;
    return filteredStaff.slice(start, start + limit);
  }, [filteredStaff, page, limit]);

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
      joiningDate: staff.joiningDate ? staff.joiningDate.split('T')[0] : new Date().toISOString().split('T')[0],
      role: isStandard ? staff.role : 'Other',
      customRole: isStandard ? '' : staff.role,
      phone: staff.phone || '',
      email: staff.email || '',
      salaryBasis: staff.salaryBasis || 'Monthly Fixed',
      baseSalary: String(staff.baseSalary || 0),
      status: staff.status || 'Active',
      notes: staff.notes || ''
    });
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      Swal.fire({ icon: 'warning', title: 'Name Required', text: 'Please enter staff member name.' });
      return;
    }

    const finalRole = formData.role === 'Other' ? (formData.customRole.trim() || 'Staff') : formData.role;
    const payload = {
      staffCode: formData.staffCode.trim(),
      name: formData.name.trim(),
      joiningDate: formData.joiningDate,
      role: finalRole,
      phone: formData.phone.trim() || undefined,
      email: formData.email.trim() || undefined,
      salaryBasis: formData.salaryBasis,
      baseSalary: parseFloat(formData.baseSalary) || 0,
      status: formData.status,
      notes: formData.notes.trim() || undefined
    };

    setSubmitting(true);
    try {
      if (editingStaff) {
        await StaffAPI.update(editingStaff.id, payload);
        Swal.fire({
          icon: 'success',
          title: 'Staff Updated',
          text: `"${payload.name}" updated successfully.`,
          confirmButtonColor: '#2563eb',
          timer: 1500
        });
      } else {
        await StaffAPI.create(payload);
        Swal.fire({
          icon: 'success',
          title: 'Staff Registered',
          text: `"${payload.name}" registered successfully with code ${payload.staffCode}.`,
          confirmButtonColor: '#2563eb',
          timer: 1800
        });
      }
      setModalOpen(false);
      fetchStaff();
    } catch (err: any) {
      console.error(err);
      Swal.fire({
        icon: 'error',
        title: 'Save Failed',
        text: err.message || err.response?.data?.message || 'Could not save staff member',
        confirmButtonColor: '#ef4444'
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (staff: StaffMember) => {
    const result = await Swal.fire({
      title: 'Delete Staff Member?',
      text: `Are you sure you want to delete "${staff.name}" (${staff.staffCode})? This action cannot be undone.`,
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
      return d.toLocaleDateString('en-GB');
    } catch {
      return dStr;
    }
  };

  return (
    <div className="page-container" style={{ padding: '24px 30px', background: '#f8fafc', minHeight: '100vh', color: '#0f172a' }}>
      <style>{`
        .staff-stat-card {
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

        .btn-blue-primary {
          background: var(--sidebar-active);
          color: #ffffff;
          border: none;
          padding: 10px 20px;
          border-radius: 8px;
          font-weight: 600;
          font-size: 14px;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 7px;
          transition: all 0.15s ease;
        }

        .btn-cancel {
          background: #475569;
          color: #ffffff;
          border: none;
          padding: 9px 18px;
          border-radius: 8px;
          font-weight: 600;
          font-size: 13.5px;
          cursor: pointer;
        }

        @media (max-width: 640px) {
          .form-row-2 {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>

      {/* PageHeader matching Hostellers.tsx */}
      <PageHeader
        title="Hostel Staff Master"
        subtitle="Manage wardens, security guards, canteen staff, housekeeping & payroll details"
        showBack={false}
        rightContent={
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button
              onClick={() => navigate('/staff/attendance')}
              style={{
                background: '#0f172a',
                color: 'white',
                border: 'none',
                padding: '12px 20px',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: 600,
                cursor: 'pointer',
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <Clock size={16} />
              Staff Gate In / Out
            </button>
            <button
              onClick={openRegisterModal}
              style={{
                background: 'var(--sidebar-active)',
                color: 'white',
                border: 'none',
                padding: '12px 24px',
                borderRadius: '8px',
                fontSize: '15px',
                fontWeight: 600,
                cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(74, 114, 250, 0.25)',
                transition: 'all 0.2s',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <UserPlus size={18} />
              + Register New Staff
            </button>
          </div>
        }
      />

      {/* Stats Summary Cards */}
      <div style={{ display: 'flex', gap: '15px', marginBottom: '20px', flexWrap: 'wrap' }}>
        <div className="staff-stat-card">
          <div style={{ width: 44, height: 44, borderRadius: 10, background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2563eb' }}>
            <Users size={22} />
          </div>
          <div>
            <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>Total Staff Members</div>
            <div style={{ fontSize: '20px', fontWeight: 800, color: '#0f172a' }}>{totalStaff}</div>
          </div>
        </div>

        <div className="staff-stat-card">
          <div style={{ width: 44, height: 44, borderRadius: 10, background: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#16a34a' }}>
            <ShieldCheck size={22} />
          </div>
          <div>
            <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>Active On Duty</div>
            <div style={{ fontSize: '20px', fontWeight: 800, color: '#16a34a' }}>{activeStaff}</div>
          </div>
        </div>

        <div className="staff-stat-card">
          <div style={{ width: 44, height: 44, borderRadius: 10, background: '#faf5ff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9333ea' }}>
            <DollarSign size={22} />
          </div>
          <div>
            <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>Total Monthly Payroll</div>
            <div style={{ fontSize: '20px', fontWeight: 800, color: '#0f172a' }}>{formatCurrency(totalMonthlyPayroll)}</div>
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
            placeholder="Search by name, ID, code, role, phone..."
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

        {/* Searchable Role Filter using react-select */}
        <div style={{ width: '210px' }}>
          <Select
            options={roleFilterOptions}
            value={roleFilterOptions.find(o => o.value === roleFilter) || roleFilterOptions[0]}
            onChange={(opt) => {
              setRoleFilter(opt?.value || 'ALL');
              setPage(1);
            }}
            styles={filterRoleSelectStyles}
            placeholder="Search role..."
            isSearchable={true}
          />
        </div>

        {/* Salary Basis Filter */}
        <select
          value={salaryFilter}
          onChange={(e) => { setSalaryFilter(e.target.value); setPage(1); }}
          style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '13px', outline: 'none', cursor: 'pointer', background: '#f8fafc' }}
        >
          <option value="ALL">-- All Salary Basis --</option>
          {SALARY_BASIS_OPTIONS.map(b => (
            <option key={b} value={b}>{b}</option>
          ))}
        </select>

        {/* Status Filter */}
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '13px', outline: 'none', cursor: 'pointer', background: '#f8fafc' }}
        >
          <option value="ALL">-- All Status --</option>
          <option value="Active">Active</option>
          <option value="Inactive">Inactive</option>
        </select>

        {/* Clear All Filters button */}
        {(searchTerm !== '' || roleFilter !== 'ALL' || salaryFilter !== 'ALL' || statusFilter !== 'ALL') && (
          <button
            onClick={() => {
              setSearchTerm('');
              setRoleFilter('ALL');
              setSalaryFilter('ALL');
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
          onClick={fetchStaff}
          title="Refresh Directory"
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

      {/* Directory Table Card matching Hostellers.tsx */}
      <div style={{ overflowX: 'auto', background: 'white', borderRadius: '12px', padding: '0', border: '1px solid var(--border-color)', boxShadow: '0 2px 10px rgba(0,0,0,0.02)' }}>
        <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'white', borderBottom: '1px solid #eaedf1', textAlign: 'left' }}>
              <th>STAFF ID / CODE</th>
              <th>FULL NAME & CONTACT</th>
              <th>ROLE / JOB TITLE</th>
              <th>SALARY BASIS</th>
              <th>BASE SALARY</th>
              <th>DUTY STATUS</th>
              <th>JOINING DATE</th>
              <th style={{ textAlign: 'right' }}>ACTIONS</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>
                  Loading Staff Directory...
                </td>
              </tr>
            ) : paginatedStaff.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ textAlign: 'center', padding: '50px 20px', color: '#64748b' }}>
                  <Users size={36} color="#cbd5e1" style={{ margin: '0 auto 10px' }} />
                  <div style={{ fontWeight: 600, color: '#334155' }}>No staff members found</div>
                  <div style={{ fontSize: '12px', marginTop: '4px' }}>Click "+ Register New Staff" to add staff members.</div>
                </td>
              </tr>
            ) : (
              paginatedStaff.map((staff) => {
                const roleBadge = getRoleBadgeStyle(staff.role);
                return (
                  <tr key={staff.id}>
                    <td>
                      <span className="staff-code-badge">{staff.staffCode}</span>
                    </td>
                    <td>
                      <div style={{ fontWeight: 600, color: '#0f172a' }}>{staff.name}</div>
                      {staff.phone && (
                        <div style={{ fontSize: '12px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                          <Phone size={11} /> {staff.phone}
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
                        {staff.role}
                      </span>
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
                    <td>
                      <span style={{ color: '#64748b', fontSize: '13px' }}>{formatDate(staff.joiningDate)}</span>
                    </td>
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'inline-flex', gap: '6px', alignItems: 'center' }}>
                        <button
                          onClick={() => setViewingStaff(staff)}
                          title="View Staff Profile"
                          style={{ padding: '6px 9px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#f8fafc', color: '#0f172a', cursor: 'pointer' }}
                        >
                          <Eye size={15} color="#0284c7" />
                        </button>
                        <button
                          onClick={() => openEditModal(staff)}
                          title="Edit Staff Member"
                          style={{ padding: '6px 9px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#f8fafc', color: '#0f172a', cursor: 'pointer' }}
                        >
                          <Edit2 size={15} color="#475569" />
                        </button>
                        <button
                          onClick={() => handleDelete(staff)}
                          title="Delete Staff Member"
                          style={{ padding: '6px 9px', borderRadius: '6px', border: '1px solid #fecaca', background: '#fff5f5', color: '#ef4444', cursor: 'pointer' }}
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
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

      {/* REGISTER / EDIT STAFF MODAL */}
      {modalOpen && (
        <div className="modal-overlay" onClick={() => setModalOpen(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
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

            <form onSubmit={handleSave}>
              <div className="modal-form-body">
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

                {/* Searchable Role Dropdown in Modal using react-select */}
                <div className="form-group">
                  <label>Role / Job Title</label>
                  <Select
                    options={modalRoleOptions}
                    value={modalRoleOptions.find(o => o.value === formData.role) || { value: formData.role, label: formData.role }}
                    onChange={(opt) => {
                      setFormData(prev => ({ ...prev, role: opt?.value || 'Gate Security Guard' }));
                    }}
                    styles={modalRoleSelectStyles}
                    placeholder="Search or select role..."
                    isSearchable={true}
                    menuPortalTarget={typeof document !== 'undefined' ? document.body : undefined}
                    menuPosition="fixed"
                  />
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
                    <span style={{
                      background: getRoleBadgeStyle(viewingStaff.role).bg,
                      color: getRoleBadgeStyle(viewingStaff.role).color,
                      border: `1px solid ${getRoleBadgeStyle(viewingStaff.role).border}`,
                      padding: '3px 10px',
                      borderRadius: '6px',
                      fontSize: '12px',
                      fontWeight: 700
                    }}>
                      {viewingStaff.role}
                    </span>
                    <span style={{ color: '#0284c7', fontWeight: 700, fontSize: '12.5px' }}>
                      {viewingStaff.staffCode}
                    </span>
                  </div>
                </div>
              </div>

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

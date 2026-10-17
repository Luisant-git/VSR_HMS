import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import Select from 'react-select';
import {
  Users, UserPlus, Search, SquarePen, Trash2,
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
    borderColor: state.isFocused ? 'var(--accent)' : 'var(--border)',
    boxShadow: state.isFocused ? '0 0 0 1px var(--accent)' : 'none',
    '&:hover': { borderColor: state.isFocused ? 'var(--accent)' : 'var(--border-strong)' },
    fontSize: '13px',
    cursor: 'pointer',
    width: '210px',
    background: 'var(--surface-muted)'
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
    backgroundColor: state.isSelected ? 'var(--accent)' : state.isFocused ? 'var(--surface-sunken)' : 'white',
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
    borderColor: state.isFocused ? 'var(--accent)' : 'var(--border)',
    boxShadow: state.isFocused ? '0 0 0 3px var(--accent-soft)' : 'none',
    '&:hover': { borderColor: state.isFocused ? 'var(--accent)' : 'var(--border-strong)' },
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
    backgroundColor: state.isSelected ? 'var(--accent)' : state.isFocused ? 'var(--surface-sunken)' : 'white',
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
    <div className="ui-page">
      {/* PageHeader matching Hostellers.tsx */}
      <PageHeader
        title="Hostel Staff Master"
        subtitle="Manage wardens, security guards, canteen staff, housekeeping & payroll details"
        showBack={true}
        icon={<Users size={24} color="#fff" />} iconBg="linear-gradient(135deg, #14b8a6 0%, #0d9488 100%)"
        rightContent={
          <div className="sm-header-actions">
            <button
              onClick={() => navigate('/staff/attendance')}
              className="ui-btn ui-btn-dark"
            >
              <Clock size={16} />
              Staff Gate In / Out
            </button>
            <button
              onClick={openRegisterModal}
              className="ui-btn ui-btn-primary"
            >
              <UserPlus size={18} />
              + Register New Staff
            </button>
          </div>
        }
      />

      {/* Stats Summary Cards */}
      <div className="ui-stat-grid">
        <div className="ui-stat">
          <div className="ui-stat-icon is-info">
            <Users size={22} />
          </div>
          <div>
            <div className="ui-stat-label">Total Staff Members</div>
            <div className="ui-stat-value">{totalStaff}</div>
          </div>
        </div>

        <div className="ui-stat">
          <div className="ui-stat-icon is-success">
            <ShieldCheck size={22} />
          </div>
          <div>
            <div className="ui-stat-label">Active On Duty</div>
            <div className="ui-stat-value is-success">{activeStaff}</div>
          </div>
        </div>

        <div className="ui-stat">
          <div className="ui-stat-icon is-purple">
            <DollarSign size={22} />
          </div>
          <div>
            <div className="ui-stat-label">Total Monthly Payroll</div>
            <div className="ui-stat-value">{formatCurrency(totalMonthlyPayroll)}</div>
          </div>
        </div>
      </div>

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

        {/* Search input with icon */}
        <div className="ui-search">
          <Search size={16} />
          <input
            type="text"
            placeholder="Search by name, ID, code, role, phone..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setPage(1);
            }}
            className="ui-input sm-search-input"
          />
        </div>

        {/* Searchable Role Filter using react-select */}
        <div className="sm-role-filter">
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
          className="ui-select"
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
          className="ui-select"
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
            className="ui-btn ui-btn-secondary"
          >
            <X size={14} strokeWidth={3} /> Clear All
          </button>
        )}

        <div className="ui-toolbar-spacer"></div>

        {/* Refresh button */}
        <button
          onClick={fetchStaff}
          title="Refresh Directory"
          className="ui-btn ui-btn-secondary"
        >
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {/* Directory Table Card matching Hostellers.tsx */}
      <div className="ui-table-wrap">
        <table className="ui-table">
          <thead>
            <tr>
              <th>STAFF ID / CODE</th>
              <th>FULL NAME & CONTACT</th>
              <th>ROLE / JOB TITLE</th>
              <th>SALARY BASIS</th>
              <th>BASE SALARY</th>
              <th>DUTY STATUS</th>
              <th>JOINING DATE</th>
              <th className="is-right">ACTIONS</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} className="ui-table-state">
                  Loading Staff Directory...
                </td>
              </tr>
            ) : paginatedStaff.length === 0 ? (
              <tr>
                <td colSpan={8}>
                  <div className="ui-empty">
                    <Users size={36} />
                    <div className="ui-empty-title">No staff members found</div>
                    <div className="ui-empty-text">Click "+ Register New Staff" to add staff members.</div>
                  </div>
                </td>
              </tr>
            ) : (
              paginatedStaff.map((staff) => {
                const roleBadge = getRoleBadgeStyle(staff.role);
                return (
                  <tr key={staff.id}>
                    <td>
                      <span className="ui-code">{staff.staffCode}</span>
                    </td>
                    <td>
                      <div className="ui-cell-title">{staff.name}</div>
                      {staff.phone && (
                        <div className="ui-cell-sub">
                          <Phone size={11} /> {staff.phone}
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
                        {staff.role}
                      </span>
                    </td>
                    <td>
                      <span className="ui-pill">
                        {staff.salaryBasis ? staff.salaryBasis.toUpperCase().replace(' FIXED', '') : 'MONTHLY'}
                      </span>
                    </td>
                    <td>
                      <span className="sm-salary">
                        {formatCurrency(staff.baseSalary)}
                      </span>
                    </td>
                    <td>
                      <button
                        onClick={() => handleToggleStatus(staff)}
                        title="Click to toggle status"
                        className="ui-status-toggle"
                      >
                        <span className={`ui-badge ${staff.status === 'Active' ? 'ui-badge-success' : 'ui-badge-danger'}`}>
                          {staff.status === 'Active' ? <Check size={11} strokeWidth={3} /> : <X size={11} strokeWidth={3} />}
                          <span>{staff.status || 'Active'}</span>
                        </span>
                      </button>
                    </td>
                    <td>
                      <span className="sm-muted">{formatDate(staff.joiningDate)}</span>
                    </td>
                    <td className="is-right">
                      <div className="sm-actions">
                        <button
                          onClick={() => setViewingStaff(staff)}
                          title="View Staff Profile"
                          className="ui-btn ui-btn-icon is-info"
                        >
                          <Eye size={15} />
                        </button>
                        <button
                          onClick={() => openEditModal(staff)}
                          title="Edit Staff Member"
                          className="ui-btn ui-btn-icon is-primary"
                        >
                          <SquarePen size={15} />
                        </button>
                        <button
                          onClick={() => handleDelete(staff)}
                          title="Delete Staff Member"
                          className="ui-btn ui-btn-icon ui-btn-danger"
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

      {/* REGISTER / EDIT STAFF MODAL */}
      {modalOpen && (
        <div className="ui-modal-overlay" onClick={() => setModalOpen(false)}>
          <div className="ui-modal" onClick={(e) => e.stopPropagation()}>
            <div className="ui-modal-header is-accent">
              <div className="ui-modal-title">
                {editingStaff ? 'Edit Staff Member' : 'Register New Staff Member'}
              </div>
              <button
                onClick={() => setModalOpen(false)}
                className="ui-modal-close"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSave}>
              <div className="ui-modal-body">
                <div className="ui-form-row">
                  <div className="ui-form-group">
                    <label className="ui-form-label">Staff Code</label>
                    <input
                      type="text"
                      required
                      value={formData.staffCode}
                      onChange={(e) => setFormData({ ...formData, staffCode: e.target.value })}
                      placeholder="e.g. STF-005"
                      className="ui-form-control is-code"
                    />
                  </div>
                  <div className="ui-form-group">
                    <label className="ui-form-label">Joining Date</label>
                    <input
                      type="date"
                      required
                      value={formData.joiningDate}
                      onChange={(e) => setFormData({ ...formData, joiningDate: e.target.value })}
                      className="ui-form-control"
                    />
                  </div>
                </div>

                <div className="ui-form-group">
                  <label className="ui-form-label">Full Name</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Staff member's legal name"
                    className="ui-form-control"
                  />
                </div>

                {/* Searchable Role Dropdown in Modal using react-select */}
                <div className="ui-form-group">
                  <label className="ui-form-label">Role / Job Title</label>
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
                      className="ui-form-control ui-mt-sm"
                    />
                  )}
                </div>

                <div className="ui-form-row">
                  <div className="ui-form-group">
                    <label className="ui-form-label">Mobile Phone</label>
                    <input
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      placeholder="10-digit mobile number"
                      className="ui-form-control"
                    />
                  </div>
                  <div className="ui-form-group">
                    <label className="ui-form-label">Email (Optional)</label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      placeholder="name@hostel.com"
                      className="ui-form-control"
                    />
                  </div>
                </div>

                <div className="ui-form-row">
                  <div className="ui-form-group">
                    <label className="ui-form-label">Salary Basis</label>
                    <select
                      value={formData.salaryBasis}
                      onChange={(e) => setFormData({ ...formData, salaryBasis: e.target.value })}
                      className="ui-form-control"
                    >
                      {SALARY_BASIS_OPTIONS.map((b) => (
                        <option key={b} value={b}>{b}</option>
                      ))}
                    </select>
                  </div>
                  <div className="ui-form-group">
                    <label className="ui-form-label">Base Salary (₹)</label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={formData.baseSalary}
                      onChange={(e) => setFormData({ ...formData, baseSalary: e.target.value })}
                      placeholder="18000.00"
                      className="ui-form-control is-strong"
                    />
                  </div>
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
                  {submitting ? 'Saving...' : 'Save Staff Member'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* VIEW STAFF DETAILS MODAL */}
      {viewingStaff && (
        <div className="ui-modal-overlay" onClick={() => setViewingStaff(null)}>
          <div className="ui-modal is-md" onClick={(e) => e.stopPropagation()}>
            <div className="ui-modal-header is-accent">
              <div className="sm-view-head">
                <Users size={18} />
                <span className="ui-modal-title">Staff Member Details</span>
              </div>
              <button
                onClick={() => setViewingStaff(null)}
                className="ui-modal-close"
              >
                <X size={20} />
              </button>
            </div>

            <div className="ui-modal-body">
              <div className="ui-profile">
                <div className="sm-profile-info">
                  <div className="sm-profile-name-row">
                    <h3 className="sm-profile-name">{viewingStaff.name}</h3>
                    <span className={`ui-badge ${viewingStaff.status === 'Active' ? 'ui-badge-success' : 'ui-badge-danger'}`}>
                      {viewingStaff.status === 'Active' ? <Check size={11} strokeWidth={3} /> : <X size={11} strokeWidth={3} />}
                      <span>{viewingStaff.status}</span>
                    </span>
                  </div>
                  <div className="sm-profile-meta">
                    <span
                      className="ui-badge"
                      style={{
                        background: getRoleBadgeStyle(viewingStaff.role).bg,
                        color: getRoleBadgeStyle(viewingStaff.role).color,
                        borderColor: getRoleBadgeStyle(viewingStaff.role).border
                      }}
                    >
                      {viewingStaff.role}
                    </span>
                  </div>
                </div>
              </div>

              <div className="ui-detail-grid">
                <div>
                  <div className="ui-detail-label">Staff Code</div>
                  <div className="ui-detail-value is-accent">{viewingStaff.staffCode}</div>
                </div>

                <div>
                  <div className="ui-detail-label">Joining Date</div>
                  <div className="ui-detail-value">{formatDate(viewingStaff.joiningDate)}</div>
                </div>

                <div>
                  <div className="ui-detail-label">Mobile Phone</div>
                  <div className="ui-detail-value">
                    {viewingStaff.phone || <span className="sm-placeholder">Not Provided</span>}
                  </div>
                </div>

                <div>
                  <div className="ui-detail-label">Email Address</div>
                  <div className="ui-detail-value sm-break">
                    {viewingStaff.email || <span className="sm-placeholder">Not Provided</span>}
                  </div>
                </div>

                <div>
                  <div className="ui-detail-label">Salary Basis</div>
                  <div className="ui-mt-sm">
                    <span className="ui-pill">
                      {viewingStaff.salaryBasis ? viewingStaff.salaryBasis.toUpperCase().replace(' FIXED', '') : 'MONTHLY'}
                    </span>
                  </div>
                </div>

                <div>
                  <div className="ui-detail-label">Base Wage / Salary</div>
                  <div className="ui-detail-value is-lg">
                    {formatCurrency(viewingStaff.baseSalary)}
                  </div>
                </div>
              </div>

              {viewingStaff.notes && (
                <div className="ui-note">
                  <div className="ui-detail-label">Notes</div>
                  <div className="sm-note-text">{viewingStaff.notes}</div>
                </div>
              )}
            </div>

            <div className="ui-modal-footer">
              <button
                type="button"
                onClick={() => setViewingStaff(null)}
                className="ui-btn ui-btn-secondary"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

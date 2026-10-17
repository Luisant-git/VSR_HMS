import React, { useState, useEffect, useMemo } from 'react';
import Select from 'react-select';
import {
  Banknote, Users, CheckCircle2, Search,
  RefreshCw, X, Plus, Trash2, Eye
} from 'lucide-react';
import Swal from 'sweetalert2';
import { PageHeader } from '../components/PageHeader';
import {
  StaffSalaryAPI,
  type StaffSalaryItem,
  type SalaryListResponse
} from '../api/staff-salary.api';
import { StaffAPI, type StaffMember } from '../api/staff.api';
import { getRoleBadgeStyle } from './StaffMaster';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export default function StaffSalaryRegister() {
  // ---------------------------------------------------------
  // State
  // ---------------------------------------------------------
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [salaries, setSalaries] = useState<StaffSalaryItem[]>([]);
  const [summary, setSummary] = useState({
    totalDisbursed: 0,
    totalRecords: 0,
    staffCount: 0
  });
  const [loading, setLoading] = useState<boolean>(true);
  const [totalRecords, setTotalRecords] = useState<number>(0);
  const [page, setPage] = useState<number>(1);
  const [limit] = useState<number>(10);

  // Filters
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [filterMonth, setFilterMonth] = useState<string>('ALL');
  const [filterYear, setFilterYear] = useState<string>('ALL');
  const [filterStaffId, setFilterStaffId] = useState<string>('ALL');

  // Modal State
  const [modalOpen, setModalOpen] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);

  // View Modal State
  const [viewModalOpen, setViewModalOpen] = useState<boolean>(false);
  const [viewRecord, setViewRecord] = useState<StaffSalaryItem | null>(null);

  const openViewModal = (record: StaffSalaryItem) => {
    setViewRecord(record);
    setViewModalOpen(true);
  };

  // Modal Form Fields
  const now = new Date();
  const currentMonthName = MONTH_NAMES[now.getMonth()];
  const currentYear = now.getFullYear();
  const todayStr = now.toISOString().split('T')[0];

  const [selectedStaffId, setSelectedStaffId] = useState<string>('');
  const [modalMonth, setModalMonth] = useState<string>(currentMonthName);
  const [modalYear, setModalYear] = useState<number>(currentYear);
  const [baseSalary, setBaseSalary] = useState<string>('');
  const [bonus, setBonus] = useState<string>('0.00');
  const [deductions, setDeductions] = useState<string>('0.00');
  const [paymentDate, setPaymentDate] = useState<string>(todayStr);
  const [paymentMode, setPaymentMode] = useState<string>('Direct Bank Transfer');
  const [remarks, setRemarks] = useState<string>('');

  // ---------------------------------------------------------
  // Searchable Select Options & Styles
  // ---------------------------------------------------------
  const searchableSelectStyles = {
    control: (base: any, state: any) => ({
      ...base,
      minHeight: '38px',
      borderRadius: '8px',
      borderColor: state.isFocused ? 'var(--accent)' : 'var(--border-strong)',
      boxShadow: state.isFocused ? '0 0 0 3px var(--accent-soft)' : 'none',
      '&:hover': { borderColor: 'var(--accent)' },
      fontSize: '13.5px',
      background: 'white'
    }),
    option: (base: any, state: any) => ({
      ...base,
      fontSize: '13px',
      padding: '8px 12px',
      backgroundColor: state.isSelected
        ? 'var(--accent)'
        : state.isFocused
          ? 'var(--surface-muted)'
          : 'white',
      color: state.isSelected ? 'white' : '#0f172a',
      cursor: 'pointer'
    }),
    menuPortal: (base: any) => ({ ...base, zIndex: 99999 })
  };

  const staffSelectOptions = useMemo(() => {
    return staffList.map(s => ({
      value: s.id,
      label: `${s.name} (${s.staffCode} - ${s.role})`
    }));
  }, [staffList]);

  const staffFilterOptions = useMemo(() => {
    return [
      { value: 'ALL', label: 'All Staff Members' },
      ...staffList.map(s => ({
        value: s.id,
        label: `${s.name} (${s.staffCode})`
      }))
    ];
  }, [staffList]);

  const monthSelectOptions = useMemo(() => {
    return MONTH_NAMES.map(m => ({ value: m, label: m }));
  }, []);

  const monthFilterOptions = useMemo(() => {
    return [
      { value: 'ALL', label: 'All Months' },
      ...MONTH_NAMES.map(m => ({ value: m, label: m }))
    ];
  }, []);

  const yearFilterOptions = useMemo(() => {
    return [
      { value: 'ALL', label: 'All Years' },
      { value: '2026', label: '2026' },
      { value: '2025', label: '2025' },
      { value: '2024', label: '2024' }
    ];
  }, []);

  const paymentModeOptions = useMemo(() => {
    return [
      { value: 'Direct Bank Transfer', label: 'Direct Bank Transfer' },
      { value: 'Cash', label: 'Cash' },
      { value: 'UPI', label: 'UPI' },
      { value: 'Cheque', label: 'Cheque' }
    ];
  }, []);

  // Attendance stats for selected staff and month in modal
  const [attendanceStats, setAttendanceStats] = useState<{
    presentDays: number;
    halfDays: number;
    absentDays: number;
    leaveDays: number;
    payableDays: number;
    totalDays: number;
    recordedDays: number;
  } | null>(null);
  const [loadingAttendance, setLoadingAttendance] = useState<boolean>(false);

  // Auto-fetch attendance whenever staff or month/year changes in modal
  useEffect(() => {
    if (!modalOpen || !selectedStaffId || !modalMonth || !modalYear) {
      setAttendanceStats(null);
      return;
    }

    let active = true;
    setLoadingAttendance(true);
    StaffSalaryAPI.getAttendanceStats(selectedStaffId, modalMonth, modalYear)
      .then((stats) => {
        if (active) setAttendanceStats(stats);
      })
      .catch(() => {
        if (active) setAttendanceStats(null);
      })
      .finally(() => {
        if (active) setLoadingAttendance(false);
      });

    return () => { active = false; };
  }, [modalOpen, selectedStaffId, modalMonth, modalYear]);

  // ---------------------------------------------------------
  // Data Loading
  // ---------------------------------------------------------
  const fetchStaffList = async () => {
    try {
      const data = await StaffAPI.getAll();
      setStaffList(data || []);
    } catch (err: any) {
      console.error('Failed to load staff list', err);
    }
  };

  const fetchSalaries = async () => {
    setLoading(true);
    try {
      const res: SalaryListResponse = await StaffSalaryAPI.getAll({
        search: searchTerm,
        month: filterMonth,
        year: filterYear,
        staffId: filterStaffId,
        page,
        limit
      });
      setSalaries(res.records || []);
      setTotalRecords(res.total || 0);
      setSummary(res.summary || { totalDisbursed: 0, totalRecords: 0, staffCount: 0 });
    } catch (err: any) {
      console.error('Failed to load salary register:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStaffList();
  }, []);

  useEffect(() => {
    fetchSalaries();
  }, [searchTerm, filterMonth, filterYear, filterStaffId, page, limit]);

  // When staff is selected in modal, auto-fill base salary
  const handleStaffChange = (staffId: string) => {
    setSelectedStaffId(staffId);
    const found = staffList.find(s => s.id === staffId);
    if (found) {
      setBaseSalary(Number(found.baseSalary || 0).toFixed(2));
    } else {
      setBaseSalary('');
    }
  };

  // Open modal reset
  const openDisburseModal = () => {
    if (staffList.length > 0 && !selectedStaffId) {
      setSelectedStaffId(staffList[0].id);
      setBaseSalary(Number(staffList[0].baseSalary || 0).toFixed(2));
    }
    setModalMonth(currentMonthName);
    setModalYear(currentYear);
    setBonus('0.00');
    setDeductions('0.00');
    setPaymentDate(todayStr);
    setPaymentMode('Direct Bank Transfer');
    setRemarks('');
    setModalOpen(true);
  };

  // Calculate live net amount
  const calculatedNetAmount = useMemo(() => {
    const base = parseFloat(baseSalary) || 0;
    const bon = parseFloat(bonus) || 0;
    const ded = parseFloat(deductions) || 0;
    return Math.max(0, base + bon - ded);
  }, [baseSalary, bonus, deductions]);

  // Submit modal form
  const handleRecordDisbursement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStaffId) {
      Swal.fire({ icon: 'warning', title: 'Select Staff', text: 'Please select a staff member.', confirmButtonColor: '#15803d' });
      return;
    }

    const baseNum = parseFloat(baseSalary);
    if (isNaN(baseNum) || baseNum < 0) {
      Swal.fire({ icon: 'warning', title: 'Invalid Base Salary', text: 'Please enter a valid base salary amount.', confirmButtonColor: '#15803d' });
      return;
    }

    setSubmitting(true);
    try {
      await StaffSalaryAPI.create({
        staffId: selectedStaffId,
        month: modalMonth,
        year: Number(modalYear),
        baseSalary: baseNum,
        bonus: parseFloat(bonus) || 0,
        deductions: parseFloat(deductions) || 0,
        paymentDate,
        paymentMode,
        remarks: remarks.trim() || undefined
      });

      Swal.fire({
        icon: 'success',
        title: 'Salary Disbursed',
        text: `Salary disbursement recorded successfully.`,
        confirmButtonColor: '#15803d',
        timer: 1800
      });

      setModalOpen(false);
      fetchSalaries();
    } catch (err: any) {
      Swal.fire({
        icon: 'error',
        title: 'Disbursement Failed',
        text: err.message || 'Could not record salary disbursement.',
        confirmButtonColor: '#dc2626'
      });
    } finally {
      setSubmitting(false);
    }
  };

  // Delete salary record
  const handleDeleteRecord = async (record: StaffSalaryItem) => {
    const result = await Swal.fire({
      title: 'Delete Salary Record?',
      text: `Are you sure you want to delete ${record.salaryCode} for ${record.staff?.name}?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#dc2626',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'Yes, Delete'
    });

    if (result.isConfirmed) {
      try {
        await StaffSalaryAPI.delete(record.id);
        Swal.fire({
          icon: 'success',
          title: 'Deleted',
          text: 'Salary record removed successfully.',
          confirmButtonColor: '#15803d',
          timer: 1500
        });
        fetchSalaries();
      } catch (err: any) {
        Swal.fire({
          icon: 'error',
          title: 'Delete Failed',
          text: err.message || 'Could not delete record.',
          confirmButtonColor: '#dc2626'
        });
      }
    }
  };

  const formatCurrency = (val: number) => {
    return `₹${Number(val || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatDateDisplay = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  const totalPages = Math.ceil(totalRecords / limit) || 1;

  return (
    <div className="ui-page">
      {/* Page Header */}
      <PageHeader
        title="Salary Management"
        subtitle="Manage staff salaries, wages, overtime bonus, and track monthly disbursements."
        showBack={true}
        icon={<Banknote size={24} color="#fff" />} iconBg="linear-gradient(135deg, #10b981 0%, #059669 100%)"
        rightContent={
          <button
            id="btn-open-salary-modal"
            onClick={openDisburseModal}
            className="ui-btn ui-btn-primary"
          >
            <Plus size={16} />
            <span>Disburse Staff Salary</span>
          </button>
        }
      />

      {/* Top Summary Cards */}
      <div className="ui-stat-grid">
        <div className="ui-stat">
          <div className="ui-stat-icon is-success">
            <Banknote size={22} />
          </div>
          <div>
            <div className="ui-stat-label">Total Disbursed</div>
            <div className="ui-stat-value is-success">{formatCurrency(summary.totalDisbursed)}</div>
            <div className="ui-stat-sub">Cumulative salary payout</div>
          </div>
        </div>

        <div className="ui-stat">
          <div className="ui-stat-icon is-info">
            <Users size={22} />
          </div>
          <div>
            <div className="ui-stat-label">Total Staff Paid</div>
            <div className="ui-stat-value">{summary.staffCount}</div>
            <div className="ui-stat-sub">Staff members with payouts</div>
          </div>
        </div>

        <div className="ui-stat">
          <div className="ui-stat-icon is-neutral">
            <CheckCircle2 size={22} />
          </div>
          <div>
            <div className="ui-stat-label">Total Transactions</div>
            <div className="ui-stat-value">{summary.totalRecords}</div>
            <div className="ui-stat-sub">Disbursement records</div>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="ui-toolbar">
        {/* Search */}
        <div className="ui-search sal-search">
          <Search size={16} />
          <input
            type="text"
            placeholder="Search by staff name, code, or salary ID..."
            value={searchTerm}
            onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }}
            className="ui-input"
          />
        </div>

        {/* Month Filter (Searchable) */}
        <div className="sal-filter-month">
          <Select
            options={monthFilterOptions}
            value={monthFilterOptions.find(o => o.value === filterMonth) || null}
            onChange={(opt) => { setFilterMonth(opt ? opt.value : 'ALL'); setPage(1); }}
            placeholder="Filter Month..."
            styles={searchableSelectStyles}
            menuPortalTarget={typeof document !== 'undefined' ? document.body : null}
            menuPosition="fixed"
          />
        </div>

        {/* Year Filter (Searchable) */}
        <div className="sal-filter-year">
          <Select
            options={yearFilterOptions}
            value={yearFilterOptions.find(o => o.value === filterYear) || null}
            onChange={(opt) => { setFilterYear(opt ? opt.value : 'ALL'); setPage(1); }}
            placeholder="Filter Year..."
            styles={searchableSelectStyles}
            menuPortalTarget={typeof document !== 'undefined' ? document.body : null}
            menuPosition="fixed"
          />
        </div>

        {/* Staff Filter (Searchable) */}
        <div className="sal-filter-staff">
          <Select
            options={staffFilterOptions}
            value={staffFilterOptions.find(o => o.value === filterStaffId) || null}
            onChange={(opt) => { setFilterStaffId(opt ? opt.value : 'ALL'); setPage(1); }}
            placeholder="Filter Staff..."
            styles={searchableSelectStyles}
            menuPortalTarget={typeof document !== 'undefined' ? document.body : null}
            menuPosition="fixed"
          />
        </div>

        {/* Clear Filters */}
        {(searchTerm || filterMonth !== 'ALL' || filterYear !== 'ALL' || filterStaffId !== 'ALL') && (
          <button
            onClick={() => {
              setSearchTerm('');
              setFilterMonth('ALL');
              setFilterYear('ALL');
              setFilterStaffId('ALL');
              setPage(1);
            }}
            className="ui-btn ui-btn-secondary"
          >
            <X size={14} /> Clear
          </button>
        )}

        <div className="ui-toolbar-spacer"></div>

        {/* Refresh */}
        <button
          onClick={fetchSalaries}
          title="Refresh"
          className="ui-btn ui-btn-secondary"
        >
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {/* Salary Disbursement History Table */}
      <div className="ui-table-wrap">
        <table className="ui-table">
          <thead>
            <tr>
              <th>RECORD ID</th>
              <th>STAFF CODE</th>
              <th>STAFF MEMBER</th>
              <th>ROLE</th>
              <th>SALARY MONTH</th>
              <th>BASE SALARY</th>
              <th>BONUS / OT</th>
              <th>DEDUCTIONS</th>
              <th>NET AMOUNT DISBURSED</th>
              <th>PAYMENT DATE</th>
              <th>PAYMENT MODE</th>
              <th className="is-right">ACTIONS</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={12} className="ui-table-state">
                  Loading Salary Disbursements...
                </td>
              </tr>
            ) : salaries.length === 0 ? (
              <tr>
                <td colSpan={12}>
                  <div className="ui-empty">
                    <Banknote size={36} />
                    <div className="ui-empty-title">No salary disbursements found</div>
                    <div className="ui-empty-text">Click "+ Disburse Staff Salary" above to record a new payment.</div>
                  </div>
                </td>
              </tr>
            ) : (
              salaries.map((item) => {
                const roleBadge = getRoleBadgeStyle(item.staff?.role || 'Staff');

                return (
                  <tr key={item.id}>
                    <td>
                      <span className="ui-code-box">{item.salaryCode}</span>
                    </td>
                    <td>
                      <span className="sal-muted is-strong">{item.staff?.staffCode || '--'}</span>
                    </td>
                    <td>
                      <div className="ui-cell-title">{item.staff?.name || 'Staff Member'}</div>
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
                        {item.staff?.role || 'Staff'}
                      </span>
                    </td>
                    <td>
                      <div className="ui-cell-title">{item.month} {item.year}</div>
                    </td>
                    <td>
                      <div className="sal-muted is-strong">{formatCurrency(item.baseSalary)}</div>
                    </td>
                    <td>
                      <div className={item.bonus > 0 ? 'sal-plus' : 'sal-zero'}>
                        {formatCurrency(item.bonus)}
                      </div>
                    </td>
                    <td>
                      <div className={item.deductions > 0 ? 'sal-minus' : 'sal-zero'}>
                        {formatCurrency(item.deductions)}
                      </div>
                    </td>
                    <td>
                      <div className="sal-net">
                        {formatCurrency(item.netAmount)}
                      </div>
                    </td>
                    <td>
                      <div className="sal-date">{formatDateDisplay(item.paymentDate)}</div>
                    </td>
                    <td>
                      <div className="sal-mode">{item.paymentMode}</div>
                    </td>
                    <td className="is-right">
                      <div className="sal-actions">
                        <button
                          onClick={() => openViewModal(item)}
                          className="ui-btn ui-btn-icon is-info"
                          title="View Details"
                        >
                          <Eye size={14} />
                        </button>
                        <button
                          onClick={() => handleDeleteRecord(item)}
                          className="ui-btn ui-btn-icon ui-btn-danger"
                          title="Delete Record"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>

        {/* Pagination */}
        {totalRecords > 0 && (
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
                disabled={page >= totalPages}
                className="ui-page-btn"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ========================================================= */}
      {/* EXACT MODAL FROM SCREENSHOT: "Disburse Staff Salary"     */}
      {/* ========================================================= */}
      {modalOpen && (
        <div className="ui-modal-overlay" onClick={() => setModalOpen(false)}>
          <div className="ui-modal" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="ui-modal-header is-accent">
              <span className="ui-modal-title">Disburse Staff Salary</span>
              <button
                onClick={() => setModalOpen(false)}
                className="ui-modal-close"
              >
                <X size={20} />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleRecordDisbursement}>
              <div className="ui-modal-body">
                {/* Staff Member (Searchable Dropdown) */}
                <div className="ui-form-group">
                  <label className="ui-form-label">Staff Member</label>
                  <Select
                    options={staffSelectOptions}
                    value={staffSelectOptions.find(o => o.value === selectedStaffId) || null}
                    onChange={(opt) => handleStaffChange(opt ? opt.value : '')}
                    placeholder="Search staff by name, code or role..."
                    styles={searchableSelectStyles}
                    menuPortalTarget={typeof document !== 'undefined' ? document.body : null}
                    menuPosition="fixed"
                    isClearable={false}
                  />
                </div>

                {/* Salary Month & Salary Year */}
                <div className="ui-form-row">
                  <div className="ui-form-group">
                    <label className="ui-form-label">Salary Month</label>
                    <Select
                      options={monthSelectOptions}
                      value={monthSelectOptions.find(o => o.value === modalMonth) || null}
                      onChange={(opt) => setModalMonth(opt ? opt.value : currentMonthName)}
                      styles={searchableSelectStyles}
                      menuPortalTarget={typeof document !== 'undefined' ? document.body : null}
                      menuPosition="fixed"
                      isClearable={false}
                    />
                  </div>

                  <div className="ui-form-group">
                    <label className="ui-form-label">Salary Year</label>
                    <input
                      type="number"
                      value={modalYear}
                      onChange={(e) => setModalYear(parseInt(e.target.value, 10) || currentYear)}
                      className="ui-form-control"
                      required
                    />
                  </div>
                </div>

                {/* Live Attendance Summary for Selected Month */}
                {loadingAttendance ? (
                  <div className="ui-note sal-center">
                    ⏳ Fetching attendance for {modalMonth} {modalYear}...
                  </div>
                ) : attendanceStats ? (
                  <div className="sal-att-summary">
                    <div className="sal-att-head">
                      📋 Attendance Summary — {modalMonth} {modalYear}
                      <span>({attendanceStats.recordedDays} of {attendanceStats.totalDays} days recorded)</span>
                    </div>
                    <div className="sal-att-grid">
                      <div className="sal-att-tile is-success">
                        <div className="sal-att-value">{attendanceStats.presentDays}</div>
                        <div className="sal-att-label">Present</div>
                      </div>
                      <div className="sal-att-tile is-warning">
                        <div className="sal-att-value">{attendanceStats.halfDays}</div>
                        <div className="sal-att-label">Half Day</div>
                      </div>
                      <div className="sal-att-tile is-danger">
                        <div className="sal-att-value">{attendanceStats.absentDays}</div>
                        <div className="sal-att-label">Absent</div>
                      </div>
                      <div className="sal-att-tile is-info">
                        <div className="sal-att-value">{attendanceStats.leaveDays}</div>
                        <div className="sal-att-label">On Leave</div>
                      </div>
                    </div>
                    <div className="sal-att-payable">
                      Payable Days: <span className="sal-att-payable-value">{attendanceStats.payableDays}</span> / {attendanceStats.totalDays}
                    </div>
                  </div>
                ) : null}


                {/* Base Salary (₹) */}
                <div className="ui-form-group">
                  <label className="ui-form-label">Base Salary (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={baseSalary}
                    onChange={(e) => setBaseSalary(e.target.value)}
                    className="ui-form-control"
                    placeholder="0.00"
                    required
                  />
                </div>

                {/* Bonus / Overtime (₹) & Deductions (₹) */}
                <div className="ui-form-row">
                  <div className="ui-form-group">
                    <label className="ui-form-label">Bonus / Overtime (₹)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={bonus}
                      onChange={(e) => setBonus(e.target.value)}
                      className="ui-form-control"
                      placeholder="0.00"
                    />
                  </div>

                  <div className="ui-form-group">
                    <label className="ui-form-label">Deductions (₹)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={deductions}
                      onChange={(e) => setDeductions(e.target.value)}
                      className="ui-form-control"
                      placeholder="0.00"
                    />
                  </div>
                </div>

                {/* Payment Date & Payment Mode */}
                <div className="ui-form-row">
                  <div className="ui-form-group">
                    <label className="ui-form-label">Payment Date</label>
                    <input
                      type="date"
                      value={paymentDate}
                      onChange={(e) => setPaymentDate(e.target.value)}
                      className="ui-form-control"
                      required
                    />
                  </div>

                  <div className="ui-form-group">
                    <label className="ui-form-label">Payment Mode</label>
                    <Select
                      options={paymentModeOptions}
                      value={paymentModeOptions.find(o => o.value === paymentMode) || null}
                      onChange={(opt) => setPaymentMode(opt ? opt.value : 'Direct Bank Transfer')}
                      styles={searchableSelectStyles}
                      menuPortalTarget={typeof document !== 'undefined' ? document.body : null}
                      menuPosition="fixed"
                      isClearable={false}
                    />
                  </div>
                </div>

                {/* Net Amount Disbursed Live Display */}
                <div className="sal-net-box">
                  <div>
                    <div className="sal-net-label">
                      Net Amount to Disburse:
                    </div>
                    <div className="sal-net-breakdown">
                      {formatCurrency(parseFloat(baseSalary) || 0)} (Base) + {formatCurrency(parseFloat(bonus) || 0)} (Bonus) - {formatCurrency(parseFloat(deductions) || 0)} (Deductions)
                    </div>
                  </div>
                  <strong className="sal-net-amount">
                    {formatCurrency(calculatedNetAmount)}
                  </strong>
                </div>
              </div>

              {/* Modal Footer Buttons matching screenshot */}
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
                  {submitting ? 'Recording...' : 'Record Disbursement'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* VIEW SALARY RECORD MODAL - CLEAN, NEAT INVOICE/RECEIPT UI (NO NESTED CARDS) */}
      {viewModalOpen && viewRecord && (
        <div className="ui-modal-overlay" onClick={() => setViewModalOpen(false)}>
          <div className="ui-modal is-md" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="ui-modal-header is-accent">
              <div>
                <span className="ui-modal-title">Salary Disbursement Details</span>
                <div className="ui-modal-subtitle">
                  Record ID: {viewRecord.salaryCode}
                </div>
              </div>
              <button
                onClick={() => setViewModalOpen(false)}
                className="ui-modal-close"
              >
                <X size={20} />
              </button>
            </div>

            {/* Neat Body without nested card boxes */}
            <div className="ui-modal-body">
              {/* Staff Member Info Bar */}
              <div className="sal-view-info">
                <div>
                  <h3 className="sal-view-name">
                    {viewRecord.staff?.name}
                  </h3>
                  <div className="sal-view-sub">
                    Staff Code: <strong className="sal-meta-value">{viewRecord.staff?.staffCode}</strong>
                  </div>
                </div>
                <div className="sal-view-right">
                  <span
                    className="ui-badge"
                    style={{
                      background: getRoleBadgeStyle(viewRecord.staff?.role || 'Staff').bg,
                      color: getRoleBadgeStyle(viewRecord.staff?.role || 'Staff').color,
                      borderColor: getRoleBadgeStyle(viewRecord.staff?.role || 'Staff').border
                    }}
                  >
                    {viewRecord.staff?.role || 'Staff'}
                  </span>
                  <div className="sal-view-period">
                    {viewRecord.month} {viewRecord.year}
                  </div>
                </div>
              </div>

              {/* Neat Line-Item Breakdown (clean list, no card divs!) */}
              <div className="sal-breakdown">
                <div className="sal-line">
                  <span>Base Monthly Salary</span>
                  <span className="sal-line-val">{formatCurrency(viewRecord.baseSalary)}</span>
                </div>

                <div className="sal-line">
                  <span>Bonus / Overtime</span>
                  <span className={viewRecord.bonus > 0 ? 'sal-plus' : 'sal-zero'}>
                    + {formatCurrency(viewRecord.bonus)}
                  </span>
                </div>

                <div className="sal-line">
                  <span>Deductions</span>
                  <span className={viewRecord.deductions > 0 ? 'sal-minus' : 'sal-zero'}>
                    - {formatCurrency(viewRecord.deductions)}
                  </span>
                </div>
              </div>

              {/* Total Disbursed Highlight */}
              <div className="sal-net-box">
                <div>
                  <span className="sal-net-label">Net Amount Disbursed</span>
                  <div className="sal-net-breakdown">Total payout for this period</div>
                </div>
                <span className="sal-net-amount">
                  {formatCurrency(viewRecord.netAmount)}
                </span>
              </div>

              {/* Payment Details (Clean 2-column key-value) */}
              <div className="sal-meta">
                <div>
                  <span className="sal-meta-label">Payment Date</span>
                  <strong className="sal-meta-value">{formatDateDisplay(viewRecord.paymentDate)}</strong>
                </div>
                <div>
                  <span className="sal-meta-label">Payment Mode</span>
                  <strong className="sal-meta-value">{viewRecord.paymentMode}</strong>
                </div>
                {viewRecord.remarks && (
                  <div className="sal-span-2">
                    <span className="sal-meta-label">Remarks</span>
                    <span className="sal-meta-value">{viewRecord.remarks}</span>
                  </div>
                )}
              </div>

              {/* Footer Meta */}
              <div className="sal-footer-meta">
                <span>Created by: {viewRecord.createdBy || 'System Administrator'}</span>
                <span>Recorded on: {new Date(viewRecord.createdAt).toLocaleDateString('en-GB')}</span>
              </div>
            </div>

            {/* Footer */}
            <div className="ui-modal-footer">
              <button
                type="button"
                onClick={() => setViewModalOpen(false)}
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

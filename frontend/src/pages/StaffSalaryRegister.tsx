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
      borderColor: state.isFocused ? '#15803d' : '#cbd5e1',
      boxShadow: state.isFocused ? '0 0 0 3px rgba(21, 128, 61, 0.12)' : 'none',
      '&:hover': { borderColor: '#15803d' },
      fontSize: '13.5px',
      background: 'white'
    }),
    option: (base: any, state: any) => ({
      ...base,
      fontSize: '13px',
      padding: '8px 12px',
      backgroundColor: state.isSelected
        ? '#15803d'
        : state.isFocused
          ? '#f0fdf4'
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
      return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  const totalPages = Math.ceil(totalRecords / limit) || 1;

  return (
    <div className="page-container" style={{ padding: '24px 32px', background: 'var(--bg-main, #f8fafc)', minHeight: '100vh' }}>
      {/* CSS Styles */}
      <style>{`
        .salary-stat-card {
          background: white;
          border-radius: 12px;
          padding: 18px 22px;
          display: flex;
          align-items: center;
          gap: 16px;
          flex: 1;
          min-width: 220px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.04);
          border: 1px solid var(--border-color, #eaedf1);
        }

        .data-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 13.5px;
        }

        .data-table th {
          background: white;
          padding: 14px 16px;
          color: #64748b;
          font-weight: 700;
          font-size: 11.5px;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          border-bottom: 1px solid #eaedf1;
        }

        .data-table td {
          padding: 14px 16px;
          color: #1e293b;
          border-bottom: 1px solid #f1f5f9;
          vertical-align: middle;
        }

        .data-table tr:hover td {
          background-color: #f8fafc;
        }

        .staff-code-badge {
          background: #eff6ff;
          color: #2563eb;
          border: 1px solid #bfdbfe;
          padding: 4px 8px;
          border-radius: 6px;
          font-size: 11.5px;
          font-weight: 700;
          font-family: monospace;
          display: inline-block;
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

        .modal-card {
          background: #ffffff;
          border-radius: 12px;
          width: 100%;
          max-width: 580px;
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

        .modal-header-green {
          background: #15803d;
          color: #ffffff;
          padding: 16px 22px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .modal-body {
          padding: 22px 24px;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .form-row-2 {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
        }

        .form-group {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .form-group label {
          font-size: 13px;
          font-weight: 600;
          color: #334155;
        }

        .form-control {
          width: 100%;
          padding: 9px 12px;
          border-radius: 8px;
          border: 1px solid #cbd5e1;
          font-size: 13.5px;
          color: #0f172a;
          outline: none;
          box-sizing: border-box;
          background: white;
          transition: border-color 0.15s;
        }
        .form-control:focus {
          border-color: #15803d;
          box-shadow: 0 0 0 3px rgba(21, 128, 61, 0.12);
        }
      `}</style>

      {/* Page Header */}
      <PageHeader
        title="Salary Management"
        subtitle="Manage staff salaries, wages, overtime bonus, and track monthly disbursements."
        showBack={false}
        rightContent={
          <button
            id="btn-open-salary-modal"
            onClick={openDisburseModal}
            style={{
              background: '#15803d',
              color: 'white',
              border: 'none',
              padding: '10px 20px',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              boxShadow: '0 2px 6px rgba(21, 128, 61, 0.25)',
              transition: 'all 0.15s ease'
            }}
          >
            <Plus size={16} />
            <span>Disburse Staff Salary</span>
          </button>
        }
      />

      {/* Top Summary Cards */}
      <div style={{ display: 'flex', gap: '16px', marginBottom: '22px', flexWrap: 'wrap' }}>
        <div className="salary-stat-card">
          <div style={{ width: 44, height: 44, borderRadius: 10, background: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#15803d' }}>
            <Banknote size={22} />
          </div>
          <div>
            <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>Total Disbursed</div>
            <div style={{ fontSize: '20px', fontWeight: 800, color: '#15803d' }}>{formatCurrency(summary.totalDisbursed)}</div>
            <div style={{ fontSize: '11px', color: '#64748b' }}>Cumulative salary payout</div>
          </div>
        </div>

        <div className="salary-stat-card">
          <div style={{ width: 44, height: 44, borderRadius: 10, background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2563eb' }}>
            <Users size={22} />
          </div>
          <div>
            <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>Total Staff Paid</div>
            <div style={{ fontSize: '20px', fontWeight: 800, color: '#0f172a' }}>{summary.staffCount}</div>
            <div style={{ fontSize: '11px', color: '#64748b' }}>Staff members with payouts</div>
          </div>
        </div>

        <div className="salary-stat-card">
          <div style={{ width: 44, height: 44, borderRadius: 10, background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#475569' }}>
            <CheckCircle2 size={22} />
          </div>
          <div>
            <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>Total Transactions</div>
            <div style={{ fontSize: '20px', fontWeight: 800, color: '#0f172a' }}>{summary.totalRecords}</div>
            <div style={{ fontSize: '11px', color: '#64748b' }}>Disbursement records</div>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: '15px',
        padding: '15px 20px',
        background: 'white',
        border: '1px solid var(--border-color, #eaedf1)',
        borderRadius: '12px',
        marginBottom: '20px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
      }}>
        {/* Search */}
        <div style={{ position: 'relative', flex: '1', minWidth: '220px' }}>
          <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
          <input
            type="text"
            placeholder="Search by staff name, code, or salary ID..."
            value={searchTerm}
            onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }}
            style={{
              width: '100%',
              padding: '9px 12px 9px 36px',
              border: '1px solid #cbd5e1',
              borderRadius: '8px',
              fontSize: '13.5px',
              outline: 'none',
              boxSizing: 'border-box'
            }}
          />
        </div>

        {/* Month Filter (Searchable) */}
        <div style={{ minWidth: '150px' }}>
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
        <div style={{ minWidth: '130px' }}>
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
        <div style={{ minWidth: '220px' }}>
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
            style={{
              background: '#f1f5f9',
              border: '1px solid #cbd5e1',
              color: '#475569',
              padding: '8px 12px',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <X size={14} /> Clear
          </button>
        )}

        <div style={{ flex: 1 }}></div>

        {/* Refresh */}
        <button
          onClick={fetchSalaries}
          title="Refresh"
          style={{
            background: '#f8fafc',
            color: '#475569',
            border: '1px solid #cbd5e1',
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

      {/* Salary Disbursement History Table */}
      <div style={{ overflowX: 'auto', background: 'white', borderRadius: '12px', border: '1px solid var(--border-color, #eaedf1)', boxShadow: '0 2px 10px rgba(0,0,0,0.02)' }}>
        <table className="data-table">
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
              <th style={{ textAlign: 'right' }}>ACTIONS</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={12} style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>
                  Loading Salary Disbursements...
                </td>
              </tr>
            ) : salaries.length === 0 ? (
              <tr>
                <td colSpan={12} style={{ textAlign: 'center', padding: '50px 20px', color: '#64748b' }}>
                  <Banknote size={36} color="#cbd5e1" style={{ margin: '0 auto 10px' }} />
                  <div style={{ fontWeight: 600, color: '#334155' }}>No salary disbursements found</div>
                  <div style={{ fontSize: '12px', marginTop: '4px', color: '#64748b' }}>Click "+ Disburse Staff Salary" above to record a new payment.</div>
                </td>
              </tr>
            ) : (
              salaries.map((item) => {
                const roleBadge = getRoleBadgeStyle(item.staff?.role || 'Staff');

                return (
                  <tr key={item.id}>
                    <td>
                      <span className="staff-code-badge">{item.salaryCode}</span>
                    </td>
                    <td>
                      <span style={{ fontWeight: 600, color: '#475569' }}>{item.staff?.staffCode || '--'}</span>
                    </td>
                    <td>
                      <div style={{ fontWeight: 600, color: '#0f172a' }}>{item.staff?.name || 'Staff Member'}</div>
                    </td>
                    <td>
                      <span style={{
                        background: roleBadge.bg,
                        color: roleBadge.color,
                        border: `1px solid ${roleBadge.border}`,
                        padding: '2px 8px',
                        borderRadius: '6px',
                        fontSize: '11px',
                        fontWeight: 600,
                        display: 'inline-block'
                      }}>
                        {item.staff?.role || 'Staff'}
                      </span>
                    </td>
                    <td>
                      <div style={{ fontWeight: 600, color: '#0f172a' }}>{item.month} {item.year}</div>
                    </td>
                    <td>
                      <div style={{ fontWeight: 600, color: '#475569' }}>{formatCurrency(item.baseSalary)}</div>
                    </td>
                    <td>
                      <div style={{ color: item.bonus > 0 ? '#15803d' : '#64748b', fontWeight: item.bonus > 0 ? 600 : 400 }}>
                        {formatCurrency(item.bonus)}
                      </div>
                    </td>
                    <td>
                      <div style={{ color: item.deductions > 0 ? '#dc2626' : '#64748b', fontWeight: item.deductions > 0 ? 600 : 400 }}>
                        {formatCurrency(item.deductions)}
                      </div>
                    </td>
                    <td>
                      <div style={{ fontWeight: 800, color: '#15803d', fontSize: '14.5px' }}>
                        {formatCurrency(item.netAmount)}
                      </div>
                    </td>
                    <td>
                      <div style={{ color: '#475569', fontSize: '13px' }}>{formatDateDisplay(item.paymentDate)}</div>
                    </td>
                    <td>
                      <div style={{ fontSize: '12.5px', color: '#334155', fontWeight: 500 }}>{item.paymentMode}</div>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', alignItems: 'center' }}>
                        <button
                          onClick={() => openViewModal(item)}
                          style={{
                            background: '#eff6ff',
                            border: '1px solid #bfdbfe',
                            color: '#2563eb',
                            cursor: 'pointer',
                            padding: '6px 12px',
                            borderRadius: '6px',
                            fontSize: '12px',
                            fontWeight: 600,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                          title="View Details"
                        >
                          <Eye size={14} />
                          <span>View</span>
                        </button>
                        <button
                          onClick={() => handleDeleteRecord(item)}
                          style={{
                            background: '#fef2f2',
                            border: '1px solid #fecaca',
                            color: '#dc2626',
                            cursor: 'pointer',
                            padding: '6px 8px',
                            borderRadius: '6px',
                            display: 'inline-flex',
                            alignItems: 'center'
                          }}
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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 24px', borderTop: '1px solid #e2e8f0', background: '#f8fafc' }}>
            <div style={{ fontSize: '13px', color: '#64748b', fontWeight: 500 }}>
              Showing {totalRecords === 0 ? 0 : (page - 1) * limit + 1} to {Math.min(page * limit, totalRecords)} of {totalRecords} entries
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
                disabled={page >= totalPages}
                style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', background: page >= totalPages ? '#f1f5f9' : 'white', color: page >= totalPages ? '#94a3b8' : '#334155', cursor: page >= totalPages ? 'not-allowed' : 'pointer', fontSize: '13px', fontWeight: 600 }}>
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
        <div className="modal-overlay" onClick={() => setModalOpen(false)}>
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            {/* Green Header */}
            <div className="modal-header-green">
              <span style={{ fontSize: '17px', fontWeight: 700 }}>Disburse Staff Salary</span>
              <button
                onClick={() => setModalOpen(false)}
                style={{ background: 'none', border: 'none', color: '#ffffff', cursor: 'pointer', padding: 2, display: 'flex', alignItems: 'center' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleRecordDisbursement}>
              <div className="modal-body">
                {/* Staff Member (Searchable Dropdown) */}
                <div className="form-group">
                  <label>Staff Member</label>
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
                <div className="form-row-2">
                  <div className="form-group">
                    <label>Salary Month</label>
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

                  <div className="form-group">
                    <label>Salary Year</label>
                    <input
                      type="number"
                      value={modalYear}
                      onChange={(e) => setModalYear(parseInt(e.target.value, 10) || currentYear)}
                      className="form-control"
                      required
                    />
                  </div>
                </div>

                {/* Live Attendance Summary for Selected Month */}
                {loadingAttendance ? (
                  <div style={{ fontSize: '12px', color: '#64748b', fontStyle: 'italic', padding: '10px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0', textAlign: 'center' }}>
                    ⏳ Fetching attendance for {modalMonth} {modalYear}...
                  </div>
                ) : attendanceStats ? (
                  <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '12px 14px' }}>
                    <div style={{ fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      📋 Attendance Summary — {modalMonth} {modalYear}
                      <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 400 }}>({attendanceStats.recordedDays} of {attendanceStats.totalDays} days recorded)</span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '8px' }}>
                      <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', padding: '10px 10px', textAlign: 'center' }}>
                        <div style={{ fontSize: '22px', fontWeight: 800, color: '#16a34a', lineHeight: 1 }}>{attendanceStats.presentDays}</div>
                        <div style={{ fontSize: '11px', fontWeight: 600, color: '#15803d', marginTop: '4px' }}>Present</div>
                      </div>
                      <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '8px', padding: '10px 10px', textAlign: 'center' }}>
                        <div style={{ fontSize: '22px', fontWeight: 800, color: '#d97706', lineHeight: 1 }}>{attendanceStats.halfDays}</div>
                        <div style={{ fontSize: '11px', fontWeight: 600, color: '#b45309', marginTop: '4px' }}>Half Day</div>
                      </div>
                      <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '10px 10px', textAlign: 'center' }}>
                        <div style={{ fontSize: '22px', fontWeight: 800, color: '#dc2626', lineHeight: 1 }}>{attendanceStats.absentDays}</div>
                        <div style={{ fontSize: '11px', fontWeight: 600, color: '#b91c1c', marginTop: '4px' }}>Absent</div>
                      </div>
                      <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '8px', padding: '10px 10px', textAlign: 'center' }}>
                        <div style={{ fontSize: '22px', fontWeight: 800, color: '#2563eb', lineHeight: 1 }}>{attendanceStats.leaveDays}</div>
                        <div style={{ fontSize: '11px', fontWeight: 600, color: '#1d4ed8', marginTop: '4px' }}>On Leave</div>
                      </div>
                    </div>
                    <div style={{ marginTop: '8px', fontSize: '11.5px', color: '#475569', fontWeight: 600, textAlign: 'right' }}>
                      Payable Days: <span style={{ color: '#15803d', fontSize: '13px', fontWeight: 800 }}>{attendanceStats.payableDays}</span> / {attendanceStats.totalDays}
                    </div>
                  </div>
                ) : null}


                {/* Base Salary (₹) */}
                <div className="form-group">
                  <label>Base Salary (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={baseSalary}
                    onChange={(e) => setBaseSalary(e.target.value)}
                    className="form-control"
                    placeholder="0.00"
                    required
                  />
                </div>

                {/* Bonus / Overtime (₹) & Deductions (₹) */}
                <div className="form-row-2">
                  <div className="form-group">
                    <label>Bonus / Overtime (₹)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={bonus}
                      onChange={(e) => setBonus(e.target.value)}
                      className="form-control"
                      placeholder="0.00"
                    />
                  </div>

                  <div className="form-group">
                    <label>Deductions (₹)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={deductions}
                      onChange={(e) => setDeductions(e.target.value)}
                      className="form-control"
                      placeholder="0.00"
                    />
                  </div>
                </div>

                {/* Payment Date & Payment Mode */}
                <div className="form-row-2">
                  <div className="form-group">
                    <label>Payment Date</label>
                    <input
                      type="date"
                      value={paymentDate}
                      onChange={(e) => setPaymentDate(e.target.value)}
                      className="form-control"
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label>Payment Mode</label>
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
                <div style={{
                  background: '#f0fdf4',
                  border: '1px solid #bbf7d0',
                  borderRadius: '8px',
                  padding: '12px 16px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: '#166534' }}>
                      Net Amount to Disburse:
                    </div>
                    <div style={{ fontSize: '11px', color: '#15803d', marginTop: '2px' }}>
                      {formatCurrency(parseFloat(baseSalary) || 0)} (Base) + {formatCurrency(parseFloat(bonus) || 0)} (Bonus) - {formatCurrency(parseFloat(deductions) || 0)} (Deductions)
                    </div>
                  </div>
                  <strong style={{ fontSize: '20px', fontWeight: 800, color: '#15803d' }}>
                    {formatCurrency(calculatedNetAmount)}
                  </strong>
                </div>
              </div>

              {/* Modal Footer Buttons matching screenshot */}
              <div style={{
                padding: '16px 24px',
                background: '#f8fafc',
                borderTop: '1px solid #e2e8f0',
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '10px'
              }}>
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  style={{
                    background: '#475569',
                    color: 'white',
                    border: 'none',
                    padding: '9px 20px',
                    borderRadius: '6px',
                    fontSize: '13.5px',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  style={{
                    background: '#15803d',
                    color: 'white',
                    border: 'none',
                    padding: '9px 22px',
                    borderRadius: '6px',
                    fontSize: '13.5px',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
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
        <div className="modal-overlay" onClick={() => setViewModalOpen(false)}>
          <div className="modal-card" onClick={e => e.stopPropagation()} style={{ maxWidth: '520px', borderRadius: '14px' }}>
            {/* Header */}
            <div style={{
              background: '#0f172a',
              color: 'white',
              padding: '16px 24px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div>
                <span style={{ fontSize: '16px', fontWeight: 700 }}>Salary Disbursement Details</span>
                <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '2px' }}>
                  Record ID: {viewRecord.salaryCode}
                </div>
              </div>
              <button
                onClick={() => setViewModalOpen(false)}
                style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: 2, display: 'flex' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Neat Body without nested card boxes */}
            <div style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
              {/* Staff Member Info Bar */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', paddingBottom: '14px', borderBottom: '1px solid #f1f5f9' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: '#0f172a' }}>
                    {viewRecord.staff?.name}
                  </h3>
                  <div style={{ fontSize: '13px', color: '#64748b', marginTop: '4px' }}>
                    Staff Code: <strong style={{ color: '#334155' }}>{viewRecord.staff?.staffCode}</strong>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span style={{
                    background: getRoleBadgeStyle(viewRecord.staff?.role || 'Staff').bg,
                    color: getRoleBadgeStyle(viewRecord.staff?.role || 'Staff').color,
                    border: `1px solid ${getRoleBadgeStyle(viewRecord.staff?.role || 'Staff').border}`,
                    padding: '4px 10px',
                    borderRadius: '6px',
                    fontSize: '12px',
                    fontWeight: 700
                  }}>
                    {viewRecord.staff?.role || 'Staff'}
                  </span>
                  <div style={{ fontSize: '12.5px', color: '#475569', fontWeight: 600, marginTop: '6px' }}>
                    {viewRecord.month} {viewRecord.year}
                  </div>
                </div>
              </div>

              {/* Neat Line-Item Breakdown (clean list, no card divs!) */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', color: '#475569' }}>
                  <span>Base Monthly Salary</span>
                  <span style={{ fontWeight: 600, color: '#0f172a' }}>{formatCurrency(viewRecord.baseSalary)}</span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', color: '#475569' }}>
                  <span>Bonus / Overtime</span>
                  <span style={{ fontWeight: 600, color: viewRecord.bonus > 0 ? '#15803d' : '#64748b' }}>
                    + {formatCurrency(viewRecord.bonus)}
                  </span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', color: '#475569' }}>
                  <span>Deductions</span>
                  <span style={{ fontWeight: 600, color: viewRecord.deductions > 0 ? '#dc2626' : '#64748b' }}>
                    - {formatCurrency(viewRecord.deductions)}
                  </span>
                </div>
              </div>

              {/* Total Disbursed Highlight */}
              <div style={{
                background: '#f0fdf4',
                borderRadius: '8px',
                padding: '12px 18px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                border: '1px solid #bbf7d0'
              }}>
                <div>
                  <span style={{ fontSize: '13px', fontWeight: 700, color: '#166534' }}>Net Amount Disbursed</span>
                  <div style={{ fontSize: '11px', color: '#15803d' }}>Total payout for this period</div>
                </div>
                <span style={{ fontSize: '22px', fontWeight: 800, color: '#15803d' }}>
                  {formatCurrency(viewRecord.netAmount)}
                </span>
              </div>

              {/* Payment Details (Clean 2-column key-value) */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '12px',
                paddingTop: '6px',
                fontSize: '13px',
                color: '#475569'
              }}>
                <div>
                  <span style={{ color: '#94a3b8', fontSize: '12px', display: 'block' }}>Payment Date</span>
                  <strong style={{ color: '#1e293b' }}>{formatDateDisplay(viewRecord.paymentDate)}</strong>
                </div>
                <div>
                  <span style={{ color: '#94a3b8', fontSize: '12px', display: 'block' }}>Payment Mode</span>
                  <strong style={{ color: '#1e293b' }}>{viewRecord.paymentMode}</strong>
                </div>
                {viewRecord.remarks && (
                  <div style={{ gridColumn: 'span 2' }}>
                    <span style={{ color: '#94a3b8', fontSize: '12px', display: 'block' }}>Remarks</span>
                    <span style={{ color: '#334155' }}>{viewRecord.remarks}</span>
                  </div>
                )}
              </div>

              {/* Footer Meta */}
              <div style={{
                fontSize: '11px',
                color: '#94a3b8',
                display: 'flex',
                justifyContent: 'space-between',
                borderTop: '1px solid #f1f5f9',
                paddingTop: '10px'
              }}>
                <span>Created by: {viewRecord.createdBy || 'System Administrator'}</span>
                <span>Recorded on: {new Date(viewRecord.createdAt).toLocaleDateString()}</span>
              </div>
            </div>

            {/* Footer */}
            <div style={{
              padding: '14px 24px',
              background: '#f8fafc',
              borderTop: '1px solid #e2e8f0',
              display: 'flex',
              justifyContent: 'flex-end'
            }}>
              <button
                type="button"
                onClick={() => setViewModalOpen(false)}
                style={{
                  background: '#334155',
                  color: 'white',
                  border: 'none',
                  padding: '8px 22px',
                  borderRadius: '6px',
                  fontSize: '13.5px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
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

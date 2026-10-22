import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import * as XLSX from 'xlsx';
import { IndianRupee, Search, FileText, Wallet, FileSpreadsheet, X } from 'lucide-react';
import Select from 'react-select';
import { PageHeader } from '../components/PageHeader';
import { FeesAPI } from '../api/fees.api';
import { ReceiptModal } from '../components/ReceiptModal';
import { CollectPaymentModal } from '../components/CollectPaymentModal';
import { LoadingRow } from '../components/LoadingSpinner';
import {
  buildOutstandingTotals,
  getStudentKey,
  isOutstandingDescription,
  isOutstandingInvoice,
  isOutstandingPayment,
  roundMoney,
} from '../utils/outstanding';

const createInvoiceNumber = (dateValue: string | Date, serial: number | string) => {
  const date = new Date(dateValue || Date.now());
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `INV-${year}-${month}-${String(serial).padStart(3, '0')}`;
};

const formatInvoiceNumber = (fee: any, feeGroups: any[] = []) => {
  const dateSource = fee?.paidDate || fee?.updatedAt || fee?.createdAt || fee?.feesList?.[0]?.paidDate || fee?.feesList?.[0]?.updatedAt || fee?.feesList?.[0]?.createdAt || new Date();
  const date = new Date(dateSource);
  const year = date.getFullYear();
  const month = date.getMonth();

  if (feeGroups.length) {
    const monthGroups = feeGroups
      .filter((group: any) => {
        const groupDate = new Date(group?.paidDate || group?.updatedAt || group?.createdAt || group?.feesList?.[0]?.paidDate || group?.feesList?.[0]?.updatedAt || group?.feesList?.[0]?.createdAt || new Date());
        return groupDate.getFullYear() === year && groupDate.getMonth() === month;
      })
      .sort((a: any, b: any) => {
        const aDate = new Date(a?.paidDate || a?.updatedAt || a?.createdAt || a?.feesList?.[0]?.paidDate || a?.feesList?.[0]?.updatedAt || a?.feesList?.[0]?.createdAt || 0).getTime();
        const bDate = new Date(b?.paidDate || b?.updatedAt || b?.createdAt || b?.feesList?.[0]?.paidDate || b?.feesList?.[0]?.updatedAt || b?.feesList?.[0]?.createdAt || 0).getTime();
        return aDate - bDate;
      });

    const serialIndex = monthGroups.findIndex((group: any) => {
      const groupId = group?.id || group?.feesList?.[0]?.id;
      const targetId = fee?.id || fee?.feesList?.[0]?.id;
      return groupId && targetId && groupId === targetId;
    });

    if (serialIndex >= 0) {
      return createInvoiceNumber(dateSource, serialIndex + 1);
    }
  }

  const idSource = (fee?.id || fee?.feesList?.[0]?.id || String(Date.now())).replace(/\D/g, '');
  const serial = Number.parseInt(idSource.slice(-3) || '1', 10) || 1;
  return createInvoiceNumber(dateSource, serial);
};

// Keep the compact table readable: show "UPI / QR" and put the full
// provider list in the cell's tooltip.
const formatPaymentMode = (mode?: string) => (mode || '').split(/[/(]/)[0].trim();

const Fees = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const studentParam = searchParams.get('student');

  const [filter, setFilter] = useState('ALL');
  const [fees, setFees] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<any>({
    value: studentParam || 'ALL',
    label: studentParam ? `${studentParam}` : '-- All Students --'
  });
  const [collegeFilter, setCollegeFilter] = useState<any>({ value: 'ALL', label: '-- All Colleges --' });
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);

  const [selectedReceipt, setSelectedReceipt] = useState<any>(null);
  const [feeToCollect, setFeeToCollect] = useState<any>(null);
  const [feesToCollect, setFeesToCollect] = useState<any[]>([]);
  const [activeFeeId, setActiveFeeId] = useState<string | null>(null);



  const fetchFees = () => {
    setError(null);
    FeesAPI.findAll().then(data => {
      setFees(data);
    }).catch(err => {
      console.error(err);
      setError('Failed to load fees');
    }).finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchFees();
  }, []);

  const studentOptions = useMemo(() => {
    const students = new Map();
    fees.forEach(fee => {
      if (fee.student) {
        const sid = fee.student.manualRegsiName || fee.student.regNo;
        students.set(sid, {
          value: sid,
          label: `${fee.student.name} (${sid})`
        });
      }
    });
    return [{ value: 'ALL', label: '-- All Students --' }, ...Array.from(students.values())];
  }, [fees]);

  const collegeOptions = useMemo(() => {
    const colleges = new Set<string>();
    fees.forEach(fee => {
      if (fee.student?.college) {
        const c = typeof fee.student.college === 'string' ? fee.student.college : fee.student.college.name;
        if (c) colleges.add(c);
      }
    });
    return [{ value: 'ALL', label: '-- All Colleges --' }, ...Array.from(colleges).map(c => ({ value: c, label: c }))];
  }, [fees]);

  useEffect(() => {
    if (studentParam && studentOptions.length > 1) {
      const option = studentOptions.find((opt: any) => opt.value === studentParam);
      if (option) {
        setSelectedStudent(option);
      }
    }
  }, [studentParam, studentOptions]);

  const feeIdParam = searchParams.get('feeId');
  useEffect(() => {
    if (feeIdParam && fees.length > 0 && !feeToCollect) {
      const fee = fees.find(f => f.id === feeIdParam);
      if (fee && fee.status === 'PENDING') {
        setFeeToCollect(fee);
        setActiveFeeId(`pending-${fee.student?.regNo || 'unknown'}`);
      }
    }
  }, [feeIdParam, fees, feeToCollect]);

  const selectStyles = {
    control: (base: any, state: any) => ({
      ...base,
      padding: '2px',
      borderRadius: '8px',
      borderColor: state.isFocused ? 'var(--sidebar-active)' : 'var(--border-color)',
      boxShadow: state.isFocused ? '0 0 0 1px var(--sidebar-active)' : 'none',
      '&:hover': { borderColor: state.isFocused ? 'var(--sidebar-active)' : '#cbd5e1' },
      fontSize: '13px',
      cursor: 'pointer',
      width: '200px',
      background: 'white'
    }),
    option: (base: any, state: any) => ({
      ...base,
      fontSize: '13px',
      backgroundColor: state.isSelected ? 'var(--sidebar-active)' : state.isFocused ? '#f8f9fa' : 'white',
      color: state.isSelected ? 'white' : '#334155',
      cursor: 'pointer'
    })
  };

  const statusOptions = [
    { value: 'ALL', label: '-- All Status --' },
    { value: 'PAID', label: 'Paid' },
    { value: 'UNPAID', label: 'Unpaid' }
  ];

  const filteredFees = fees.filter(fee => {
    let match = true;
    if (filter === 'UNPAID') match = fee.status === 'PENDING';
    if (filter === 'PAID') match = fee.status === 'COMPLETED';
    if (filter === 'PARTIAL') match = fee.status === 'PARTIAL';

    if (selectedStudent.value !== 'ALL' && (fee.student?.manualRegsiName || fee.student?.regNo) !== selectedStudent.value) match = false;

    if (collegeFilter.value !== 'ALL') {
      const c = typeof fee.student?.college === 'string' ? fee.student.college : fee.student?.college?.name;
      if (c !== collegeFilter.value) match = false;
    }

    if (fromDate) {
      if (new Date(fee.createdAt) < new Date(fromDate)) match = false;
    }
    if (toDate) {
      const endOfDay = new Date(toDate);
      endOfDay.setHours(23, 59, 59, 999);
      if (new Date(fee.createdAt) > endOfDay) match = false;
    }

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      match = match && (
        formatInvoiceNumber(fee, fees).toLowerCase().includes(q) ||
        fee.transactionType.toLowerCase().includes(q) ||
        (fee.student?.name || '').toLowerCase().includes(q) ||
        (fee.student?.manualRegsiName || fee.student?.regNo || '').toLowerCase().includes(q) ||
        (fee.referenceNumber || '').toLowerCase().includes(q) ||
        (fee.id || '').toLowerCase().includes(q)
      );
    }
    return match;
  });

  const totalInvoiced = filteredFees
    .filter(f => !isOutstandingPayment(f))
    .reduce((sum, fee) => sum + Number(fee.amount || 0), 0);
  const totalCollected = filteredFees
    .filter(f => f.status === 'COMPLETED')
    .reduce((sum, fee) => sum + Number(fee.amount || 0), 0);

  // Per-student original outstanding, confirmed payments and remaining balance.
  // Built from the full list so confirmed payments are still netted when a
  // filter hides the payment rows.
  const outstandingTotals = useMemo(() => buildOutstandingTotals(fees), [fees]);

  // First original outstanding invoice per student, used for the invoice number
  // shown on the partial/paid summary row.
  const outstandingInvoiceByStudent = useMemo(() => {
    const firstInvoice = new Map<string, any>();
    fees.forEach(fee => {
      if (!isOutstandingInvoice(fee)) return;
      const key = getStudentKey(fee);
      if (!firstInvoice.has(key)) firstInvoice.set(key, fee);
    });
    return firstInvoice;
  }, [fees]);

  // Pending stat = current-month dues + remaining historical outstanding.
  // Original outstanding invoice amounts are never added on top of payments.
  const pendingFeesAmt = useMemo(() => {
    const pendingStudents = new Set<string>();
    let pending = 0;

    filteredFees.forEach(fee => {
      if (fee.status === 'PENDING') {
        pendingStudents.add(getStudentKey(fee));
        if (!isOutstandingInvoice(fee)) {
          pending += Number(fee.amount) || 0;
        }
      }
    });

    pendingStudents.forEach(studentKey => {
      pending += outstandingTotals.get(studentKey)?.remaining || 0;
    });

    return roundMoney(pending);
  }, [filteredFees, outstandingTotals]);

  const displayFees = useMemo(() => {
    const pendingByStudent = new Map();
    const paidByBatch = new Map();

    filteredFees.forEach(f => {
      const studentId = getStudentKey(f);

      const type = (f.transactionType || '').toUpperCase();
      // Previous outstanding dues are shown in the Total Amount / Balance
      // columns only. They must never be counted under Rent / Mess / EB /
      // Fine / Advance, otherwise the same money appears twice in the row.
      // Confirmed outstanding payments are receipts, not rent / EB / mess
      // either.
      let category = 'other';
      if (isOutstandingDescription(f) || isOutstandingPayment(f)) category = 'other';
      else if (type.includes('RENT')) category = 'rent';
      else if (type.includes('EB') || type.includes('ELECTRIC')) category = 'eb';
      else if (type.includes('MESS')) category = 'mess';
      else if (type.includes('FINE')) category = 'fine';
      else if (type.includes('ADVANCE')) category = 'advance';

      if (f.status === 'PENDING') {
        if (!pendingByStudent.has(studentId)) {
          pendingByStudent.set(studentId, {
            isGrouped: true,
            id: `pending-${studentId}`,
            student: f.student,
            status: 'PENDING',
            createdAt: f.createdAt,
            paymentMode: '-',
            totalAmount: 0,
            outstanding: 0,
            displayPaid: 0,
            displayBalance: 0,
            displayStatus: 'Unpaid',
            invoiceFee: null,
            rent: 0, eb: 0, mess: 0, fine: 0, advance: 0, other: 0,
            feesList: []
          });
        }
        const group = pendingByStudent.get(studentId);
        group.totalAmount += Number(f.amount) || 0;
        group[category] += Number(f.amount) || 0;
        group.feesList.push(f);
        if (new Date(f.createdAt) < new Date(group.createdAt)) {
          group.createdAt = f.createdAt;
        }
      } else {
        const paidTime = f.updatedAt || f.createdAt;
        const isOutstandingPay = isOutstandingPayment(f);
        // Group by student + minute of payment so batch payments appear as one
        // receipt. All outstanding payments for a student are summarised into
        // one row so the original invoice is shown once with cumulative paid.
        const batchKey = isOutstandingPay
          ? `${studentId}-outstanding-payments`
          : `${studentId}-${new Date(paidTime).toISOString().slice(0, 16)}`;
        if (!paidByBatch.has(batchKey)) {
          paidByBatch.set(batchKey, {
            isGrouped: true,
            id: `paid-${batchKey}`,
            student: f.student,
            status: f.status,
            createdAt: f.createdAt,
            paidDate: paidTime,
            paymentMode: f.paymentMode || 'N/A',
            totalAmount: 0,
            outstanding: 0,
            displayPaid: 0,
            displayBalance: 0,
            displayStatus: 'Paid',
            invoiceFee: null,
            rent: 0, eb: 0, mess: 0, fine: 0, advance: 0, other: 0,
            feesList: []
          });
        }
        const group = paidByBatch.get(batchKey);
        group.totalAmount += Number(f.amount) || 0;
        group[category] += Number(f.amount) || 0;
        group.feesList.push(f);
        if (isOutstandingPay && new Date(paidTime) > new Date(group.paidDate)) {
          group.paidDate = paidTime;
        }
      }
    });

    // Pending row = remaining dues only. Nothing has been paid against this
    // row, so its Total Paid is ₹0 and its Total Amount / Balance are the
    // remaining amount. Confirmed outstanding payments are summarised on their
    // own partial/paid row below.
    const result: any[] = [];
    pendingByStudent.forEach((group, studentKey) => {
      const totals = outstandingTotals.get(studentKey);
      const pendingDue = roundMoney(
        Math.max(0, group.totalAmount - (totals?.paid || 0)),
      );
      group.displayPaid = 0;
      group.displayBalance = pendingDue;
      group.displayStatus = 'Unpaid';
      group.invoiceFee = null;
      group.pendingDue = pendingDue;
      // Hide a pending row that has been fully settled (no current dues left).
      if (pendingDue > 0.005) result.push(group);
    });
    paidByBatch.forEach((group: any) => {
      const studentKey = getStudentKey(group.feesList[0]);
      const totals = outstandingTotals.get(studentKey);
      const hasOutstandingPayment = group.feesList.some(isOutstandingPayment);
      if (hasOutstandingPayment) {
        group.displayPaid = totals?.paid || 0;
        // The original invoice row must never be reduced by payments: keep the
        // original outstanding amount in its Outstanding Balance cell. The
        // separate pending row below shows the remaining balance.
        group.displayBalance = totals?.original || 0;
        group.displayStatus = (totals?.remaining || 0) > 0.005 ? 'Partial' : 'Paid';
        group.invoiceFee =
          outstandingInvoiceByStudent.get(studentKey) || group.feesList[0];
      } else {
        group.displayPaid = group.totalAmount;
        group.displayBalance = 0;
        group.displayStatus = 'Paid';
        group.invoiceFee = group.feesList[0];
      }
      result.push(group);
    });

    result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return result;
  }, [filteredFees, outstandingTotals]);

  const modalOutstandingPaid = useMemo(() => {
    const first = feesToCollect[0] || feeToCollect;
    if (!first) return 0;
    return outstandingTotals.get(getStudentKey(first))?.paid || 0;
  }, [feesToCollect, feeToCollect, outstandingTotals]);

  const paginatedFees = useMemo(() => {
    return displayFees.slice((page - 1) * limit, page * limit);
  }, [displayFees, page, limit]);

  const totalPages = Math.ceil(displayFees.length / limit);

  const hasFilters =
    selectedStudent.value !== 'ALL' ||
    collegeFilter.value !== 'ALL' ||
    filter !== 'ALL' ||
    fromDate !== '' ||
    toDate !== '' ||
    searchQuery !== '';

  const clearFilters = () => {
    setSelectedStudent({ value: 'ALL', label: '-- All Students --' });
    setCollegeFilter({ value: 'ALL', label: '-- All Colleges --' });
    setFilter('ALL');
    setFromDate('');
    setToDate('');
    setSearchQuery('');
    setPage(1);
  };

  const closePaymentModal = () => {
    setFeeToCollect(null);
    setFeesToCollect([]);
    setActiveFeeId(null);
    if (feeIdParam) {
      searchParams.delete('feeId');
      navigate(`?${searchParams.toString()}`, { replace: true });
    }
  };

  const handleExportExcel = () => {
    const data = displayFees.map(fee => ({
      'Receipt No': fee.invoiceFee ? formatInvoiceNumber(fee.invoiceFee, fees) : '—',
      'Student ID': fee.student?.manualRegsiName || fee.student?.regNo || 'N/A',
      'Student Name': fee.student?.name || 'Unknown',
      'Room': `Room ${fee.student?.roomNo || 'N/A'}`,
      'Payment Date': fee.displayStatus !== 'Unpaid' ? new Date(fee.paidDate || fee.createdAt).toLocaleDateString('en-GB') : '—',
      'Advance': fee.advance || 0,
      'Rent': fee.rent || 0,
      'EB': fee.eb || 0,
      'Mess': fee.mess || 0,
      'Fine': fee.fine || 0,
      'Outstanding Balance': fee.displayBalance || 0,
      'Total Paid': fee.displayPaid || 0,
      'Payment Method': fee.displayStatus !== 'Unpaid' ? (fee.paymentMode || '-') : '—',
      'Status': fee.displayStatus
    }));

    // Calculate totals
    const totalRow = {
      'Receipt No': 'TOTAL',
      'Reg. No': '',
      'Student Name': '',
      'Room': '',
      'Payment Date': '',
      'Advance': displayFees.reduce((sum, f) => sum + f.advance, 0),
      'Rent': displayFees.reduce((sum, f) => sum + f.rent, 0),
      'EB': displayFees.reduce((sum, f) => sum + f.eb, 0),
      'Mess': displayFees.reduce((sum, f) => sum + f.mess, 0),
      'Fine': displayFees.reduce((sum, f) => sum + f.fine, 0),
      'Total Paid': displayFees.reduce((sum, f) => sum + (f.displayPaid || 0), 0),
      'Outstanding Balance': displayFees
        .filter(f => f.displayStatus === 'Unpaid')
        .reduce((sum, f) => sum + (f.displayBalance || 0), 0),
      'Payment Method': '',
      'Status': ''
    };

    data.push(totalRow as any);

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Fees");
    XLSX.writeFile(workbook, "Fees_Report.xlsx");
  };

  return (
    <div className="ui-page fees-page">
      <PageHeader
        title="Fees Paid / Unpaid"
        subtitle="Track hostel rent, mess bills, pending dues, and issue payment receipts"
        icon={<Wallet size={24} color="#fff" />} iconBg="linear-gradient(135deg, #22c55e 0%, #16a34a 100%)"
        rightContent={
          <button onClick={handleExportExcel} className="ui-btn ui-btn-success">
            <FileSpreadsheet size={16} /> Export Excel
          </button>
        }
      />

      <div className="ui-stat-grid fees-stats">
        <div className="ui-card ui-stat">
          <div className="ui-stat-icon ui-stat-icon--indigo">
            <FileText size={24} />
          </div>
          <div>
            <div className="ui-stat-label">Total Invoiced</div>
            <div className="ui-stat-value">₹{totalInvoiced.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
          </div>
        </div>
        <div className="ui-card ui-stat">
          <div className="ui-stat-icon ui-stat-icon--green">
            <IndianRupee size={24} />
          </div>
          <div>
            <div className="ui-stat-label">Total Fees Collected</div>
            <div className="ui-stat-value">₹{totalCollected.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
          </div>
        </div>
        <div className="ui-card ui-stat">
          <div className="ui-stat-icon ui-stat-icon--red">
            <IndianRupee size={24} />
          </div>
          <div>
            <div className="ui-stat-label">Pending Unpaid Fees</div>
            <div className="ui-stat-value">₹{pendingFeesAmt.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
          </div>
        </div>
      </div>

      <div className="ui-toolbar">
        <div className="ui-toolbar-group">
          <span className="ui-toolbar-label">Show</span>
          <select
            className="ui-select fees-limit"
            value={limit}
            onChange={e => { setLimit(Number(e.target.value)); setPage(1); }}
          >
            <option value={10}>10</option>
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
            <option value={250}>250</option>
            <option value={500}>500</option>
            <option value={1000}>1000</option>
            <option value={99999}>All</option>
          </select>
          <span className="ui-toolbar-label">entries</span>
        </div>
        <div className="ui-toolbar-divider"></div>

        <div className="ui-input-icon fees-search">
          <Search size={16} />
          <input
            type="text"
            className="ui-input"
            placeholder="Search by invoice, student, reg no..."
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
          />
        </div>

        <Select
          options={collegeOptions}
          value={collegeFilter}
          onChange={(val) => { setCollegeFilter(val); setPage(1); }}
          styles={selectStyles}
          placeholder="Search college..."
          isSearchable={true}
        />

        <Select
          options={studentOptions}
          value={selectedStudent}
          onChange={(val) => { setSelectedStudent(val); setPage(1); }}
          styles={selectStyles}
          placeholder="Search student..."
          isSearchable={true}
        />

        <Select
          options={statusOptions}
          value={statusOptions.find(o => o.value === filter)}
          onChange={(val: any) => { setFilter(val.value); setPage(1); }}
          styles={selectStyles}
          isSearchable={false}
        />

        <div className="ui-field-inline">
          <span className="ui-field-label">From</span>
          <input type="date" value={fromDate} onChange={e => { setFromDate(e.target.value); setPage(1); }} className="ui-input ui-input--inline" />
        </div>

        <div className="ui-field-inline">
          <span className="ui-field-label">To</span>
          <input type="date" value={toDate} onChange={e => { setToDate(e.target.value); setPage(1); }} className="ui-input ui-input--inline" />
        </div>

        {hasFilters && (
          <button
            className="ui-btn ui-btn-soft ui-btn-sm"
            onClick={clearFilters}
            title="Clear all filters"
          >
            <X size={14} strokeWidth={3} /> Clear All
          </button>
        )}
        <div className="ui-spacer"></div>
      </div>

      <div className="ui-table-wrap">
        <div className="ui-table-scroll">
          <table className="ui-table fees-table">
            <colgroup>
              <col className="fees-col-invoice" />
              <col className="fees-col-person" />
              <col className="fees-col-room" />
              <col className="fees-col-date" />
              <col className="fees-col-advance" />
              <col className="fees-col-rent" />
              <col className="fees-col-eb" />
              <col className="fees-col-mess" />
              <col className="fees-col-fine" />
              <col className="fees-col-outstanding" />
              <col className="fees-col-total" />
              <col className="fees-col-method" />
              <col className="fees-col-status" />
              <col className="fees-col-action" />
            </colgroup>
            <thead>
              <tr>
                <th>Invoice No</th>
                <th>Student Name &amp; Reg. No</th>
                <th>Room</th>
                <th>Payment Date</th>
                <th className="num">Advance</th>
                <th className="num">Rent</th>
                <th className="num">EB</th>
                <th className="num">Mess</th>
                <th className="num">Fine</th>
                <th className="num">Outstanding Balance</th>
                <th className="num">Total Paid</th>
                <th>Payment Method</th>
                <th>Status</th>
                <th className="num">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <LoadingRow colSpan={14} />
              ) : error ? (
                <tr>
                  <td colSpan={14} className="ui-empty ui-empty-danger">{error}</td>
                </tr>
              ) : paginatedFees.length === 0 ? (
                <tr>
                  <td colSpan={14} className="ui-empty">No fee transactions found.</td>
                </tr>
              ) : (
                paginatedFees.map((fee: any) => {
                  const regNo = fee.student?.manualRegsiName || fee.student?.regNo || 'N/A';
                  const studentName = fee.student?.name || 'Unknown';
                  return (
                    <tr
                      key={fee.id}
                      className={activeFeeId === fee.id ? 'fees-row-active' : undefined}
                    >
                      <td
                        className="ui-cell-link fees-invoice"
                        title={fee.invoiceFee ? formatInvoiceNumber(fee.invoiceFee, fees) : undefined}
                      >
                        {fee.invoiceFee ? formatInvoiceNumber(fee.invoiceFee, fees) : '—'}
                      </td>
                      <td>
                        <div className="fees-person">
                          <div className="fees-person-info">
                            <div className="fees-person-name" title={studentName}>{studentName}</div>
                            <div className="fees-person-meta" title={regNo}>{regNo}</div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className="ui-badge ui-badge-blue" title={`Room ${fee.student?.roomNo || 'N/A'}`}>
                          Room {fee.student?.roomNo || 'N/A'}
                        </span>
                      </td>
                      <td>{fee.status === 'COMPLETED' ? new Date(fee.paidDate || fee.createdAt).toLocaleDateString('en-GB') : '—'}</td>

                      <td className="num fees-credit">₹{fee.advance.toLocaleString('en-IN')}</td>
                      <td className="num">
                        <div>₹{fee.rent.toLocaleString('en-IN')}</div>
                        {fee.status === 'COMPLETED' && (() => {
                          const rentFee = fee.feesList?.find((x: any) => (x.transactionType || '').toUpperCase().includes('RENT'));
                          const match = rentFee?.description?.match(/Paid for \d+ Months \(([^)]+)\)/);
                          if (match) {
                            const parts = match[1].split('-');
                            return <div className="fees-note" title={`Paid till ${parts[parts.length - 1].trim()}`}>Paid till {parts[parts.length - 1].trim()}</div>;
                          }
                          return null;
                        })()}
                      </td>
                      <td className="num">₹{fee.eb.toLocaleString('en-IN')}</td>
                      <td className="num">
                        <div>₹{fee.mess.toLocaleString('en-IN')}</div>
                        {fee.feesList?.filter((x: any) => x.transactionType === 'MESS DEDUCTION').map((d: any, idx: number) => {
                          const match = d.description?.match(/\((\d+\s*days)\)/i);
                          const daysText = match ? match[1] : '';
                          return (
                            <div
                              key={idx}
                              className="fees-note fees-note--danger"
                              title={`Inc. -₹${Math.abs(d.amount).toLocaleString('en-IN')}${daysText ? ` (${daysText})` : ''}`}
                            >
                              Inc. -₹{Math.abs(d.amount).toLocaleString('en-IN')} {daysText ? `(${daysText})` : ''}
                            </div>
                          );
                        })}
                        {fee.status === 'COMPLETED' && (() => {
                          const messFee = fee.feesList?.find((x: any) => (x.transactionType || '').toUpperCase().includes('MESS') && x.transactionType !== 'MESS DEDUCTION');
                          const match = messFee?.description?.match(/Paid for \d+ Months \(([^)]+)\)/);
                          if (match) {
                            const parts = match[1].split('-');
                            return <div className="fees-note" title={`Paid till ${parts[parts.length - 1].trim()}`}>Paid till {parts[parts.length - 1].trim()}</div>;
                          }
                          return null;
                        })()}
                      </td>
                      <td className="num">₹{fee.fine.toLocaleString('en-IN')}</td>

                      <td className={`num fees-outstanding${(fee.displayBalance || 0) > 0 ? ' fees-outstanding--due' : ' fees-outstanding--clear'}`}>
                        ₹{Number(fee.displayBalance || 0).toLocaleString('en-IN')}
                      </td>

                      <td className={`num fees-total${fee.displayStatus === 'Unpaid' ? ' fees-total--pending' : ''}`}>
                        ₹{Number(fee.displayPaid || 0).toLocaleString('en-IN')}
                      </td>

                      <td title={fee.status === 'COMPLETED' ? fee.paymentMode : undefined}>
                        {fee.status === 'COMPLETED' ? formatPaymentMode(fee.paymentMode) : '—'}
                      </td>
                      <td>
                        <span className={`ui-badge ${fee.displayStatus === 'Paid' ? 'ui-badge-green' : fee.displayStatus === 'Partial' ? 'ui-badge-warning' : 'ui-badge-red'}`}>
                          {fee.displayStatus}
                        </span>
                      </td>
                      <td className="fees-actions">
                        {fee.displayStatus === 'Unpaid' ? (
                          <button
                            onClick={() => { setActiveFeeId(fee.id); setFeesToCollect(fee.feesList); }}
                            className="ui-btn ui-btn-primary ui-btn-sm"
                          >
                            <Wallet size={14} /> Pay Now
                          </button>
                        ) : (
                          <button
                            onClick={() => { setActiveFeeId(fee.id); setSelectedReceipt(fee); }}
                            className="ui-btn ui-btn-secondary ui-btn-sm"
                          >
                            <FileText size={14} /> View Receipt
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 0 && (
          <div className="ui-pagination">
            <div className="ui-pagination-info">
              Showing {(page - 1) * limit + 1} to {Math.min(page * limit, displayFees.length)} of {displayFees.length} entries
            </div>
            <div className="ui-pagination-pages">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="ui-page-btn">
                Previous
              </button>
              <button className="ui-page-btn active">
                {page}
              </button>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages || totalPages === 0}
                className="ui-page-btn">
                Next
              </button>
            </div>
          </div>
        )}

      </div>

      {/* Receipt Modal */}
      {selectedReceipt && (
        <ReceiptModal fee={selectedReceipt} onClose={() => { setSelectedReceipt(null); setActiveFeeId(null); }} />
      )}

      {/* Collect Payment Modal */}
      {(feeToCollect || feesToCollect.length > 0) && (
        <CollectPaymentModal
          fee={feeToCollect}
          fees={feesToCollect}
          outstandingPaid={modalOutstandingPaid}
          onClose={closePaymentModal}
          onSuccess={() => {
            closePaymentModal();
            fetchFees();
          }}
        />
      )}
    </div>
  );
};

export default Fees;

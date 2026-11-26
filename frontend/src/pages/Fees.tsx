import { useState, useEffect, useMemo, useRef, type ChangeEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import * as XLSX from 'xlsx';
import { IndianRupee, Search, FileText, Wallet, FileSpreadsheet, X, Upload, Download, CheckCircle2, AlertTriangle, Trash2, RotateCcw, Eye } from 'lucide-react';
import Select from 'react-select';
import { toast } from 'react-toastify';
import Swal from 'sweetalert2';
import { PageHeader } from '../components/PageHeader';
import { FeesAPI } from '../api/fees.api';
import { ReceiptModal } from '../components/ReceiptModal';
import { CollectPaymentModal } from '../components/CollectPaymentModal';
import { RoomFeesReportModal } from '../components/RoomFeesReportModal';
import { FeeGenerationNotice } from '../components/FeeGenerationNotice';
import { LoadingRow } from '../components/LoadingSpinner';
import { RoomAPI } from '../api/room.api';
import { parseFeeImportFile, type FeeImportRow } from '../utils/feeImport';
import { isWardenStudent } from '../utils/warden';
import {
  buildOutstandingSummary,
  buildOutstandingTotals,
  getStudentKey,
  isCurrentCycleFee,
  isImportedInvoice,
  isMessFee,
  isOutstandingDescription,
  isOutstandingInvoice,
  isOutstandingPayment,
  isPreviousSettledFee,
  roundMoney,
} from '../utils/outstanding';
import { formatInvoiceNumber } from '../utils/invoiceNumber';
import { formatBillingMonth, formatBillingMonthOnly, formatBillingMonthShort, getBillingMonths, isPostpaidPayableFee, resolveFeeBillingMonth } from '../utils/billingCycle';
import { getOverdueDays } from '../utils/dueDate';
import { buildFeeReconciliation } from '../utils/feeReconciliation';
import { sendReceiptViaWhatsApp } from '../utils/whatsappReceipt';

// Keep the compact table readable: show "UPI / QR" and put the full
// provider list in the cell's tooltip.
const formatPaymentMode = (mode?: string) => {
  const clean = (mode || '').split(/[/(]/)[0].trim();
  return clean === 'ADVANCE_RENT' ? 'Advance Rent' : clean;
};

const getSimpleFeeName = (fee: any): string => {
  const type = String(fee?.transactionType || '').toUpperCase();
  const desc = String(fee?.description || '').toLowerCase();
  if (type === 'FINE') {
    if (desc.includes('rent')) return 'Rent Fine';
    if (desc.includes('eb')) return 'EB Fine';
    if (desc.includes('mess')) return 'Mess Fine';
    return 'Late Fine';
  }
  if (type === 'RENT') return 'Room Rent';
  if (type === 'EB_BILL') return 'EB Bill';
  if (type === 'MESS') return 'Mess Fee';
  if (type === 'ADVANCE') return 'Advance';
  return type ? type.replace(/_/g, ' ') : 'Pending Fee';
};

// Extra report categories added on top of the existing college list.
// SSM stays on its own; every other college is reported as Seasindhu.
const collegeCategoryOf = (college: any) => {
  const name = typeof college === 'string' ? college : college?.name;
  return String(name || '').trim().toUpperCase() === 'SSM' ? 'SSM' : 'Seasindhu';
};

const formatMoney = (value: number) =>
  `${value < 0 ? '−' : ''}₹${Math.abs(value).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const Fees = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const studentParam = searchParams.get('student');

  const [filter, setFilter] = useState('ALL');
  const [fees, setFees] = useState<any[]>([]);
  const [isDeveloper, setIsDeveloper] = useState(false);
  const [showTrash, setShowTrash] = useState(false);
  const [trashFees, setTrashFees] = useState<any[]>([]);
  const [trashLoading, setTrashLoading] = useState(false);
  const [rooms, setRooms] = useState<string[]>([]);
  const [allRoomsData, setAllRoomsData] = useState<any[]>([]);
  const [showRoomPdfModal, setShowRoomPdfModal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<any>({
    value: studentParam || 'ALL',
    label: studentParam ? `${studentParam}` : '-- All Students --'
  });
  const [collegeFilter, setCollegeFilter] = useState<any>({ value: 'ALL', label: '-- All Colleges --' });
  const [collegeCategoryFilter, setCollegeCategoryFilter] = useState<any>({ value: 'ALL', label: '-- All Categories --' });
  const [roomFilter, setRoomFilter] = useState<any>({ value: 'ALL', label: '-- All Rooms --' });
  const [billingMonthFilter, setBillingMonthFilter] = useState<any>({ value: 'ALL', label: '-- All Billing Months --' });
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);

  const [selectedReceipt, setSelectedReceipt] = useState<any>(null);
  const [feeToCollect, setFeeToCollect] = useState<any>(null);
  const [feesToCollect, setFeesToCollect] = useState<any[]>([]);
  const [activeFeeId, setActiveFeeId] = useState<string | null>(null);
  const [outstandingModalData, setOutstandingModalData] = useState<any>(null);

  const importInputRef = useRef<HTMLInputElement | null>(null);
  const [importRows, setImportRows] = useState<FeeImportRow[] | null>(null);
  const [importPreview, setImportPreview] = useState<any | null>(null);
  const [importResult, setImportResult] = useState<any | null>(null);
  const [importBusy, setImportBusy] = useState(false);



  const fetchFees = () => {
    setError(null);
    return FeesAPI.findAll().then(data => {
      setFees(data);
      return data as any[];
    }).catch((err: Error) => {
      console.error('Failed to load fees:', err);
      const message = err.message || 'Failed to load fees';
      setError(message);
      toast.error(message);
      return [] as any[];
    }).finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchFees();
  }, []);

  useEffect(() => {
    try {
      const token = localStorage.getItem('access_token') || localStorage.getItem('token');
      if (!token) return;
      const payload = JSON.parse(atob(token.split('.')[1]));
      setIsDeveloper(payload.role === 'DEVELOPER');
    } catch (error) {
      console.error('Failed to determine the signed-in role for fee trash controls:', error);
    }
  }, []);

  const fetchTrash = async () => {
    setTrashLoading(true);
    try {
      const rows = await FeesAPI.findTrash();
      setTrashFees(Array.isArray(rows) ? rows : []);
    } catch (error: any) {
      toast.error(error.message || 'Failed to load trashed fee records');
    } finally {
      setTrashLoading(false);
    }
  };

  const moveFeeToTrash = async (fee: any) => {
    const ids = Array.from(
      new Set<string>(
        (fee.feesList || [fee])
          .map((row: any) => String(row?.id || ''))
          .filter(Boolean),
      ),
    );
    if (ids.length === 0) {
      toast.error('No fee transaction records were found for this row');
      return;
    }

    const studentName = fee.student?.name || 'this student';
    const confirmation = await Swal.fire({
      title: 'Move fee record to Trash?',
      text: `${ids.length} fee transaction(s) for ${studentName} will be hidden from the Fees page. A developer can restore them. This does not refund or reverse any payment.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'Yes, move to Trash',
      cancelButtonText: 'No, cancel',
    });
    if (!confirmation.isConfirmed) return;

    try {
      await FeesAPI.moveToTrash(ids);
      toast.success(`${ids.length} fee transaction(s) moved to Trash`);
      await fetchFees();
      if (showTrash) await fetchTrash();
    } catch (error: any) {
      toast.error(error.message || 'Failed to move fee records to Trash');
    }
  };

  const restoreFeeFromTrash = async (fee: any) => {
    const ids = (fee.feesList || [fee]).map((row: any) => String(row?.id || '')).filter(Boolean);
    if (ids.length === 0) {
      toast.error('No fee transaction records were found to restore');
      return;
    }

    const studentName = fee.student?.name || 'this student';
    const confirmation = await Swal.fire({
      title: 'Restore fee records?',
      text: `Restore ${ids.length} trashed fee transaction(s) for ${studentName}? They will appear in the Fees page again.`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#16a34a',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'Yes, restore',
      cancelButtonText: 'No, cancel',
    });
    if (!confirmation.isConfirmed) return;

    try {
      await FeesAPI.restoreTrashRows(ids);
      toast.success(`${studentName}'s ${ids.length} fee transaction(s) restored`);
      await Promise.all([fetchTrash(), fetchFees()]);
    } catch (error: any) {
      toast.error(error.message || 'Failed to restore fee transaction');
    }
  };

  const trashGroups = useMemo(() => {
    const groups = new Map<string, any>();
    trashFees.forEach(fee => {
      const studentId = String(fee.studentId || fee.student?.id || fee.id);
      const deletedAt = fee.deletedAt ? new Date(fee.deletedAt).toISOString() : '';
      const groupId = `${studentId}-${deletedAt}`;
      if (!groups.has(groupId)) {
        groups.set(groupId, {
          id: groupId,
          studentId,
          student: fee.student,
          feesList: [],
        });
      }
      groups.get(groupId).feesList.push(fee);
    });

    return Array.from(groups.values()).map(group => {
      const rows = group.feesList;
      return {
        ...group,
        feeTypes: Array.from(new Set(rows.map((row: any) => row.transactionType).filter(Boolean))),
        billingMonths: Array.from(new Set(rows.map((row: any) => row.billingMonth).filter(Boolean))),
        invoiceNumbers: Array.from(new Set(
          rows
            .filter((row: any) => row.status === 'COMPLETED' && row.invoiceNumber)
            .map((row: any) => row.invoiceNumber),
        )),
        totalAmount: rows.reduce((sum: number, row: any) => sum + (Number(row.amount) || 0), 0),
        statuses: Array.from(new Set(rows.map((row: any) => row.status).filter(Boolean))),
        deletedAt: rows.reduce((latest: Date | null, row: any) => {
          if (!row.deletedAt) return latest;
          const date = new Date(row.deletedAt);
          return !latest || date > latest ? date : latest;
        }, null as Date | null),
      };
    });
  }, [trashFees]);

  useEffect(() => {
    RoomAPI.findAll()
      .then(data => {
        const allRooms = Array.isArray(data) ? data : (data.data || []);
        setAllRoomsData(allRooms);
        setRooms(allRooms.map((room: any) => String(room.id)));
      })
      .catch(err => {
        console.error('Failed to load rooms for Fees filter:', err);
      });
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

  const collegeCategoryOptions = [
    { value: 'ALL', label: '-- All Categories --' },
    { value: 'SSM', label: 'SSM' },
    { value: 'Seasindhu', label: 'Seasindhu' },
  ];

  // Which billing cycle to explain in the generation notice. When a specific
  // student or college is selected we can show one schedule; otherwise we show
  // both PREPAID and POSTPAID.
  const selectedBillingCycle = useMemo(() => {
    if (selectedStudent.value !== 'ALL') {
      const fee = fees.find(
        f => (f.student?.manualRegsiName || f.student?.regNo) === selectedStudent.value,
      );
      return fee?.student?.college?.billingCycle || null;
    }
    if (collegeFilter.value !== 'ALL' || collegeCategoryFilter.value !== 'ALL') {
      const fee = fees.find(f => {
        if (
          collegeCategoryFilter.value !== 'ALL' &&
          collegeCategoryOf(f.student?.college) !== collegeCategoryFilter.value
        ) return false;
        if (collegeFilter.value === 'ALL') return true;
        const c = typeof f.student?.college === 'string' ? f.student.college : f.student?.college?.name;
        return c === collegeFilter.value;
      });
      return fee?.student?.college?.billingCycle || null;
    }
    return null;
  }, [fees, selectedStudent, collegeFilter, collegeCategoryFilter]);

  const roomOptions = useMemo(() => {
    const roomNumbers = new Set<string>(rooms);
    fees.forEach(fee => {
      const roomNo = fee.student?.roomNo;
      if (roomNo) roomNumbers.add(String(roomNo));
    });
    return [
      { value: 'ALL', label: '-- All Rooms --' },
      ...Array.from(roomNumbers)
        .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
        .map(room => ({ value: room, label: `Room ${room}` })),
    ];
  }, [fees, rooms]);

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
        const { previousMonthStr, currentMonthStr } = getBillingMonths();
        const collegeCycle = (fee.student?.college?.billingCycle || 'PREPAID').toUpperCase();
        const feeMonth = resolveFeeBillingMonth(fee);
        const feeType = String(fee.transactionType || '').toUpperCase();
        const isCycleRelevantPending =
          !feeMonth ||
          (collegeCycle === 'POSTPAID'
            ? (feeType.includes('FINE')
              ? isPostpaidPayableFee(fee, previousMonthStr)
              : feeMonth === previousMonthStr || feeMonth === currentMonthStr)
            : (feeType.includes('RENT') || feeType.includes('ADVANCE')
              ? feeMonth === currentMonthStr || feeMonth === previousMonthStr
              : (feeType.includes('EB') || feeType.includes('ELECTRIC') || feeType.includes('FINE'))
                ? feeMonth === previousMonthStr || feeMonth === currentMonthStr
                : feeMonth === currentMonthStr || feeMonth === previousMonthStr));

        if (!isCycleRelevantPending) {
          toast.error('This fee is not part of the current payable billing cycle.');
          return;
        }

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

  const billingMonthOptions = useMemo(() => {
    const months = Array.from(
      new Set(
        fees
          .map((fee) => resolveFeeBillingMonth(fee))
          .filter((month): month is string => Boolean(month)),
      ),
    ).sort().reverse();
    return [
      { value: 'ALL', label: '-- All Billing Months --' },
      ...months.map((month) => ({ value: month, label: formatBillingMonth(month) || month })),
    ];
  }, [fees]);

  const filteredFees = useMemo(() => fees.filter(fee => {
    // Hide old settled receipts/invoices. Cycle-relevant pending dues for both
    // PREPAID and POSTPAID must remain visible even when generated earlier.
    const { previousMonthStr, currentMonthStr } = getBillingMonths();
    const collegeCycleForFilter = (fee.student?.college?.billingCycle || 'PREPAID').toUpperCase();
    const feeMonth = resolveFeeBillingMonth(fee);
    const feeType = String(fee.transactionType || '').toUpperCase();
    const isPostpaidPayableNow =
      fee.status === 'PENDING' &&
      (!feeMonth ||
        (collegeCycleForFilter === 'POSTPAID'
          ? (feeType.includes('FINE')
            ? isPostpaidPayableFee(fee, previousMonthStr)
            : feeMonth === previousMonthStr || feeMonth === currentMonthStr)
          : (feeType.includes('RENT') || feeType.includes('ADVANCE')
            ? feeMonth === currentMonthStr || feeMonth === previousMonthStr
            : (feeType.includes('EB') || feeType.includes('ELECTRIC') || feeType.includes('FINE'))
              ? feeMonth === previousMonthStr || feeMonth === currentMonthStr
              : feeMonth === currentMonthStr || feeMonth === previousMonthStr)));
    if (isPreviousSettledFee(fee) && !isPostpaidPayableNow) return false;

    let match = true;
    if (filter === 'UNPAID') {
      match =
        fee.status === 'PENDING' &&
        (!isImportedInvoice(fee) || isPostpaidPayableNow);
    }
    if (filter === 'PAID') match = fee.status === 'COMPLETED';
    if (filter === 'PARTIAL') match = fee.status === 'PARTIAL';

    if (selectedStudent.value !== 'ALL' && (fee.student?.manualRegsiName || fee.student?.regNo) !== selectedStudent.value) match = false;

    if (collegeFilter.value !== 'ALL') {
      const c = typeof fee.student?.college === 'string' ? fee.student.college : fee.student?.college?.name;
      if (c !== collegeFilter.value) match = false;
    }
    if (
      collegeCategoryFilter.value !== 'ALL' &&
      collegeCategoryOf(fee.student?.college) !== collegeCategoryFilter.value
    ) match = false;

    if (roomFilter.value !== 'ALL' && String(fee.student?.roomNo || '') !== roomFilter.value) match = false;

    if (billingMonthFilter.value !== 'ALL' && feeMonth !== billingMonthFilter.value) match = false;

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
        formatInvoiceNumber(fee).toLowerCase().includes(q) ||
        fee.transactionType.toLowerCase().includes(q) ||
        (fee.student?.name || '').toLowerCase().includes(q) ||
        (fee.student?.manualRegsiName || fee.student?.regNo || '').toLowerCase().includes(q) ||
        (fee.referenceNumber || '').toLowerCase().includes(q) ||
        (fee.id || '').toLowerCase().includes(q)
      );
    }
    return match;
  }), [
    fees,
    filter,
    selectedStudent,
    collegeFilter,
    collegeCategoryFilter,
    roomFilter,
    billingMonthFilter,
    fromDate,
    toDate,
    searchQuery,
  ]);


  // Per-student original outstanding, confirmed payments and remaining balance.
  // Built from the full list so confirmed payments are still netted when a
  // filter hides the payment rows.
  const outstandingTotals = useMemo(() => buildOutstandingTotals(fees), [fees]);

  // Original outstanding invoices per student, oldest first. Used to show the
  // original amount as an unpaid row while no payment has been recorded yet.
  const outstandingInvoicesByStudent = useMemo(() => {
    const map = new Map<string, any[]>();
    fees.forEach(fee => {
      if (!isOutstandingInvoice(fee)) return;
      const key = getStudentKey(fee);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(fee);
    });
    map.forEach(invoices => {
      invoices.sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      );
    });
    return map;
  }, [fees]);

  const displayFees = useMemo(() => {
    const pendingByStudent = new Map();
    const notDueByStudent = new Map();
    const paidByBatch = new Map();

    // POSTPAID colleges bill the postpaid month (previous month); PREPAID
    // colleges bill current-month rent but previous-month EB and fine.
    const { previousMonthStr, currentMonthStr } = getBillingMonths();

    filteredFees.forEach(f => {
      if (isMessFee(f)) return;

      const studentId = getStudentKey(f);

      const type = (f.transactionType || '').toUpperCase();
      if (f.status === 'PENDING' && type === 'ADVANCE') return;
      // Previous outstanding dues are shown in the Total Amount / Balance
      // columns only. They must never be counted under Rent / Mess / EB /
      // Fine / Advance, otherwise the same money appears twice in the row.
      // Confirmed outstanding payments are receipts, not rent / EB / mess
      // either.
      let category = 'other';
      if (isOutstandingDescription(f) || isOutstandingPayment(f)) category = 'other';
      else if (type === 'ADVANCE_RENT') category = 'advanceRent';
      else if (type.includes('RENT')) category = 'rent';
      else if (type.includes('EB') || type.includes('ELECTRIC')) category = 'eb';
      else if (type.includes('MESS')) category = 'mess';
      else if (type.includes('FINE')) category = 'fine';
      else if (type.includes('ADVANCE')) category = 'advance';

      if (f.status === 'PENDING') {
        // Original outstanding invoices are handled separately (shown as an
        // unpaid row only while no payment exists).
        const collegeCycle = (f.student?.college?.billingCycle || 'PREPAID').toUpperCase();
        const feeMonth = resolveFeeBillingMonth(f);

        const isCycleRelevant = (() => {
          if (collegeCycle === 'POSTPAID') {
            // Postpaid: show/pay the postpaid month's rent, EB and fine.
            // Invoices may be labeled/stored as previous or current billing month.
            if (category === 'fine') return isPostpaidPayableFee(f, previousMonthStr);
            if (category === 'rent' || category === 'eb') {
              return !feeMonth || feeMonth === previousMonthStr || feeMonth === currentMonthStr;
            }
            return !feeMonth || feeMonth === previousMonthStr || feeMonth === currentMonthStr;
          }

          // Prepaid: current month rent, previous month EB and fine.
          if (!feeMonth) return true;
          if (category === 'rent' || category === 'advance') {
            return feeMonth === currentMonthStr;
          }
          if (category === 'eb' || category === 'fine') {
            return feeMonth === previousMonthStr || feeMonth === currentMonthStr;
          }
          return feeMonth === currentMonthStr || feeMonth === previousMonthStr;
        })();

        if (isOutstandingInvoice(f) || (isImportedInvoice(f) && !isCycleRelevant)) return;

        if (!isCycleRelevant) {
          if (!notDueByStudent.has(studentId)) {
            notDueByStudent.set(studentId, {
              isGrouped: true,
              id: `not-due-${studentId}`,
              student: f.student,
              status: 'PENDING',
              createdAt: f.createdAt,
              paymentMode: '-',
              totalAmount: 0,
              outstanding: 0,
              displayPaid: 0,
              displayBalance: 0,
              displayStatus: 'Not Due',
              invoiceFee: null,
              rent: 0, eb: 0, mess: 0, fine: 0, advance: 0, advanceRent: 0, other: 0,
              feesList: []
            });
          }
          const notDueGroup = notDueByStudent.get(studentId);
          notDueGroup.totalAmount += Number(f.amount) || 0;
          notDueGroup[category] += Number(f.amount) || 0;
          notDueGroup.feesList.push(f);
          if (new Date(f.createdAt) < new Date(notDueGroup.createdAt)) {
            notDueGroup.createdAt = f.createdAt;
          }
          return;
        }

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
            rent: 0, eb: 0, mess: 0, fine: 0, advance: 0, advanceRent: 0, other: 0,
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
        const paidTime = f.paidDate || f.createdAt || f.updatedAt;
        const isOutstandingPay = isOutstandingPayment(f);
        // Group only the rows that were actually paid together. Each payment
        // submission carries its own [PAY:...] token; Razorpay rows share one
        // payment id in their Ref. Grouping by timestamp alone used to merge
        // two separate payments made in the same minute into one receipt.
        const description = String(f.description || '');
        const paymentGroup =
          description.match(/\[PAY:([^\]]+)\]/)?.[1] ||
          description.match(/\|\s*Ref:\s*(Razorpay\s+[^\s|]+)/i)?.[1];
        // Each confirmed outstanding payment must remain its own receipt/invoice
        // entry. Do not merge them into a single student summary row or the app
        // will keep reusing the first payment's invoice number.
        // Rows from one payment share a [PAY:...] token. Keep them in a single
        // receipt even when an outstanding-balance payment is included; only
        // fall back to per-id grouping for legacy rows without a token.
        const batchKey = paymentGroup
          ? `${studentId}-payment-${paymentGroup}`
          : isOutstandingPay
            ? `${studentId}-outstanding-${f.id}`
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
            rent: 0, eb: 0, mess: 0, fine: 0, advance: 0, advanceRent: 0, other: 0,
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

    // Pending row = current-month dues only. Original outstanding invoices are
    // handled separately below.
    const result: any[] = [];
    pendingByStudent.forEach((group) => {
      const pendingDue = roundMoney(Math.max(0, group.totalAmount));
      group.displayPaid = 0;
      // Regular current-month dues (Rent / Mess / EB / Fine) are not an
      // outstanding-balance ledger. Their amounts already appear in their own
      // columns, so the Outstanding Balance column must stay zero here. It is
      // populated only for historical outstanding invoices / receipts below.
      group.displayBalance = 0;
      group.displayStatus = 'Unpaid';
      group.invoiceFee = null;
      group.pendingDue = pendingDue;
      if (pendingDue > 0.005) result.push(group);
    });

    // Students who only have non-payable-cycle charges are still listed as
    // "Not Due" (without Pay Now) so they don't disappear from the page.
    if (filter === 'ALL' || filter === 'UNPAID') {
      notDueByStudent.forEach((group) => {
        if ((group.totalAmount || 0) <= 0.005) return;
        const studentKey = getStudentKey(group.feesList[0]);
        if (pendingByStudent.has(studentKey)) return;
        result.push(group);
      });
    }

    // If a student has an outstanding balance, show that as an Unpaid row with Pay Now
    outstandingTotals.forEach((totals, studentKey) => {
      if ((totals?.remaining || 0) <= 0.005) return;

      const invoices = outstandingInvoicesByStudent.get(studentKey) || [];
      const firstInvoice = invoices[0];
      const studentObj = firstInvoice?.student || fees.find(f => getStudentKey(f) === studentKey)?.student;

      // Apply active filters
      if (filter === 'PAID') return;
      if (selectedStudent.value !== 'ALL' && studentKey !== selectedStudent.value) return;
      if (collegeFilter.value !== 'ALL') {
        const c = typeof studentObj?.college === 'string' ? studentObj.college : studentObj?.college?.name;
        if (c !== collegeFilter.value) return;
      }
      if (
        collegeCategoryFilter.value !== 'ALL' &&
        collegeCategoryOf(studentObj?.college) !== collegeCategoryFilter.value
      ) return;
      if (roomFilter.value !== 'ALL' && String(studentObj?.roomNo || '') !== roomFilter.value) return;
      if (
        billingMonthFilter.value !== 'ALL' &&
        !invoices.some((invoice: any) => resolveFeeBillingMonth(invoice) === billingMonthFilter.value)
      ) return;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matches = (
          (firstInvoice ? formatInvoiceNumber(firstInvoice).toLowerCase().includes(q) : false) ||
          (studentObj?.name || '').toLowerCase().includes(q) ||
          (studentObj?.manualRegsiName || studentObj?.regNo || '').toLowerCase().includes(q) ||
          (studentObj?.roomNo || '').toLowerCase().includes(q)
        );
        if (!matches) return;
      }

      // A part payment never settles the whole outstanding balance. Keep the
      // remaining amount in its own Unpaid row so it can be paid later. The
      // completed receipt row only shows what was actually paid this time.

      // The student may already have a current-month "Unpaid" row (or a
      // "Not Due" row). Merge the outstanding balance into that row instead of
      // rendering a second Unpaid row for the same student.
      const existingRow: any = result.find((row: any) =>
        row.isGrouped &&
        getStudentKey(row) === studentKey &&
        (row.displayStatus === 'Unpaid' || row.displayStatus === 'Not Due'),
      );
      if (existingRow) {
        const extra = roundMoney(totals.remaining);
        existingRow.totalAmount = roundMoney((existingRow.totalAmount || 0) + extra);
        existingRow.outstanding = roundMoney((existingRow.outstanding || 0) + extra);
        existingRow.displayBalance = roundMoney((existingRow.displayBalance || 0) + extra);
        existingRow.pendingDue = roundMoney((existingRow.pendingDue || 0) + extra);
        existingRow.feesList = [...(existingRow.feesList || []), ...invoices];
        existingRow.displayStatus = 'Unpaid';
        return;
      }

      result.push({
        isGrouped: true,
        id: `outstanding-unpaid-${studentKey}`,
        student: studentObj,
        status: 'PENDING',
        createdAt: firstInvoice?.createdAt || new Date(),
        paidDate: null,
        paymentMode: '-',
        totalAmount: totals.remaining,
        outstanding: totals.remaining,
        displayPaid: 0,
        displayBalance: totals.remaining,
        displayStatus: 'Unpaid',
        invoiceFee: null,
        invoiceNumber: '—',
        rent: 0, eb: 0, mess: 0, fine: 0, advance: 0, other: 0,
        feesList: invoices,
      });
    });

    paidByBatch.forEach((group: any) => {
      // Do not display previous paid receipts prior to November 1, 2026
      const isPreNov = new Date(group.paidDate || group.createdAt) < new Date('2026-11-01T00:00:00');
      if (isPreNov) return;

      const studentKey = getStudentKey(group.feesList[0]);
      const totals = outstandingTotals.get(studentKey);
      const hasOutstandingPayment = group.feesList.some(isOutstandingPayment);
      if (hasOutstandingPayment) {
        const currentOutstandingPayment = group.feesList.find((item: any) => isOutstandingPayment(item)) || group.feesList[0];
        const remaining = roundMoney(totals?.remaining || 0);
        const hasCurrentItems = group.feesList.some(
          (item: any) => !isOutstandingPayment(item) && !isOutstandingDescription(item),
        );
        // Money actually collected towards the outstanding balance in this
        // receipt (not the balance left over). This is what the Outstanding
        // Balance column shows on a completed row, so the columns add up to
        // Total Paid. The remaining dues get their own Pay Now row above.
        group.paidOutstanding = roundMoney(
          group.feesList
            .filter(isOutstandingPayment)
            .reduce((sum: number, item: any) => sum + (Number(item.amount) || 0), 0),
        );

        // One receipt: show the whole amount paid in this submission, not just
        // the outstanding-payment row.
        const usedOutstandingCredit = roundMoney(
          group.feesList.reduce((sum: number, item: any) => {
            if (!isOutstandingPayment(item)) return sum;
            const m = String(item?.description || '').match(/Advance Rent Applied:\s*([0-9.,]+)/i);
            return sum + (m ? Number(m[1].replace(/,/g, '')) || 0 : 0);
          }, 0),
        );
        group.displayPaid = roundMoney(Math.max(0, group.totalAmount - usedOutstandingCredit));
        group.displayBalance = remaining;
        // A combined current + outstanding payment is a completed receipt.
        // Only standalone outstanding payments can be Partial.
        group.displayStatus = remaining > 0.005 && !hasCurrentItems ? 'Partial' : 'Paid';
        group.invoiceFee =
          group.feesList.find((item: any) => !isOutstandingPayment(item)) || currentOutstandingPayment;
        group.invoiceNumber = formatInvoiceNumber(group.invoiceFee);
      } else {
        group.displayPaid = group.totalAmount;
        group.displayBalance = 0;
        group.displayStatus = 'Paid';
        group.invoiceFee = group.feesList[0];
        group.invoiceNumber = formatInvoiceNumber(group.feesList[0]);
      }
      result.push(group);
    });

    // Keep the table in a single newest-first transaction timeline. Outstanding
    // balances above are still calculated in chronological payment order.
    result.sort((a, b) => {
      const aTime = new Date(a.paidDate || a.createdAt).getTime();
      const bTime = new Date(b.paidDate || b.createdAt).getTime();
      return bTime - aTime || String(b.id).localeCompare(String(a.id));
    });

    return result;
  }, [filteredFees, outstandingTotals, outstandingInvoicesByStudent, billingMonthFilter, collegeCategoryFilter]);

  // Single ledger for all three cards and the reconciliation breakdown. It is
  // built from transactions (not grouped display rows) so every invoice amount
  // is categorised exactly once.
  const reconciliation = useMemo(
    () => buildFeeReconciliation({ allFees: fees, filteredFees }),
    [fees, filteredFees],
  );

  const totalInvoiced = reconciliation.totalInvoiced;
  const totalCollected = reconciliation.totalCollected;
  const pendingFeesAmt = reconciliation.pendingUnpaid;

  const modalOutstandingPaid = useMemo(() => {
    const first = feesToCollect[0] || feeToCollect;
    if (!first) return 0;
    return outstandingTotals.get(getStudentKey(first))?.paid || 0;
  }, [feesToCollect, feeToCollect, outstandingTotals]);

  // On a receipt, the Outstanding Balance column shows the outstanding amount
  // collected in that payment (so Rent/EB/Fine + Outstanding = Total Paid).
  // On an unpaid row it shows the balance still owed, which is also what the
  // Pay Now modal picks up. `displayBalance` stays as the remaining dues for
  // pending-balance messages/reports.
  const getOutstandingColumnValue = (fee: any) =>
    roundMoney(
      fee.status === 'COMPLETED'
        ? (fee.paidOutstanding || 0)
        : (fee.displayBalance || 0),
    );

  const openOutstandingModal = (fee: any) => {
    const studentKey = getStudentKey(fee);
    const studentFees = fees.filter((f) => getStudentKey(f) === studentKey);
    const summary = buildOutstandingSummary(studentFees);
    const billingCycle = fee.student?.college?.billingCycle;
    const currentPendingItems = studentFees.filter((item) =>
      isCurrentCycleFee(item, billingCycle),
    );
    const currentPendingAmount = roundMoney(
      currentPendingItems.reduce((sum: number, item: any) => sum + (Number(item.amount) || 0), 0),
    );
    const outstandingRemaining = summary.remaining;
    const pendingFeesAmount = roundMoney(currentPendingAmount + outstandingRemaining);
    const regNo = fee.student?.manualRegsiName || fee.student?.regNo || 'N/A';

    setOutstandingModalData({
      fee,
      studentId: regNo,
      studentName: fee.student?.name || 'Unknown',
      roomNo: fee.student?.roomNo || 'N/A',
      currentPendingItems,
      currentPendingAmount,
      outstandingRemaining,
      pendingFeesAmount,
    });
  };

  const paginatedFees = useMemo(() => {
    return displayFees.slice((page - 1) * limit, page * limit);
  }, [displayFees, page, limit]);

  const totalPages = Math.ceil(displayFees.length / limit);

  const hasFilters =
    selectedStudent.value !== 'ALL' ||
    collegeFilter.value !== 'ALL' ||
    collegeCategoryFilter.value !== 'ALL' ||
    roomFilter.value !== 'ALL' ||
    billingMonthFilter.value !== 'ALL' ||
    filter !== 'ALL' ||
    fromDate !== '' ||
    toDate !== '' ||
    searchQuery !== '';

  const clearFilters = () => {
    setSelectedStudent({ value: 'ALL', label: '-- All Students --' });
    setCollegeFilter({ value: 'ALL', label: '-- All Colleges --' });
    setCollegeCategoryFilter({ value: 'ALL', label: '-- All Categories --' });
    setRoomFilter({ value: 'ALL', label: '-- All Rooms --' });
    setBillingMonthFilter({ value: 'ALL', label: '-- All Billing Months --' });
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

  const getExportFeeType = (fee: any) => {
    if (fee.displayStatus === 'Not Due') {
      return 'Not Due';
    }
    if (fee.displayStatus === 'Paid' || fee.displayStatus === 'Partial') {
      return 'Receipt';
    }
    return Number(fee.displayBalance || 0) > 0 ? 'Outstanding' : 'Current Due';
  };

  const handleExportExcel = () => {
    const data = displayFees.map(fee => ({
      'Receipt No': fee.displayStatus !== 'Unpaid' ? (fee.invoiceNumber || (fee.invoiceFee ? formatInvoiceNumber(fee.invoiceFee) : '—')) : '—',
      'Student ID': fee.student?.manualRegsiName || fee.student?.regNo || 'N/A',
      'Student Name': fee.student?.name || 'Unknown',
      'Room': `Room ${fee.student?.roomNo || 'N/A'}`,
      'Payment Date': fee.displayStatus !== 'Unpaid' ? new Date(fee.paidDate || fee.createdAt).toLocaleDateString('en-GB') : '—',
      'Advance': fee.advance || 0,
      'Rent': fee.rent || 0,
      'EB': fee.eb || 0,
      // 'Mess': fee.mess || 0,
      'Fine': fee.fine || 0,
      'Outstanding Balance': getOutstandingColumnValue(fee),
      'Total Paid': fee.displayPaid || 0,
      'Payment Method': fee.displayStatus !== 'Unpaid' ? (fee.paymentMode || '-') : '—',
      'Status': fee.displayStatus,
      'Fee Type': getExportFeeType(fee),
    }));

    // Calculate totals (keep the same keys/order as the data rows so the
    // sheet stays aligned for re-import).
    const totalRow = {
      'Receipt No': 'TOTAL',
      'Student ID': '',
      'Student Name': '',
      'Room': '',
      'Payment Date': '',
      'Advance': displayFees.reduce((sum, f) => sum + (f.advance || 0), 0),
      'Rent': displayFees.reduce((sum, f) => sum + (f.rent || 0), 0),
      'EB': displayFees.reduce((sum, f) => sum + (f.eb || 0), 0),
      // 'Mess': displayFees.reduce((sum, f) => sum + (f.mess || 0), 0),
      'Fine': displayFees.reduce((sum, f) => sum + (f.fine || 0), 0),
      'Outstanding Balance': displayFees
        .filter(f => f.displayStatus === 'Unpaid')
        .reduce((sum, f) => sum + (f.displayBalance || 0), 0),
      'Total Paid': displayFees.reduce((sum, f) => sum + (f.displayPaid || 0), 0),
      'Payment Method': '',
      'Status': '',
      'Fee Type': ''
    };

    data.push(totalRow as any);

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Fees");
    XLSX.writeFile(workbook, "Fees_Report.xlsx");
  };

  const handleDownloadOutstandingTemplate = () => {
    const uniqueStudents = new Map<string, any>();
    fees.forEach(f => {
      if (f.student && !uniqueStudents.has(f.student.id)) {
        uniqueStudents.set(f.student.id, f.student);
      }
    });

    const rows = Array.from(uniqueStudents.values())
      .filter((s: any) => s.status !== 'Vacated')
      .sort((a: any, b: any) => (a.roomNo || '').localeCompare(b.roomNo || '', undefined, { numeric: true }))
      .map(s => ({
        'Reg No': s.manualRegsiName || s.regNo || '',
        'Student Name': s.name || '',
        'Room No': s.roomNo || '',
        'Mobile No': s.mobileNo || '',
        'College': typeof s.college === 'string' ? s.college : s.college?.name || '',
        'Outstanding Balance': '',
      }));

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Outstanding_Template");
    XLSX.writeFile(workbook, "Student_Outstanding_Import_Template.xlsx");
    toast.success("Downloaded Outstanding Template. Enter amounts in 'Outstanding Balance' column and upload via Import Excel.");
  };

  const handleDownloadAdvanceRentTemplate = () => {
    const uniqueStudents = new Map<string, any>();
    fees.forEach(f => {
      if (f.student && !uniqueStudents.has(f.student.id)) {
        uniqueStudents.set(f.student.id, f.student);
      }
    });

    const rows = Array.from(uniqueStudents.values())
      .filter((s: any) => s.status !== 'Vacated')
      .sort((a: any, b: any) => (a.roomNo || '').localeCompare(b.roomNo || '', undefined, { numeric: true }))
      .map(s => ({
        'Reg No': s.manualRegsiName || s.regNo || '',
        'Student Name': s.name || '',
        'Room No': s.roomNo || '',
        'Mobile No': s.mobileNo || '',
        'College': typeof s.college === 'string' ? s.college : s.college?.name || '',
        'Current Advance Rent': Number(s.advanceRentBalance || 0),
        'Advance Rent Amount': '',
      }));

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Advance_Rent_Template");
    XLSX.writeFile(workbook, "Student_Advance_Rent_Import_Template.xlsx");
    toast.success("Downloaded Advance Rent Template. Enter amounts in 'Advance Rent Amount' column and upload via Import Excel.");
  };

  const handleImportClick = () => {
    importInputRef.current?.click();
  };

  const handleImportFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    setImportBusy(true);
    try {
      const parsed = await parseFeeImportFile(file);
      if (parsed.errors.length > 0) {
        toast.warning(parsed.errors.slice(0, 2).join(' '));
      }
      if (parsed.rows.length === 0) {
        toast.error('No editable fee rows were found in that file. Use the exported file and edit Rent / EB / Fine / Advance / Outstanding Balance.');
        return;
      }

      const preview = await FeesAPI.importEdits(parsed.rows, true);
      const changeCount = preview.changes?.length || 0;
      const errorCount = preview.errors?.length || 0;

      if (changeCount === 0 && errorCount === 0) {
        toast.info('No changes found — the Excel values already match the current fees.');
        return;
      }

      setImportRows(parsed.rows);
      setImportPreview({ ...preview, parse: parsed });
    } catch (err: any) {
      toast.error(err?.message || 'Failed to read the Excel file.');
    } finally {
      setImportBusy(false);
    }
  };

  const closeImportPreview = () => {
    if (importBusy) return;
    setImportRows(null);
    setImportPreview(null);
  };

  const handleApplyImport = async () => {
    if (!importRows) return;

    setImportBusy(true);
    try {
      const result = await FeesAPI.importEdits(importRows, false);
      const updated = Number(result.updated) || 0;
      const skipped = result.errors?.length || 0;

      if (updated > 0) {
        toast.success(`Fees updated for ${updated} student${updated === 1 ? '' : 's'}${skipped ? ` (${skipped} skipped)` : ''}.`);
      } else if (skipped > 0) {
        toast.error('No fees were updated. Please check the skipped rows.');
      } else {
        toast.info('No changes were applied.');
      }

      if (skipped > 0) {
        const firstError = result.errors?.[0];
        const detail = firstError
          ? `${firstError.studentKey ? `${firstError.studentKey}: ` : ''}${firstError.message}`
          : '';
        toast.warning(`Skipped ${skipped} row${skipped === 1 ? '' : 's'}${detail ? ` — ${detail}` : ''}.`);
        console.warn('Fee import skipped rows', result.errors);
      }

      // Refresh first so the result download can include the live, updated
      // fee list for the students that changed.
      const freshFees = await fetchFees();

      if (updated > 0) {
        // Keep a summary of this import open so the admin can see exactly
        // whose fees changed and download the before/after Excel.
        setImportResult({ ...result, freshFees });
        setImportRows(null);
        setImportPreview(null);
      } else if (skipped === 0) {
        setImportRows(null);
        setImportPreview(null);
      }
    } catch (err: any) {
      toast.error(err?.message || 'Failed to import fees.');
    } finally {
      setImportBusy(false);
    }
  };

  const closeImportResult = () => {
    setImportResult(null);
  };

  const handleDownloadUpdatedExcel = () => {
    const changes = importResult?.changes || [];
    if (changes.length === 0) return;

    const categories = [
      { key: 'advance', label: 'Advance' },
      { key: 'rent', label: 'Rent' },
      { key: 'eb', label: 'EB' },
      { key: 'fine', label: 'Fine' },
    ];

    const summaryRows = changes.map((change: any) => {
      const itemsByCategory = new Map(
        (change.items || []).map((item: any) => [item.category, item]),
      );
      const row: Record<string, any> = {
        'Student ID': change.studentKey,
        'Student Name': change.studentName,
        'Room': change.roomNo ? `Room ${change.roomNo}` : '',
      };

      categories.forEach(category => {
        const item: any = itemsByCategory.get(category.key);
        row[`${category.label} Before`] = item ? item.from : '';
        row[`${category.label} After`] = item ? item.to : '';
      });

      const totalBefore = (change.items || []).reduce(
        (sum: number, item: any) => sum + Number(item.from || 0),
        0,
      );
      const totalAfter = (change.items || []).reduce(
        (sum: number, item: any) => sum + Number(item.to || 0),
        0,
      );
      row['Total Before'] = roundMoney(totalBefore);
      row['Total After'] = roundMoney(totalAfter);
      row['Difference'] = roundMoney(totalAfter - totalBefore);
      return row;
    });

    const detailRows: any[] = [];
    changes.forEach((change: any) => {
      (change.items || []).forEach((item: any) => {
        detailRows.push({
          'Student ID': change.studentKey,
          'Student Name': change.studentName,
          'Room': change.roomNo ? `Room ${change.roomNo}` : '',
          'Fee': item.label,
          'Before': item.from,
          'After': item.to,
          'Difference': item.delta,
        });
      });
    });

    // Current live fee list for only the students that were updated. This is
    // the same "updated student" view the Fees page shows after the refresh.
    const freshFees = importResult?.freshFees || [];
    const updatedIds = new Set(changes.map((change: any) => String(change.studentId)));
    const feeListByStudent = new Map<string, any>();
    changes.forEach((change: any) => {
      feeListByStudent.set(String(change.studentId), {
        'Student ID': change.studentKey,
        'Student Name': change.studentName,
        'Room': change.roomNo ? `Room ${change.roomNo}` : '',
        'Advance': 0,
        'Rent': 0,
        'EB': 0,
        'Fine': 0,
        'Other': 0,
      });
    });

    const { previousMonthStr } = getBillingMonths();
    freshFees.forEach((fee: any) => {
      if (!fee?.studentId || !updatedIds.has(String(fee.studentId))) return;
      if (fee.status !== 'PENDING') return;
      const collegeCycle = fee.student?.college?.billingCycle || 'PREPAID';
      const isPostpaidPayableNow =
        collegeCycle === 'POSTPAID' && isPostpaidPayableFee(fee, previousMonthStr);
      if (
        isOutstandingInvoice(fee) ||
        (isImportedInvoice(fee) && !isPostpaidPayableNow) ||
        (isPreviousSettledFee(fee) && !isPostpaidPayableNow) ||
        isMessFee(fee)
      ) {
        return;
      }

      const row = feeListByStudent.get(String(fee.studentId));
      if (!row) return;

      const amount = Number(fee.amount) || 0;
      const type = String(fee.transactionType || '').toUpperCase();
      if (type.includes('RENT')) row.Rent += amount;
      else if (type.includes('EB') || type.includes('ELECTRIC')) row.EB += amount;
      else if (type.includes('FINE')) row.Fine += amount;
      else if (type.includes('ADVANCE')) row.Advance += amount;
      else row.Other += amount;
    });

    const feeListRows = Array.from(feeListByStudent.values()).map((row: any) => ({
      ...row,
      'Advance': roundMoney(row.Advance),
      'Rent': roundMoney(row.Rent),
      'EB': roundMoney(row.EB),
      'Fine': roundMoney(row.Fine),
      'Other': roundMoney(row.Other),
      'Total Due': roundMoney(
        row.Advance + row.Rent + row.EB + row.Fine + row.Other,
      ),
    }));

    const workbook = XLSX.utils.book_new();
    if (freshFees.length > 0) {
      XLSX.utils.book_append_sheet(
        workbook,
        XLSX.utils.json_to_sheet(feeListRows),
        'Updated Fee List',
      );
    }
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.json_to_sheet(summaryRows),
      'Before vs After',
    );
    if (detailRows.length > 0) {
      XLSX.utils.book_append_sheet(
        workbook,
        XLSX.utils.json_to_sheet(detailRows),
        'All Changes',
      );
    }
    XLSX.writeFile(
      workbook,
      `Updated_Fees_${new Date().toISOString().slice(0, 10)}.xlsx`,
    );
  };

  const importTotalChanges = importPreview?.changes?.reduce(
    (sum: number, change: any) => sum + (change.items?.length || 0),
    0,
  ) || 0;

  return (
    <div className="ui-page fees-page">
      <PageHeader
        title="Fees Paid / Unpaid"
        subtitle="Track hostel fee invoices, pending dues, and issue payment receipts"
        icon={<Wallet size={24} color="#fff" />} iconBg="linear-gradient(135deg, #22c55e 0%, #16a34a 100%)"
        rightContent={
          <div className="fees-header-actions">
            <input
              ref={importInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              style={{ display: 'none' }}
              onChange={handleImportFile}
            />
            <button
              onClick={handleImportClick}
              className="ui-btn ui-btn-primary fees-action-btn"
              disabled={importBusy}
              title="Upload the client Excel sheet for bulk student outstanding balances or fee updates"
            >
              <Upload size={14} /> {importBusy ? 'Reading…' : 'Import Excel'}
            </button>
            <button
              onClick={handleDownloadOutstandingTemplate}
              className="ui-btn ui-btn-secondary fees-action-btn"
              title="Download Excel template for bulk importing student outstanding balances"
            >
              <Download size={14} /> Outstanding Template
            </button>
            <button
              onClick={handleDownloadAdvanceRentTemplate}
              className="ui-btn ui-btn-secondary fees-action-btn"
              title="Download Excel template for bulk importing student advance rent credit"
            >
              <Download size={14} /> Advance Rent Template
            </button>
            <button onClick={handleExportExcel} className="ui-btn ui-btn-success fees-action-btn">
              <FileSpreadsheet size={14} /> Export Excel
            </button>
            <button
              onClick={() => setShowRoomPdfModal(true)}
              className="ui-btn ui-btn-primary fees-action-btn"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                background: 'linear-gradient(135deg, #4f46e5 0%, #3730a3 100%)',
                borderColor: '#4338ca',
                color: '#fff',
              }}
              title="Download Block & Room-wise Fees Report PDF (referencing printed sheet)"
            >
              <FileText size={14} /> Room Fees PDF
            </button>
          </div>
        }
      />

      <div className="ui-stat-grid fees-stats">
        <div className="ui-card ui-stat">
          <div className="ui-stat-icon ui-stat-icon--indigo">
            <FileText size={24} />
          </div>
          <div>
            <div className="ui-stat-label">Total Invoiced</div>
            <div className="ui-stat-value">{formatMoney(totalInvoiced)}</div>
            <div className="ui-stat-sub">All in-scope invoices, paid and unpaid</div>
          </div>
        </div>
        <div className="ui-card ui-stat">
          <div className="ui-stat-icon ui-stat-icon--green">
            <IndianRupee size={24} />
          </div>
          <div>
            <div className="ui-stat-label">Total Fees Collected</div>
            <div className="ui-stat-value">{formatMoney(totalCollected)}</div>
            <div className="ui-stat-sub">Full payments + outstanding receipts</div>
          </div>
        </div>
        <div className="ui-card ui-stat">
          <div className="ui-stat-icon ui-stat-icon--red">
            <IndianRupee size={24} />
          </div>
          <div>
            <div className="ui-stat-label">Pending Unpaid Fees</div>
            <div className="ui-stat-value">{formatMoney(pendingFeesAmt)}</div>
            <div className="ui-stat-sub">Remaining balance payable now</div>
          </div>
        </div>
      </div>

      <FeeGenerationNotice billingCycle={selectedBillingCycle} />

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
          options={collegeCategoryOptions}
          value={collegeCategoryFilter}
          onChange={(val) => { setCollegeCategoryFilter(val || { value: 'ALL', label: '-- All Categories --' }); setPage(1); }}
          styles={selectStyles}
          placeholder="College Category"
          isSearchable={false}
        />

        <Select
          options={roomOptions}
          value={roomFilter}
          onChange={(val) => { setRoomFilter(val || { value: 'ALL', label: '-- All Rooms --' }); setPage(1); }}
          styles={selectStyles}
          placeholder="Search room..."
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
          options={billingMonthOptions}
          value={billingMonthFilter}
          onChange={(val) => { setBillingMonthFilter(val || { value: 'ALL', label: '-- All Billing Months --' }); setPage(1); }}
          styles={selectStyles}
          placeholder="Billing month..."
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
        {isDeveloper && (
          <button
            className={showTrash ? 'ui-btn ui-btn-secondary ui-btn-sm' : 'ui-btn ui-btn-soft ui-btn-sm'}
            onClick={() => {
              const next = !showTrash;
              setShowTrash(next);
              if (next) void fetchTrash();
            }}
          >
            {showTrash ? <RotateCcw size={14} /> : <Trash2 size={14} />}
            {showTrash ? 'Back to Fees' : `Trash (${trashGroups.length})`}
          </button>
        )}
      </div>

      {isDeveloper && showTrash && (
        <div className="ui-table-wrap fees-trash-wrap">
          <div className="ui-table-scroll">
            <table className="ui-table fees-trash-table">
              <thead className="fees-trash-head">
                <tr>
                  <th>Invoice No(s)</th>
                  <th>Student Name &amp; Reg. No</th>
                  <th>Fee Types</th>
                  <th>Billing Month(s)</th>
                  <th className="num">Total Amount</th>
                  <th>Status(es)</th>
                  <th>Moved to Trash</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {trashLoading ? (
                  <LoadingRow colSpan={8} />
                ) : trashGroups.length === 0 ? (
                  <tr><td colSpan={8} className="ui-empty">Trash is empty.</td></tr>
                ) : trashGroups.map((fee: any) => (
                  <tr key={fee.id} className="fees-trash-row">
                    <td>{fee.invoiceNumbers.length ? fee.invoiceNumbers.join(', ') : '—'}</td>
                    <td>
                      <div>{fee.student?.name || 'Unknown'}</div>
                      <div className="fees-person-meta">{fee.student?.manualRegsiName || fee.student?.regNo || '—'}</div>
                    </td>
                    <td>
                      <div className="fees-trash-tags">
                        {fee.feeTypes.map((type: string) => (
                          <span
                            className={`fees-trash-type ${(() => {
                              const normalized = type.toUpperCase();
                              if (normalized.includes('RENT')) return 'is-rent';
                              if (normalized.includes('EB') || normalized.includes('ELECTRIC')) return 'is-eb';
                              if (normalized.includes('FINE')) return 'is-fine';
                              if (normalized.includes('MESS')) return 'is-mess';
                              if (normalized.includes('ADVANCE')) return 'is-advance';
                              if (normalized.includes('OUTSTANDING')) return 'is-outstanding';
                              return 'is-other';
                            })()}`}
                            key={type}
                          >
                            {type.replaceAll('_', ' ')}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td>{fee.billingMonths.map((month: string) => formatBillingMonth(month) || month).join(', ') || '—'}</td>
                    <td className="num">{formatMoney(fee.totalAmount)}</td>
                    <td>
                      <div className="fees-trash-tags">
                        {fee.statuses.map((status: string) => (
                          <span
                            className={`fees-trash-status ${status === 'COMPLETED' ? 'is-paid' : status === 'PENDING' ? 'is-pending' : ''}`}
                            key={status}
                          >
                            {status}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td>{fee.deletedAt ? new Date(fee.deletedAt).toLocaleString('en-GB') : '—'}</td>
                    <td>
                      <button
                        className="ui-btn ui-btn-success ui-btn-sm fees-trash-restore"
                        onClick={() => void restoreFeeFromTrash(fee)}
                        title={`Restore all ${fee.feesList.length} trashed fee transactions for this student`}
                      >
                        <RotateCcw size={14} /> Restore all ({fee.feesList.length})
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!(isDeveloper && showTrash) && <div className="ui-table-wrap">
        <div className="ui-table-scroll">
          <table className="ui-table fees-table">
            <colgroup>
              <col className="fees-col-invoice" />
              <col className="fees-col-person" />
              <col className="fees-col-room" />
              <col className="fees-col-billing" />
              <col className="fees-col-date" />
              <col className="fees-col-advance" />
              <col className="fees-col-rent" />
              <col className="fees-col-eb" />
              {/* <col className="fees-col-mess" /> */}
              <col className="fees-col-fine" />
              <col className="fees-col-outstanding" />
              <col className="fees-col-advance-rent" />
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
                <th>Billing Month</th>
                <th>Payment Date</th>
                <th className="num">Advance</th>
                <th className="num">Rent</th>
                <th className="num">EB</th>
                {/* <th className="num">Mess</th> */}
                <th className="num">Fine</th>
                <th className="num fees-th-outstanding" style={{ whiteSpace: 'normal', lineHeight: 1.25 }}>
                  Outstanding<br />Balance
                </th>
                <th className="num fees-th-advance-rent" style={{ whiteSpace: 'normal', lineHeight: 1.25 }}>
                  Advance<br />Rent
                </th>
                <th className="num fees-total">Total Paid</th>
                <th className="fees-method">Payment Method</th>
                <th className="fees-status">Status</th>
                <th className="num">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && fees.length === 0 ? (
                <LoadingRow colSpan={15} />
              ) : error ? (
                <tr>
                  <td colSpan={15} className="ui-empty ui-empty-danger">{error}</td>
                </tr>
              ) : paginatedFees.length === 0 ? (
                <tr>
                  <td colSpan={15} className="ui-empty">No fee transactions found.</td>
                </tr>
              ) : (
                paginatedFees.map((fee: any) => {
                  const regNo = fee.student?.manualRegsiName || fee.student?.regNo || 'N/A';
                  const studentName = fee.student?.name || 'Unknown';
                  const isWarden = isWardenStudent(fee.student);
                  const outstandingColumnValue = getOutstandingColumnValue(fee);
                  return (
                    <tr
                      key={fee.id}
                      className={[activeFeeId === fee.id ? 'fees-row-active' : '', isWarden ? 'fees-row-warden' : ''].filter(Boolean).join(' ') || undefined}
                    >
                      <td
                        className={fee.displayStatus !== 'Unpaid' ? "ui-cell-link fees-invoice" : "fees-invoice"}
                        title={fee.displayStatus !== 'Unpaid' ? (fee.invoiceNumber || (fee.invoiceFee ? formatInvoiceNumber(fee.invoiceFee) : undefined)) : undefined}
                      >
                        {fee.displayStatus !== 'Unpaid' ? (fee.invoiceNumber || (fee.invoiceFee ? formatInvoiceNumber(fee.invoiceFee) : '—')) : '—'}
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
                        <span className="ui-badge ui-badge-blue" title={fee.student?.roomNo || 'N/A'}>
                          {fee.student?.roomNo ? String(fee.student.roomNo).replace(/^Room\s*/i, '') : '—'}
                        </span>
                      </td>
                      <td>
                        <span
                          title={(() => {
                            const billingCycle = (fee.student?.college?.billingCycle || 'PREPAID').toUpperCase();
                            if (fee.displayStatus === 'Unpaid' || fee.displayStatus === 'Not Due') {
                              const { currentMonthStr, previousMonthStr } = getBillingMonths();
                              const payableMonth = billingCycle === 'POSTPAID' ? previousMonthStr : currentMonthStr;
                              return formatBillingMonth(payableMonth) || payableMonth;
                            }
                            const primaryFee = fee.feesList?.[0] || fee;
                            const primaryMonth = resolveFeeBillingMonth(primaryFee) || fee.billingMonth || '';
                            return formatBillingMonth(primaryMonth) || primaryMonth || undefined;
                          })()}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '2px 6px',
                            borderRadius: '12px',
                            fontSize: '11px',
                            fontWeight: 600,
                            textTransform: 'uppercase',
                            backgroundColor: '#e0f2fe',
                            color: '#0369a1',
                            border: '1px solid #bae6fd',
                          }}
                        >
                          {(() => {
                            // POSTPAID dues are paid for the previous month, so
                            // show that payable month on the unpaid/not-due row.
                            const billingCycle =
                              (fee.student?.college?.billingCycle || 'PREPAID').toUpperCase();
                            if (fee.displayStatus === 'Unpaid' || fee.displayStatus === 'Not Due') {
                              // Show the month the current cycle actually bills:
                              // PREPAID -> current month, POSTPAID -> previous month.
                              const { currentMonthStr, previousMonthStr } = getBillingMonths();
                              const payableMonth =
                                billingCycle === 'POSTPAID' ? previousMonthStr : currentMonthStr;
                              return formatBillingMonthOnly(payableMonth) || payableMonth;
                            }
                            // One receipt = one payment. Show the billing month
                            // of its primary fee only. Joining every month in a
                            // group produced labels like "October 2026 / November
                            // 2026" when two separate payments were merged.
                            const primaryFee = fee.feesList?.[0] || fee;
                            const primaryMonth =
                              resolveFeeBillingMonth(primaryFee) ||
                              fee.billingMonth ||
                              '';
                            return formatBillingMonthOnly(primaryMonth) || primaryMonth || '—';
                          })()}
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
                      {/*
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
                      */}
                      <td className="num">
                        <div>₹{fee.fine.toLocaleString('en-IN')}</div>
                        {(() => {
                          if (Number(fee.fine) <= 0) return null;
                          const fineFee =
                            fee.feesList?.find(
                              (item: any) =>
                                (item.transactionType || '').toUpperCase() === 'FINE' &&
                                Number(item.amount || 0) > 0,
                            ) ||
                            fee.feesList?.find(
                              (item: any) => (item.transactionType || '').toUpperCase() === 'FINE',
                            );

                          // Fine Master holds a day of month. Derive the
                          // overdue count from that day in the fee's own
                          // billing month instead of stale fine-row text.
                          const college: any = fee.student?.college;
                          const collegeDueDate = college && typeof college === 'object' ? college.dueDate : null;
                          let overdueDays: number | null = getOverdueDays(collegeDueDate, {
                            billingMonth: fee.billingMonth,
                            feeDueDate: fee.dueDate,
                            billingCycle: college?.billingCycle,
                          });
                          if (overdueDays === null) {
                            const storedDays = fineFee?.description?.match(/(\d+)\s+days?\s+overdue/i)?.[1];
                            overdueDays = storedDays ? Number(storedDays) : null;
                          }
                          return overdueDays
                            ? <div className="fees-note fees-note--danger">{overdueDays} day{Number(overdueDays) === 1 ? '' : 's'} overdue</div>
                            : null;
                        })()}
                      </td>

                      <td className={`num fees-outstanding${outstandingColumnValue > 0 && fee.status !== 'COMPLETED' ? ' fees-outstanding--due' : ' fees-outstanding--clear'}`}>
                        <button
                          type="button"
                          onClick={() => openOutstandingModal(fee)}
                          className={`hostellers-outstanding-btn ${outstandingColumnValue > 0 && fee.status !== 'COMPLETED' ? 'is-due' : ''}`}
                          title={`Outstanding: ₹${outstandingColumnValue.toLocaleString('en-IN')} (Click to view details)`}
                        >
                          <span>₹{outstandingColumnValue.toLocaleString('en-IN')}</span>
                          <Eye size={12} />
                        </button>
                      </td>

                      {(() => {
                        const isPaidRow = fee.status === 'COMPLETED';
                        const usedCredit = isPaidRow
                          ? roundMoney(
                            (fee.feesList || []).reduce((sum: number, item: any) => {
                              const m = String(item?.description || '').match(/Advance Rent Applied:\s*([0-9.,]+)/i);
                              return sum + (m ? Number(m[1].replace(/,/g, '')) || 0 : 0);
                            }, 0),
                          )
                          : 0;
                        const displayAdvanceRent = isPaidRow
                          ? roundMoney(Number(fee.advanceRent || 0))
                          : roundMoney(Number(fee.student?.advanceRentBalance || 0));
                        return (
                          <td
                            className="num"
                            style={{
                              fontWeight: displayAdvanceRent > 0 ? 700 : 500,
                              color: displayAdvanceRent > 0 ? '#0284c7' : '#64748b',
                            }}
                            title={
                              isPaidRow
                                ? 'Advance Rent collected in this receipt'
                                : 'Available Advance Rent Credit (can be applied in Pay Now or next month)'
                            }
                          >
                            <div>₹{displayAdvanceRent.toLocaleString('en-IN')}</div>
                            {isPaidRow && usedCredit > 0 && (
                              <div className="fees-note" style={{ color: '#0369a1', fontWeight: 600 }}>
                                Used: ₹{usedCredit.toLocaleString('en-IN')}
                              </div>
                            )}
                          </td>
                        );
                      })()}

                      <td className={`num fees-total${fee.displayStatus === 'Unpaid' ? ' fees-total--pending' : ''}`}>
                        ₹{Number(fee.displayPaid || 0).toLocaleString('en-IN')}
                      </td>

                      <td
                        className="fees-method"
                        title={
                          fee.status === 'COMPLETED'
                            ? [
                              fee.paymentMode,
                              fee.feesList?.find((item: any) => item.razorpayOrderId)?.razorpayOrderId &&
                              `Order: ${fee.feesList.find((item: any) => item.razorpayOrderId).razorpayOrderId}`,
                              fee.feesList?.find((item: any) => item.razorpayPaymentId)?.razorpayPaymentId &&
                              `Payment: ${fee.feesList.find((item: any) => item.razorpayPaymentId).razorpayPaymentId}`,
                              fee.feesList?.find((item: any) => item.paymentMethod)?.paymentMethod &&
                              `Gateway method: ${fee.feesList.find((item: any) => item.paymentMethod).paymentMethod}`,
                            ]
                              .filter(Boolean)
                              .join(' | ')
                            : undefined
                        }
                      >
                        {fee.status === 'COMPLETED' ? formatPaymentMode(fee.paymentMode) : '—'}
                      </td>
                      <td className="fees-status">
                        <span className={`ui-badge ${fee.displayStatus === 'Paid' ? 'ui-badge-green' : fee.displayStatus === 'Not Due' ? 'ui-badge-blue' : fee.displayStatus === 'Partial' ? 'ui-badge-warning' : 'ui-badge-red'}`}>
                          {fee.displayStatus}
                        </span>
                      </td>
                      <td className="fees-actions">
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '6px' }}>
                          {fee.displayStatus === 'Unpaid' ? (
                            <button
                              onClick={() => { setActiveFeeId(fee.id); setFeesToCollect(fee.feesList); }}
                              className="ui-btn ui-btn-primary ui-btn-sm"
                            >
                              <Wallet size={14} /> Pay Now
                            </button>
                          ) : fee.displayStatus === 'Not Due' ? (
                            <span className="fees-note" title="This month's fees are billed in the next postpaid cycle">
                              Not due yet
                            </span>
                          ) : (
                            <>
                              <button
                                onClick={() => { setActiveFeeId(fee.id); setSelectedReceipt(fee); }}
                                className="ui-btn ui-btn-secondary ui-btn-sm"
                              >
                                View Receipt
                              </button>
                              <button
                                onClick={() => {
                                  const student = fee.student;
                                  const feesList = Array.isArray(fee.feesList) && fee.feesList.length > 0 ? fee.feesList : [fee];
                                  const totalAmount = Number(fee.displayPaid ?? fee.totalAmount ?? fee.amount ?? 0);
                                  const invoiceNo = fee.invoiceNumber || (fee.invoiceFee ? formatInvoiceNumber(fee.invoiceFee) : undefined);
                                  const items = feesList.map((f: any) => ({
                                    description: f.type ? f.type.replace(/_/g, ' ') : 'Fee',
                                    type: f.type || 'FEE',
                                    amount: Number(f.amount || 0),
                                  }));
                                  const refNo = fee.razorpayPaymentId || fee.refNo || feesList.find((f: any) => f.razorpayPaymentId)?.razorpayPaymentId;
                                  const billingMonth = resolveFeeBillingMonth(feesList[0] || fee);

                                  void sendReceiptViaWhatsApp({
                                    studentName: student?.name,
                                    regNo: student?.manualRegsiName || student?.regNo,
                                    roomNo: student?.roomNo || student?.room?.roomNumber,
                                    phone: student?.mobileNo || student?.fatherMobileNo || student?.guardianMobileNo,
                                    invoiceNo,
                                    receiptDate: fee.paidDate ? new Date(fee.paidDate).toLocaleDateString('en-GB') : undefined,
                                    totalAmount,
                                    paymentMode: fee.paymentMode || feesList[0]?.paymentMode || 'CASH',
                                    refNo,
                                    billingMonth: billingMonth || undefined,
                                    pendingBalance: Number(fee.displayBalance || 0),
                                    items,
                                  });
                                }}
                                className="ui-btn ui-btn-sm"
                                style={{ background: '#25D366', color: 'white', border: 'none', padding: '6px 8px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                                title="Send official PDF Receipt on WhatsApp"
                              >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                                  <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z" />
                                </svg>
                              </button>
                            </>
                          )}
                          {isDeveloper && (
                            <button
                              className="ui-btn ui-btn-icon ui-btn-danger"
                              title="Move fee record to Trash"
                              aria-label={`Move fee records for ${fee.student?.name || 'student'} to Trash`}
                              onClick={() => void moveFeeToTrash(fee)}
                            >
                              <Trash2 size={15} />
                            </button>
                          )}
                        </div>
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

      </div>}

      {/* Import Preview Modal */}
      {importPreview && (
        <div className="ui-modal-overlay">
          <div className="ui-modal ui-modal-lg">
            <div className="ui-modal-head">
              <div>
                <div className="ui-modal-title">Import Fees from Excel</div>
                <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#64748b' }}>
                  {importTotalChanges} change{importTotalChanges === 1 ? '' : 's'} across{' '}
                  {(importPreview.changes || []).length} student
                  {(importPreview.changes || []).length === 1 ? '' : 's'}
                </p>
              </div>
              <button className="ui-modal-close" onClick={closeImportPreview} disabled={importBusy}>
                <X size={18} />
              </button>
            </div>

            <div className="ui-modal-body">
              <div className="ui-alert ui-alert-info">
                Only current unpaid dues can be edited. Leave a cell blank to keep
                it unchanged, or enter 0 to clear that fee. Paid receipts, historical
                outstanding balances and the read-only columns stay unchanged.
              </div>

              {importPreview.parse && (
                <div style={{ fontSize: '12px', color: '#64748b' }}>
                  {importPreview.parse.skippedPaid > 0 && (
                    <span>{importPreview.parse.skippedPaid} paid/receipt row(s) skipped. </span>
                  )}
                  {importPreview.parse.skippedOutstanding > 0 && (
                    <span>{importPreview.parse.skippedOutstanding} outstanding row(s) skipped. </span>
                  )}
                  {importPreview.parse.skippedBlank > 0 && (
                    <span>{importPreview.parse.skippedBlank} blank row(s) skipped.</span>
                  )}
                </div>
              )}

              {(importPreview.changes || []).length > 0 && (
                <div className="ui-table-wrap">
                  <table className="ui-table">
                    <thead>
                      <tr>
                        <th>Student</th>
                        <th>Fee Changes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(importPreview.changes || []).map((change: any) => (
                        <tr key={change.studentKey}>
                          <td style={{ verticalAlign: 'top' }}>
                            <div style={{ fontWeight: 600 }}>{change.studentName}</div>
                            <div style={{ fontSize: '12px', color: '#64748b' }}>
                              {change.studentKey}
                              {change.roomNo ? ` • Room ${change.roomNo}` : ''}
                            </div>
                          </td>
                          <td>
                            <div className="ui-stack" style={{ gap: '4px' }}>
                              {(change.items || []).map((item: any) => (
                                <div
                                  key={item.category}
                                  style={{ display: 'flex', justifyContent: 'space-between', gap: '16px' }}
                                >
                                  <span style={{ color: '#475569' }}>{item.label}</span>
                                  <span style={{ fontWeight: 600 }}>
                                    ₹{Number(item.from).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                    {' → '}
                                    <span style={{ color: item.delta > 0 ? '#dc2626' : '#16a34a' }}>
                                      ₹{Number(item.to).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                    </span>
                                  </span>
                                </div>
                              ))}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {(importPreview.errors || []).length > 0 && (
                <div className="ui-alert ui-alert-warning">
                  <AlertTriangle size={16} />
                  <div>
                    <strong>{(importPreview.errors || []).length} row(s) will be skipped</strong>
                    <ul style={{ margin: '6px 0 0', paddingLeft: '18px' }}>
                      {(importPreview.errors || []).slice(0, 10).map((rowError: any, index: number) => (
                        <li key={index}>
                          {rowError.studentKey ? `${rowError.studentKey}: ` : ''}
                          {rowError.message}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </div>

            <div className="ui-modal-foot">
              <button className="ui-btn ui-btn-secondary" onClick={closeImportPreview} disabled={importBusy}>
                Cancel
              </button>
              <button
                className="ui-btn ui-btn-primary"
                onClick={handleApplyImport}
                disabled={importBusy || (importPreview.changes || []).length === 0}
              >
                <CheckCircle2 size={16} /> {importBusy ? 'Applying…' : 'Apply Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Import Result Modal */}
      {importResult && (
        <div className="ui-modal-overlay">
          <div className="ui-modal ui-modal-lg">
            <div className="ui-modal-head">
              <div>
                <div className="ui-modal-title">Import Complete</div>
                <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#64748b' }}>
                  Fees updated for {importResult.updated} student
                  {importResult.updated === 1 ? '' : 's'}
                  {(importResult.errors || []).length > 0
                    ? ` · ${(importResult.errors || []).length} row(s) skipped`
                    : ''}
                </p>
              </div>
              <button className="ui-modal-close" onClick={closeImportResult}>
                <X size={18} />
              </button>
            </div>

            <div className="ui-modal-body">
              <div className="ui-alert ui-alert-info">
                <CheckCircle2 size={16} />
                <div>
                  The fees list has been refreshed with the new amounts. Download
                  the updated Excel to keep a record of exactly whose fees changed
                  and the before / after values.
                </div>
              </div>

              {(importResult.changes || []).length > 0 && (
                <div className="ui-table-wrap">
                  <table className="ui-table">
                    <thead>
                      <tr>
                        <th>Student</th>
                        <th>Fee Changes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(importResult.changes || []).map((change: any) => (
                        <tr key={change.studentKey}>
                          <td style={{ verticalAlign: 'top' }}>
                            <div style={{ fontWeight: 600 }}>{change.studentName}</div>
                            <div style={{ fontSize: '12px', color: '#64748b' }}>
                              {change.studentKey}
                              {change.roomNo ? `  Room ${change.roomNo}` : ''}
                            </div>
                          </td>
                          <td>
                            <div className="ui-stack" style={{ gap: '4px' }}>
                              {(change.items || []).map((item: any) => (
                                <div
                                  key={item.category}
                                  style={{ display: 'flex', justifyContent: 'space-between', gap: '16px' }}
                                >
                                  <span style={{ color: '#475569' }}>{item.label}</span>
                                  <span style={{ fontVariantNumeric: 'tabular-nums' }}>
                                    <span style={{ color: '#94a3b8', textDecoration: 'line-through' }}>
                                      ₹{Number(item.from || 0).toLocaleString('en-IN')}
                                    </span>{' '}
                                    <span style={{ color: '#64748b' }}>→</span>{' '}
                                    <span style={{ fontWeight: 600, color: '#0f172a' }}>
                                      ₹{Number(item.to || 0).toLocaleString('en-IN')}
                                    </span>
                                  </span>
                                </div>
                              ))}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {(importResult.errors || []).length > 0 && (
                <div className="ui-alert ui-alert-warning">
                  <AlertTriangle size={16} />
                  <div>
                    <strong>{(importResult.errors || []).length} row(s) were skipped</strong>
                    <ul style={{ margin: '6px 0 0', paddingLeft: '18px' }}>
                      {(importResult.errors || []).slice(0, 10).map((rowError: any, index: number) => (
                        <li key={index}>
                          {rowError.studentKey ? `${rowError.studentKey}: ` : ''}
                          {rowError.message}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </div>

            <div className="ui-modal-foot">
              <button className="ui-btn ui-btn-secondary" onClick={closeImportResult}>
                Close
              </button>
              <button
                className="ui-btn ui-btn-success"
                onClick={handleDownloadUpdatedExcel}
                disabled={(importResult.changes || []).length === 0}
              >
                <FileSpreadsheet size={16} /> Download Updated Excel
              </button>
            </div>
          </div>
        </div>
      )}

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
          allowPaymentDate
          onClose={closePaymentModal}
          onSuccess={(paidItems, paymentMode) => {
            closePaymentModal();
            fetchFees();
            if (paidItems?.length) {
              const firstPaidItem = paidItems[0];
              setSelectedReceipt({
                isGrouped: true,
                id: `paid-${firstPaidItem.id}`,
                student: firstPaidItem.student,
                feesList: paidItems,
                totalAmount: paidItems.reduce(
                  (total: number, item: any) => total + (Number(item.amount) || 0),
                  0,
                ),
                paymentMode: paymentMode || firstPaidItem.paymentMode,
                paidDate: firstPaidItem.paidDate,
                createdAt: firstPaidItem.createdAt,
                status: 'COMPLETED',
              });
            }
          }}
        />
      )}

      {/* Block & Room-wise Fees Report PDF Modal */}
      {showRoomPdfModal && (
        <RoomFeesReportModal
          isOpen={showRoomPdfModal}
          onClose={() => setShowRoomPdfModal(false)}
          fees={fees}
          rooms={allRoomsData}
          billingMonthFilter={billingMonthFilter.value}
        />
      )}

      {/* Outstanding Fee Details Modal */}
      {outstandingModalData && (
        <div className="ui-modal-overlay" onClick={() => setOutstandingModalData(null)}>
          <div className="ui-modal ui-modal-sm hostellers-outstanding-modal" onClick={(e) => e.stopPropagation()}>
            <div className="ui-modal-head">
              <div>
                <h3 className="ui-modal-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Wallet size={17} color="#d97706" /> Outstanding Fee Details
                </h3>
                <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                  {outstandingModalData.studentName} ({outstandingModalData.studentId}) • Room {outstandingModalData.roomNo}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOutstandingModalData(null)}
                className="ui-modal-close"
                aria-label="Close"
              >
                <X size={16} />
              </button>
            </div>

            <div className="ui-modal-body" style={{ gap: '14px' }}>
              <div className="hostellers-out-summary">
                <div className="hostellers-out-stat">
                  <div className="hostellers-out-stat-label">Current Pending</div>
                  <div
                    className="hostellers-out-stat-val"
                    style={{ color: outstandingModalData.currentPendingAmount > 0 ? '#0284c7' : '#16a34a' }}
                  >
                    ₹{Number(outstandingModalData.currentPendingAmount || 0).toLocaleString('en-IN')}
                  </div>
                </div>
                <div className="hostellers-out-stat">
                  <div className="hostellers-out-stat-label">Old Outstanding</div>
                  <div
                    className="hostellers-out-stat-val"
                    style={{ color: outstandingModalData.outstandingRemaining > 0 ? '#d97706' : '#16a34a' }}
                  >
                    ₹{Number(outstandingModalData.outstandingRemaining || 0).toLocaleString('en-IN')}
                  </div>
                </div>
                <div className="hostellers-out-stat is-total">
                  <div className="hostellers-out-stat-label">Total Outstanding</div>
                  <div
                    className="hostellers-out-stat-val"
                    style={{ color: outstandingModalData.pendingFeesAmount > 0 ? '#dc2626' : '#16a34a' }}
                  >
                    ₹{Number(outstandingModalData.pendingFeesAmount || 0).toLocaleString('en-IN')}
                  </div>
                </div>
              </div>

              {outstandingModalData.pendingFeesAmount <= 0.005 ? (
                <div
                  style={{
                    textAlign: 'center',
                    padding: '18px 12px',
                    background: '#f0fdf4',
                    border: '1px solid #bbf7d0',
                    borderRadius: '8px',
                    color: '#15803d',
                    fontSize: '13px',
                    fontWeight: 600,
                  }}
                >
                  All dues are cleared. No outstanding fees pending.
                </div>
              ) : (
                <div className="hostellers-out-list">
                  {outstandingModalData.currentPendingItems?.map((item: any) => {
                    const m = resolveFeeBillingMonth(item);
                    const monthLabel = m ? formatBillingMonthShort(m) : 'Current';
                    return (
                      <div key={item.id} className="hostellers-out-item">
                        <div className="hostellers-out-item-left" style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                          <span className="hostellers-out-item-title" style={{ marginBottom: 0 }}>
                            {getSimpleFeeName(item)}
                          </span>
                          <span className="ui-badge ui-badge-blue">{monthLabel}</span>
                        </div>
                        <div className="hostellers-out-item-amt">
                          ₹{Number(item.amount || 0).toLocaleString('en-IN')}
                        </div>
                      </div>
                    );
                  })}

                  {outstandingModalData.outstandingRemaining > 0.005 && (
                    <div className="hostellers-out-item">
                      <div className="hostellers-out-item-left" style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <span className="hostellers-out-item-title" style={{ marginBottom: 0 }}>
                          Old Outstanding
                        </span>
                        <span className="ui-badge ui-badge-warning">Previous Due</span>
                      </div>
                      <div className="hostellers-out-item-amt is-amber">
                        ₹{Number(outstandingModalData.outstandingRemaining || 0).toLocaleString('en-IN')}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="ui-modal-footer">
              <button
                type="button"
                onClick={() => setOutstandingModalData(null)}
                className="ui-btn ui-btn-secondary ui-btn-sm"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => {
                  const sid = outstandingModalData.studentId;
                  setOutstandingModalData(null);
                  navigate(`/hostellers/profile/${sid}?tab=fees`);
                }}
                className="ui-btn ui-btn-outline-primary ui-btn-sm"
              >
                View Profile
              </button>
              {outstandingModalData.pendingFeesAmount > 0 && outstandingModalData.fee?.displayStatus === 'Unpaid' && (
                <button
                  type="button"
                  onClick={() => {
                    const targetFee = outstandingModalData.fee;
                    setOutstandingModalData(null);
                    setActiveFeeId(targetFee.id);
                    setFeesToCollect(targetFee.feesList);
                  }}
                  className="ui-btn ui-btn-primary ui-btn-sm"
                >
                  <Wallet size={14} /> Pay Now
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Fees;

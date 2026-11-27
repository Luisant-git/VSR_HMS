import React, { useState, useMemo } from 'react';
import { X, Download, FileSpreadsheet, Building2 } from 'lucide-react';
import Select from 'react-select';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { formatBillingMonth, resolveFeeBillingMonth, getBillingMonths } from '../utils/billingCycle';
import { isOutstandingInvoice, isOutstandingPayment, isPreviousSettledFee } from '../utils/outstanding';

interface RoomFeesReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  fees: any[];
  rooms: any[];
  billingMonthFilter?: string;
}

interface StudentFeeRow {
  studentId: string;
  name: string;
  mobileNo: string;
  regNo: string;
  roomNo: string;
  billingCycle: 'PREPAID' | 'POSTPAID';
  rentMonthLabel: string; // e.g. "SEP 26" or "OCT 26"
  rentAmount: number;
  rentDisplay: string;
  rentPaidUntilLabel?: string | null;
  rentPaidDate: string | null;
  ebMonthLabel: string;   // e.g. "SEP 26"
  ebAmount: number;
  ebDisplay: string;
  ebPaidDate: string | null;
  fineAmount: number;
  finePaidDate: string | null;
  outstandingAmount: number;
  outstandingDisplay: string;
  outstandingPaidDate: string | null;
}

interface RoomGroup {
  roomId: string;
  block: string;
  students: StudentFeeRow[];
}

/** Formats payment date as D/M/YY (e.g. 15/10/26 or 8/10/26) matching the handwritten reference register */
const formatPaymentDate = (d?: string | Date | null): string => {
  if (!d) return '';
  const date = new Date(d);
  if (isNaN(date.getTime())) return '';
  const day = date.getDate();
  const month = date.getMonth() + 1;
  const year = String(date.getFullYear()).slice(-2);
  return `${day}/${month}/${year}`;
};

/** Rounds to 2 decimal places and strips floating-point artifacts like 107.05999999999949 */
const formatAmount = (val: number): string => {
  const rounded = Math.round((Number(val) || 0) * 100) / 100;
  return Number.isInteger(rounded) ? String(rounded) : String(Number(rounded.toFixed(2)));
};

/** Formats "2026-09" to "SEP 26" */
const formatShortMonth = (monthStr?: string | null): string => {
  if (!monthStr) return '';
  const parts = monthStr.split('-');
  if (parts.length < 2) return monthStr;
  const monthNames = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  const idx = Number(parts[1]) - 1;
  const mName = monthNames[idx] || parts[1];
  const yShort = parts[0].slice(-2);
  return `${mName} ${yShort}`;
};

const customSelectStyles = {
  control: (base: any, state: any) => ({
    ...base,
    minHeight: '36px',
    borderRadius: '6px',
    borderColor: state.isFocused ? '#2563eb' : '#cbd5e1',
    boxShadow: state.isFocused ? '0 0 0 1px #2563eb' : 'none',
    '&:hover': { borderColor: state.isFocused ? '#2563eb' : '#94a3b8' },
    fontSize: '13px',
    cursor: 'pointer',
    background: '#fff',
  }),
  option: (base: any, state: any) => ({
    ...base,
    fontSize: '13px',
    backgroundColor: state.isSelected ? '#2563eb' : state.isFocused ? '#eff6ff' : '#fff',
    color: state.isSelected ? '#fff' : '#1e293b',
    cursor: 'pointer',
  }),
  menu: (base: any) => ({
    ...base,
    zIndex: 99999,
  }),
};

export const RoomFeesReportModal: React.FC<RoomFeesReportModalProps> = ({
  isOpen,
  onClose,
  fees,
  rooms,
  billingMonthFilter,
}) => {
  const { currentMonthStr } = getBillingMonths();

  // Available Billing Months
  const availableMonths = useMemo(() => {
    const months = new Set<string>();
    if (currentMonthStr) months.add(currentMonthStr);
    fees.forEach((f) => {
      const m = resolveFeeBillingMonth(f);
      if (m) months.add(m);
    });
    return Array.from(months).sort().reverse();
  }, [fees, currentMonthStr]);

  // Selected Month (Report cycle, e.g. "2026-10")
  const [selectedMonth, setSelectedMonth] = useState<string>(
    billingMonthFilter && billingMonthFilter !== 'ALL'
      ? billingMonthFilter
      : availableMonths[0] || currentMonthStr,
  );

  // Previous month string for postpaid (e.g. "2026-09" when selected is "2026-10")
  const previousMonthStr = useMemo(() => {
    if (!selectedMonth) return '';
    const [y, m] = selectedMonth.split('-').map(Number);
    const d = new Date(y, m - 2, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }, [selectedMonth]);

  // Available Blocks
  const availableBlocks = useMemo(() => {
    const blocks = new Set<string>();
    rooms.forEach((r) => {
      if (r.block) blocks.add(r.block.trim());
    });
    return Array.from(blocks).sort();
  }, [rooms]);

  // Filter states
  const [selectedBlock, setSelectedBlock] = useState<string>('ALL');
  const [selectedRoom, setSelectedRoom] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PAID' | 'UNPAID'>('ALL');
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');

  const statusOptions = [
    { value: 'ALL', label: 'All (Paid & Unpaid)' },
    { value: 'PAID', label: 'Paid Only' },
    { value: 'UNPAID', label: 'Unpaid Only' },
  ];

  // Filtered rooms list for room selector
  const roomsInSelectedBlock = useMemo(() => {
    return rooms
      .filter((r) => selectedBlock === 'ALL' || (r.block && r.block.trim() === selectedBlock))
      .sort((a, b) => String(a.id).localeCompare(String(b.id), undefined, { numeric: true }));
  }, [rooms, selectedBlock]);

  // Options for react-select
  const monthOptions = useMemo(() => {
    return availableMonths.map((m) => ({
      value: m,
      label: formatBillingMonth(m) || m,
    }));
  }, [availableMonths]);

  const blockOptions = useMemo(() => {
    return [
      { value: 'ALL', label: 'All Blocks' },
      ...availableBlocks.map((b) => ({ value: b, label: b })),
    ];
  }, [availableBlocks]);

  const roomOptions = useMemo(() => {
    return [
      { value: 'ALL', label: 'All Rooms' },
      ...roomsInSelectedBlock.map((r) => ({
        value: String(r.id),
        label: `Room ${r.id}`,
      })),
    ];
  }, [roomsInSelectedBlock]);

  // Full Month Label (e.g. "October 2026")
  const monthFullLabel = useMemo(() => {
    return formatBillingMonth(selectedMonth) || selectedMonth;
  }, [selectedMonth]);

  const prepaidShort = formatShortMonth(selectedMonth);
  const postpaidShort = formatShortMonth(previousMonthStr);

  // Build Room & Student groups matching the reference sheet
  const roomGroups: RoomGroup[] = useMemo(() => {
    if (!rooms || rooms.length === 0) return [];

    const targetRooms = rooms.filter((r) => {
      if (selectedBlock !== 'ALL' && (!r.block || r.block.trim() !== selectedBlock)) {
        return false;
      }
      if (selectedRoom !== 'ALL' && String(r.id) !== selectedRoom) {
        return false;
      }
      return true;
    });

    const groups: RoomGroup[] = [];

    targetRooms.forEach((room) => {
      const roomId = String(room.id);
      const blockName = room.block || 'Main';

      // Collect students belonging to this room
      const studentMap = new Map<string, any>();

      // 1. From room.students relation
      if (Array.isArray(room.students)) {
        room.students.forEach((s: any) => {
          if (s.status !== 'Vacated') {
            studentMap.set(s.id, s);
          }
        });
      }

      // 2. From fees array (if student has roomNo matching this room)
      fees.forEach((f: any) => {
        if (f.student && String(f.student.roomNo) === roomId) {
          if (!studentMap.has(f.student.id)) {
            studentMap.set(f.student.id, f.student);
          } else {
            const existing = studentMap.get(f.student.id);
            if (!existing.mobileNo && f.student.mobileNo) {
              existing.mobileNo = f.student.mobileNo;
            }
            if (!existing.college && f.student.college) {
              existing.college = f.student.college;
            }
          }
        }
      });

      const studentList = Array.from(studentMap.values());

      // Map each student
      const studentRows: StudentFeeRow[] = studentList.map((student) => {
        const studentId = student.id;
        const studentRegNo = student.manualRegsiName || student.regNo || '—';

        // Detect if student is POSTPAID or PREPAID
        const cycleStr = String(
          student.college?.billingCycle ||
          student.billingCycle ||
          ''
        ).toUpperCase();
        const isPostpaid = cycleStr === 'POSTPAID';
        const billingCycle: 'PREPAID' | 'POSTPAID' = isPostpaid ? 'POSTPAID' : 'PREPAID';

        // Relevant months:
        // POSTPAID rent is for previous month (e.g. SEP 26); PREPAID rent is for current month (e.g. OCT 26)
        const targetRentMonth = isPostpaid ? previousMonthStr : selectedMonth;
        const rentMonthLabel = formatShortMonth(targetRentMonth);

        // EB is postpaid for everyone (e.g. SEP 26)
        const targetEbMonth = previousMonthStr || selectedMonth;
        const ebMonthLabel = formatShortMonth(targetEbMonth);

        // Match student transactions uniquely (NEVER match null === null or empty === empty)
        const sId = student.id;
        const sReg = (student.regNo && student.regNo !== '—' && String(student.regNo).trim())
          ? String(student.regNo).trim().toUpperCase()
          : null;
        const sManual = (student.manualRegsiName && student.manualRegsiName !== '—' && String(student.manualRegsiName).trim())
          ? String(student.manualRegsiName).trim().toUpperCase()
          : null;

        const studentFees = fees.filter((f: any) => {
          if (!f) return false;
          if (f.studentId && f.studentId === sId) return true;
          if (f.student?.id && f.student.id === sId) return true;
          if (
            sManual &&
            f.student?.manualRegsiName &&
            String(f.student.manualRegsiName).trim().toUpperCase() === sManual
          ) {
            return true;
          }
          if (
            sReg &&
            f.student?.regNo &&
            String(f.student.regNo).trim().toUpperCase() === sReg
          ) {
            return true;
          }
          return false;
        });

        // Resolve student mobile number
        const mobileFromFees = studentFees.find((f: any) => f.student?.mobileNo)?.student?.mobileNo;
        const studentMobile =
          student.mobileNo ||
          mobileFromFees ||
          student.mobile ||
          student.phone ||
          student.fatherMobileNo ||
          '';

        // 1. Rent
        const rentFees = studentFees.filter((f: any) => {
          const type = String(f.transactionType || '').toUpperCase();
          if (!type.includes('RENT')) return false;
          // Exclude old settled fees from before Nov 1 unless it is an active pending invoice
          if (isPreviousSettledFee(f) && f.status !== 'PENDING') return false;
          const feeMonth = resolveFeeBillingMonth(f);
          return feeMonth === targetRentMonth || feeMonth === selectedMonth || (!feeMonth && f.status === 'PENDING');
        });

        let rentAmount = 0;
        let rentPaidDate: string | null = null;
        let rentPaidUntilLabel: string | null = null;

        // Prioritize active PENDING invoice for this cycle (means UNPAID!)
        const pendingRent = rentFees.find((f) => {
          if (f.status !== 'PENDING') return false;
          const m = resolveFeeBillingMonth(f);
          return m === targetRentMonth || m === selectedMonth || !m;
        });

        // If no pending invoice, check if there is a COMPLETED payment for this cycle
        const completedRent = rentFees.find((f) => {
          if (f.status !== 'COMPLETED') return false;
          if (isPreviousSettledFee(f)) return false;
          const m = resolveFeeBillingMonth(f);
          return m === targetRentMonth || m === selectedMonth;
        });

        const extractPaidUntilLabel = (tx?: any): string | null => {
          const match = String(tx?.description || '').match(/Paid for \d+ Months \(([^)]+)\)/i);
          if (match) {
            const parts = match[1].split('-');
            return parts[parts.length - 1].trim();
          }
          if (student.rentPaidUntil) {
            const d = new Date(student.rentPaidUntil);
            if (!isNaN(d.getTime())) {
              const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
              return formatShortMonth(ym);
            }
          }
          return null;
        };

        const paidUntilDate = student.rentPaidUntil ? new Date(student.rentPaidUntil) : null;
        const paidUntilYM =
          paidUntilDate && !isNaN(paidUntilDate.getTime())
            ? `${paidUntilDate.getFullYear()}-${String(paidUntilDate.getMonth() + 1).padStart(2, '0')}`
            : null;
        const isCoveredByAdvanceRent = paidUntilYM !== null && paidUntilYM >= targetRentMonth;

        if (pendingRent) {
          rentAmount = Number(pendingRent.amount) || Number(student.rent) || Number(room.rent) || 0;
          rentPaidDate = null; // Unpaid! Must leave blank!
        } else if (completedRent) {
          rentAmount = Number(completedRent.amount) || Number(student.rent) || Number(room.rent) || 0;
          rentPaidDate = completedRent.paidDate || null;
          if (/Paid for \d+ Months/i.test(String(completedRent.description || ''))) {
            rentPaidUntilLabel = extractPaidUntilLabel(completedRent);
          }
        } else if (isCoveredByAdvanceRent) {
          // Upcoming month covered by an earlier multi-month rent payment
          const multiMonthTx = studentFees.find(
            (f: any) =>
              String(f.transactionType || '').toUpperCase().includes('RENT') &&
              f.status === 'COMPLETED' &&
              /Paid for \d+ Months/i.test(String(f.description || '')),
          );
          rentAmount = Number(multiMonthTx?.amount) || Number(student.rent) || Number(room.rent) || 0;
          rentPaidDate = multiMonthTx?.paidDate || student.rentPaidUntil || null;
          rentPaidUntilLabel = extractPaidUntilLabel(multiMonthTx);
        } else {
          // No transaction in fees array, fallback to student profile rent or room rent
          rentAmount = Number(student.rent) || Number(room.rent) || 0;
          rentPaidDate = null;
        }

        // 2. EB Charge
        const ebFees = studentFees.filter((f: any) => {
          const type = String(f.transactionType || '').toUpperCase();
          if (!type.includes('EB') && !type.includes('ELECTRIC')) return false;
          if (isPreviousSettledFee(f) && f.status !== 'PENDING') return false;
          const feeMonth = resolveFeeBillingMonth(f);
          return feeMonth === targetEbMonth || feeMonth === selectedMonth || (!feeMonth && f.status === 'PENDING');
        });

        let ebAmount = 0;
        let ebPaidDate: string | null = null;

        const pendingEb = ebFees.find((f) => {
          if (f.status !== 'PENDING') return false;
          const m = resolveFeeBillingMonth(f);
          return m === targetEbMonth || m === selectedMonth || !m;
        });

        const completedEb = ebFees.find((f) => {
          if (f.status !== 'COMPLETED') return false;
          if (isPreviousSettledFee(f)) return false;
          const m = resolveFeeBillingMonth(f);
          return m === targetEbMonth || m === selectedMonth;
        });

        if (pendingEb) {
          ebAmount = Number(pendingEb.amount) || 0;
          ebPaidDate = null; // Unpaid!
        } else if (completedEb) {
          ebAmount = Number(completedEb.amount) || 0;
          ebPaidDate = completedEb.paidDate || null;
        }

        // 3. Fine
        const fineFees = studentFees.filter((f: any) => {
          const type = String(f.transactionType || '').toUpperCase();
          if (!type.includes('FINE')) return false;
          if (isPreviousSettledFee(f) && f.status !== 'PENDING') return false;
          const feeMonth = resolveFeeBillingMonth(f);
          return feeMonth === targetRentMonth || feeMonth === targetEbMonth || feeMonth === selectedMonth || !feeMonth;
        });

        let fineAmount = 0;
        let finePaidDate: string | null = null;

        const pendingFines = fineFees.filter((f) => f.status === 'PENDING');
        const completedFines = fineFees.filter((f) => f.status === 'COMPLETED' && !isPreviousSettledFee(f));

        if (pendingFines.length > 0) {
          fineAmount = pendingFines.reduce((sum, f) => sum + (Number(f.amount) || 0), 0);
          finePaidDate = null; // Unpaid!
        } else if (completedFines.length > 0) {
          fineAmount = completedFines.reduce((sum, f) => sum + (Number(f.amount) || 0), 0);
          const latestPaid = completedFines.sort(
            (a, b) => new Date(b.paidDate || 0).getTime() - new Date(a.paidDate || 0).getTime()
          )[0];
          finePaidDate = latestPaid?.paidDate || null;
        }

        // 4. Outstanding Balance & Payment Date
        const outInvoices = studentFees.filter((f: any) =>
          isOutstandingInvoice(f) ||
          (f.status === 'PENDING' && String(f.transactionType || '').toUpperCase().includes('OUTSTANDING'))
        );
        const outPayments = studentFees.filter((f: any) =>
          isOutstandingPayment(f) ||
          (f.status === 'COMPLETED' && String(f.transactionType || '').toUpperCase().includes('OUTSTANDING'))
        );

        const originalOut = outInvoices.reduce((sum: number, f: any) => sum + (Number(f.amount) || 0), 0);
        const paidOut = outPayments.reduce((sum: number, f: any) => sum + (Number(f.amount) || 0), 0);
        const remainingOut = Math.max(0, originalOut - paidOut);

        // Older unpaid pending fees from strictly earlier billing months not matched as current rent / eb / fine
        const olderPendingFees = studentFees.filter((f: any) => {
          if (f.status !== 'PENDING') return false;
          const type = String(f.transactionType || '').toUpperCase();
          if (type.includes('MESS') || type.includes('ADVANCE')) return false;
          if (rentFees.includes(f) || ebFees.includes(f) || fineFees.includes(f) || outInvoices.includes(f)) return false;
          const feeMonth = resolveFeeBillingMonth(f);
          if (feeMonth && feeMonth < targetRentMonth && feeMonth < targetEbMonth) return true;
          return false;
        });
        const olderPendingTotal = olderPendingFees.reduce((sum: number, f: any) => sum + (Number(f.amount) || 0), 0);

        let outstandingAmount = 0;
        let outstandingPaidDate: string | null = null;

        if (outInvoices.length > 0 || outPayments.length > 0 || olderPendingTotal > 0) {
          if (remainingOut + olderPendingTotal > 0) {
            outstandingAmount = remainingOut + olderPendingTotal;
            if (outPayments.length > 0) {
              const sorted = [...outPayments].sort(
                (a, b) => new Date(b.paidDate || 0).getTime() - new Date(a.paidDate || 0).getTime()
              );
              outstandingPaidDate = sorted[0]?.paidDate || null;
            }
          } else if (paidOut > 0) {
            outstandingAmount = paidOut;
            const sorted = [...outPayments].sort(
              (a, b) => new Date(b.paidDate || 0).getTime() - new Date(a.paidDate || 0).getTime()
            );
            outstandingPaidDate = sorted[0]?.paidDate || null;
          }
        }

        const rentDisplay = rentAmount > 0 ? `${formatAmount(rentAmount)} (${rentMonthLabel})` : '';
        const ebDisplay = ebAmount > 0 ? formatAmount(ebAmount) : '';
        const outstandingDisplay = outstandingAmount > 0 ? formatAmount(outstandingAmount) : '';

        return {
          studentId,
          name: student.name || 'Unknown', // ONLY student name, NO college name!
          mobileNo: studentMobile,
          regNo: studentRegNo,
          roomNo: roomId,
          billingCycle,
          rentMonthLabel,
          rentAmount,
          rentDisplay,
          rentPaidUntilLabel,
          rentPaidDate,
          ebMonthLabel,
          ebAmount,
          ebDisplay,
          ebPaidDate,
          fineAmount,
          finePaidDate,
          outstandingAmount,
          outstandingDisplay,
          outstandingPaidDate,
        };
      });

      const isWithinDateRange = (dateVal?: string | Date | null) => {
        if (!fromDate && !toDate) return true;
        if (!dateVal) return false;
        const parsed = new Date(dateVal);
        if (isNaN(parsed.getTime())) return false;
        const y = parsed.getFullYear();
        const m = String(parsed.getMonth() + 1).padStart(2, '0');
        const d = String(parsed.getDate()).padStart(2, '0');
        const ymd = `${y}-${m}-${d}`;
        if (fromDate && ymd < fromDate) return false;
        if (toDate && ymd > toDate) return false;
        return true;
      };

      const filteredRows = studentRows.filter((row) => {
        const hasUnpaid =
          (row.rentAmount > 0 && !row.rentPaidDate) ||
          (row.ebAmount > 0 && !row.ebPaidDate) ||
          (row.fineAmount > 0 && !row.finePaidDate) ||
          (row.outstandingAmount > 0 && !row.outstandingPaidDate);
        const hasPaid = Boolean(
          row.rentPaidDate || row.ebPaidDate || row.finePaidDate || row.outstandingPaidDate,
        );

        if (statusFilter === 'PAID' && (hasUnpaid || !hasPaid)) return false;
        if (statusFilter === 'UNPAID' && !hasUnpaid) return false;

        if (fromDate || toDate) {
          const paidDates = [
            row.rentPaidDate,
            row.ebPaidDate,
            row.finePaidDate,
            row.outstandingPaidDate,
          ].filter(Boolean);

          if (statusFilter === 'UNPAID') {
            const sFees = fees.filter((f: any) => {
              const s = f.student;
              if (!s) return false;
              const fId = s.id || s.regNo || s.manualRegsiName;
              return fId && fId === row.studentId;
            });
            const hasPendingInRange = sFees.some(
              (f: any) =>
                f.status === 'PENDING' &&
                (isWithinDateRange(f.dueDate) || isWithinDateRange(f.createdAt)),
            );
            if (!hasPendingInRange && !paidDates.some((d) => isWithinDateRange(d))) {
              return false;
            }
          } else {
            if (!paidDates.some((d) => isWithinDateRange(d))) return false;
          }
        }

        return true;
      });

      // Default: skip rooms with 0 matching students
      if (filteredRows.length === 0) {
        return;
      }

      groups.push({
        roomId,
        block: blockName,
        students: filteredRows,
      });
    });

    return groups.sort((a, b) => {
      const blockCmp = a.block.localeCompare(b.block);
      if (blockCmp !== 0) return blockCmp;
      return a.roomId.localeCompare(b.roomId, undefined, { numeric: true });
    });
  }, [rooms, fees, selectedMonth, previousMonthStr, selectedBlock, selectedRoom, statusFilter, fromDate, toDate]);

  // Generate and Download PDF with the EXACT SAME LOOK as the user's reference image
  const handleDownloadPDF = () => {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const scopeBlock = selectedBlock === 'ALL' ? 'ALL BLOCKS' : selectedBlock.toUpperCase();
    const scopeDisplay = selectedRoom !== 'ALL' ? `ROOM ${selectedRoom}` : scopeBlock;

    // 1. Top Header Box matching the printed sheet
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.2);
    doc.rect(10, 10, 190, 14);

    // Vertical line dividers
    doc.line(55, 10, 55, 24);
    doc.line(100, 10, 100, 24);

    // Left box: ROOM NO & BLOCK
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(0, 0, 0);
    doc.text('ROOM NO', 32.5, 15.5, { align: 'center' });
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.text(scopeDisplay, 32.5, 20.5, { align: 'center' });

    // Middle box: MONTH
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text('MONTH / YEAR', 77.5, 15.5, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.text(`${postpaidShort} / ${prepaidShort}`, 77.5, 20.5, { align: 'center' });

    // Right box: TITLE
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text(`${monthFullLabel.toUpperCase()} FEES & EB ESTIMATE`, 145, 15.5, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.text(`VSR HOSTEL MANAGEMENT SYSTEM   •   DATE: ${new Date().toLocaleDateString('en-GB')}`, 145, 20.5, { align: 'center' });

    // 2. Table Column Headers:
    // STUDENT NAME | ROOM RENT | PAYMENT DATE | EB CHARGE | PAYMENT DATE | FINE | PAYMENT DATE | OUTSTANDING | PAYMENT DATE
    const rentHeaderTitle = postpaidShort === prepaidShort
      ? `ROOM RENT\n${postpaidShort}`
      : `ROOM RENT\n(${postpaidShort} / ${prepaidShort})`;

    const ebHeaderTitle = `EB CHARGE\n${postpaidShort || prepaidShort}`;

    const tableHeaders = [
      'STUDENT NAME',
      rentHeaderTitle,
      'PAYMENT\nDATE',
      ebHeaderTitle,
      'PAYMENT\nDATE',
      'FINE',
      'PAYMENT\nDATE',
      'OUTSTANDING',
      'PAYMENT\nDATE',
    ];

    // 3. Build Body: Room row (A1, A2, A3) followed by student rows
    const tableBody: any[] = [];

    roomGroups.forEach((group) => {
      // Room section row: Clean centered Room identifier (e.g. "A1", "A2", "A3")
      tableBody.push([
        {
          content: `${group.roomId}`,
          colSpan: 9,
          styles: {
            fillColor: [255, 255, 255],
            textColor: [0, 0, 0],
            fontStyle: 'bold',
            halign: 'center',
            fontSize: 10.5,
            cellPadding: 2.2,
          },
        },
      ]);

      // Students under this room
      if (group.students.length === 0) {
        tableBody.push([
          {
            content: '',
            colSpan: 9,
            styles: { cellPadding: 2 },
          },
        ]);
      } else {
        group.students.forEach((s) => {
          tableBody.push([
            s.mobileNo ? `${s.name}\n${s.mobileNo}` : s.name,
            s.rentDisplay ? (s.rentPaidUntilLabel ? `${s.rentDisplay}\nPaid till ${s.rentPaidUntilLabel}` : s.rentDisplay) : '',
            s.rentPaidDate ? formatPaymentDate(s.rentPaidDate) : '',
            s.ebDisplay || '',
            s.ebPaidDate ? formatPaymentDate(s.ebPaidDate) : '',
            s.fineAmount > 0 ? formatAmount(s.fineAmount) : '',
            s.finePaidDate ? formatPaymentDate(s.finePaidDate) : '',
            s.outstandingDisplay || '',
            s.outstandingPaidDate ? formatPaymentDate(s.outstandingPaidDate) : '',
          ]);
        });
      }
    });

    // Column widths: Total 190mm on A4 Portrait (10mm left & right margins)
    const colWidths = {
      0: 38, // STUDENT NAME & MOB
      1: 22, // ROOM RENT
      2: 19, // PAYMENT DATE
      3: 19, // EB CHARGE
      4: 19, // PAYMENT DATE
      5: 16, // FINE
      6: 19, // PAYMENT DATE
      7: 19, // OUTSTANDING
      8: 19, // PAYMENT DATE
    };

    autoTable(doc, {
      startY: 28,
      head: [tableHeaders],
      body: tableBody,
      theme: 'grid',
      styles: {
        font: 'helvetica',
        fontSize: 8.5,
        cellPadding: 2.2,
        lineColor: [0, 0, 0], // Crisp black border lines matching the printed photo
        lineWidth: 0.15,
        textColor: [0, 0, 0],
        fillColor: [255, 255, 255], // Pure white table
        valign: 'middle',
      },
      headStyles: {
        fillColor: [255, 255, 255],
        textColor: [0, 0, 0],
        fontStyle: 'bold',
        halign: 'center',
        valign: 'middle',
        fontSize: 7.5,
        lineWidth: 0.2,
        lineColor: [0, 0, 0],
      },
      columnStyles: {
        0: { cellWidth: colWidths[0], halign: 'left' },
        1: { cellWidth: colWidths[1], halign: 'center' },
        2: { cellWidth: colWidths[2], halign: 'center' },
        3: { cellWidth: colWidths[3], halign: 'center' },
        4: { cellWidth: colWidths[4], halign: 'center' },
        5: { cellWidth: colWidths[5], halign: 'center' },
        6: { cellWidth: colWidths[6], halign: 'center' },
        7: { cellWidth: colWidths[7], halign: 'center' },
        8: { cellWidth: colWidths[8], halign: 'center' },
      },
      margin: { top: 28, left: 10, right: 10, bottom: 12 },
    });

    // Page numbers
    const totalPages = typeof (doc as any).getNumberOfPages === 'function'
      ? (doc as any).getNumberOfPages()
      : ((doc.internal as any).pages?.length ? (doc.internal as any).pages.length - 1 : 1);

    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(80, 80, 80);
      doc.text(
        `Page ${i} of ${totalPages}`,
        pageWidth / 2,
        pageHeight - 6,
        { align: 'center' },
      );
    }

    const safeFilename = `Room_Fees_${selectedBlock === 'ALL' ? 'AllBlocks' : selectedBlock}_${selectedMonth}.pdf`.replace(
      /[^a-zA-Z0-9_-]/g,
      '_',
    );
    doc.save(safeFilename);
  };

  // Export to Excel
  const handleExportExcel = () => {
    const excelRows: any[] = [];

    roomGroups.forEach((group) => {
      excelRows.push({
        'Room': group.roomId,
        'Student Name': `[ROOM ${group.roomId}]`,
        'Mobile No': '',
        'Room Rent': '',
        'Rent Payment Date': '',
        'EB Charge': '',
        'EB Payment Date': '',
        'Fine': '',
        'Fine Payment Date': '',
        'Outstanding Balance': '',
        'Outstanding Payment Date': '',
      });

      group.students.forEach((s) => {
        excelRows.push({
          'Room': s.roomNo,
          'Student Name': s.name, // ONLY student name!
          'Mobile No': s.mobileNo || '',
          'Room Rent': s.rentDisplay ? (s.rentPaidUntilLabel ? `${s.rentDisplay} (Paid till ${s.rentPaidUntilLabel})` : s.rentDisplay) : '',
          'Rent Payment Date': s.rentPaidDate ? formatPaymentDate(s.rentPaidDate) : '',
          'EB Charge': s.ebDisplay || '',
          'EB Payment Date': s.ebPaidDate ? formatPaymentDate(s.ebPaidDate) : '',
          'Fine': s.fineAmount > 0 ? Number(formatAmount(s.fineAmount)) : '',
          'Fine Payment Date': s.finePaidDate ? formatPaymentDate(s.finePaidDate) : '',
          'Outstanding Balance': s.outstandingDisplay || '',
          'Outstanding Payment Date': s.outstandingPaidDate ? formatPaymentDate(s.outstandingPaidDate) : '',
        });
      });
    });

    const worksheet = XLSX.utils.json_to_sheet(excelRows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Room_Fees');
    XLSX.writeFile(workbook, `Room_Fees_${selectedMonth}.xlsx`);
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(4px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          backgroundColor: '#fff',
          borderRadius: '12px',
          width: '100%',
          maxWidth: '1160px',
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          overflow: 'hidden',
        }}
      >
        {/* Header with vibrant professional background and larger text */}
        <div
          style={{
            padding: '16px 22px',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%)',
            color: '#fff',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Building2 size={24} color="#93c5fd" />
            <div>
              <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#fff', letterSpacing: '0.3px' }}>
                Room-wise Fees Statement (PDF)
              </h2>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'rgba(255, 255, 255, 0.15)',
              border: 'none',
              color: '#fff',
              cursor: 'pointer',
              padding: '6px',
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Toolbar Controls with Searchable Dropdowns (react-select) */}
        <div
          style={{
            padding: '14px 22px',
            backgroundColor: '#f8fafc',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            flexWrap: 'wrap',
            gap: '14px',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '14px', alignItems: 'center' }}>
            {/* Searchable Month Dropdown */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: '180px' }}>
              <label style={{ fontSize: '11px', fontWeight: 700, color: '#475569', letterSpacing: '0.5px' }}>
                BILLING MONTH
              </label>
              <Select
                value={monthOptions.find((opt) => opt.value === selectedMonth) || monthOptions[0]}
                onChange={(opt: any) => setSelectedMonth(opt?.value || selectedMonth)}
                options={monthOptions}
                styles={customSelectStyles}
                isSearchable
              />
            </div>

            {/* Searchable Block Dropdown */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: '160px' }}>
              <label style={{ fontSize: '11px', fontWeight: 700, color: '#475569', letterSpacing: '0.5px' }}>
                BLOCK
              </label>
              <Select
                value={blockOptions.find((opt) => opt.value === selectedBlock) || blockOptions[0]}
                onChange={(opt: any) => {
                  setSelectedBlock(opt?.value || 'ALL');
                  setSelectedRoom('ALL');
                }}
                options={blockOptions}
                styles={customSelectStyles}
                isSearchable
              />
            </div>

            {/* Searchable Room Dropdown */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: '150px' }}>
              <label style={{ fontSize: '11px', fontWeight: 700, color: '#475569', letterSpacing: '0.5px' }}>
                ROOM
              </label>
              <Select
                value={roomOptions.find((opt) => opt.value === selectedRoom) || roomOptions[0]}
                onChange={(opt: any) => setSelectedRoom(opt?.value || 'ALL')}
                options={roomOptions}
                styles={customSelectStyles}
                isSearchable
                placeholder="Search Room..."
              />
            </div>

            {/* Paid / Unpaid Status Filter */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: '165px' }}>
              <label style={{ fontSize: '11px', fontWeight: 700, color: '#475569', letterSpacing: '0.5px' }}>
                STATUS
              </label>
              <Select
                value={statusOptions.find((opt) => opt.value === statusFilter) || statusOptions[0]}
                onChange={(opt: any) => setStatusFilter((opt?.value as 'ALL' | 'PAID' | 'UNPAID') || 'ALL')}
                options={statusOptions}
                styles={customSelectStyles}
              />
            </div>

            {/* From Date */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '11px', fontWeight: 700, color: '#475569', letterSpacing: '0.5px' }}>
                FROM DATE
              </label>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                style={{
                  height: '36px',
                  padding: '0 10px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  fontSize: '13px',
                  color: '#1e293b',
                  background: '#fff',
                }}
              />
            </div>

            {/* To Date */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '11px', fontWeight: 700, color: '#475569', letterSpacing: '0.5px' }}>
                TO DATE
              </label>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                style={{
                  height: '36px',
                  padding: '0 10px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  fontSize: '13px',
                  color: '#1e293b',
                  background: '#fff',
                }}
              />
            </div>

            {(statusFilter !== 'ALL' || fromDate || toDate) && (
              <button
                type="button"
                onClick={() => {
                  setStatusFilter('ALL');
                  setFromDate('');
                  setToDate('');
                }}
                style={{
                  alignSelf: 'flex-end',
                  height: '36px',
                  padding: '0 10px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  background: '#fff',
                  color: '#475569',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Clear
              </button>
            )}
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <button
              onClick={handleExportExcel}
              className="ui-btn ui-btn-outline"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 14px',
                fontSize: '13px',
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              <FileSpreadsheet size={16} /> Excel
            </button>
            <button
              onClick={handleDownloadPDF}
              className="ui-btn ui-btn-primary"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 18px',
                fontSize: '13px',
                fontWeight: 600,
                backgroundColor: '#1e3a8a',
                borderColor: '#1e3a8a',
                cursor: 'pointer',
              }}
            >
              <Download size={16} /> Download PDF
            </button>
          </div>
        </div>

        {/* Live Table View (Larger text size and spacious padding) */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '18px' }}>
          {roomGroups.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', color: '#64748b', fontSize: '14px' }}>
              No rooms found matching the selected filters.
            </div>
          ) : (
            <div>
              {/* Header block preview */}
              <div
                style={{
                  border: '1.5px solid #000',
                  borderBottom: 'none',
                  display: 'flex',
                  backgroundColor: '#fff',
                  fontSize: '12px',
                }}
              >
                <div style={{ borderRight: '1.5px solid #000', padding: '8px 16px', minWidth: '140px', textAlign: 'center' }}>
                  <div style={{ fontWeight: 800, fontSize: '13px' }}>ROOM NO</div>
                  <div style={{ fontSize: '12.5px', marginTop: '2px' }}>
                    {selectedRoom !== 'ALL'
                      ? `ROOM ${selectedRoom}`
                      : selectedBlock === 'ALL'
                        ? 'ALL BLOCKS'
                        : selectedBlock}
                  </div>
                </div>
                <div style={{ borderRight: '1.5px solid #000', padding: '8px 16px', minWidth: '150px', textAlign: 'center' }}>
                  <div style={{ fontWeight: 800, fontSize: '13px' }}>RENT MONTHS</div>
                  <div style={{ fontSize: '12.5px', marginTop: '2px' }}>Post: {postpaidShort} | Pre: {prepaidShort}</div>
                </div>
                <div style={{ padding: '8px 20px', display: 'flex', alignItems: 'center' }}>
                  <span style={{ fontWeight: 800, fontSize: '14px', letterSpacing: '0.2px' }}>
                    {monthFullLabel.toUpperCase()} FEES & EB ESTIMATE
                  </span>
                </div>
              </div>

              {/* Main table */}
              <table
                style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  fontSize: '13px',
                  fontFamily: 'inherit',
                  color: '#000',
                  backgroundColor: '#fff',
                }}
              >
                <thead>
                  <tr style={{ backgroundColor: '#fff', borderTop: '1.5px solid #000', borderBottom: '1.5px solid #000' }}>
                    <th style={{ border: '1.5px solid #000', padding: '10px 10px', textAlign: 'left', fontWeight: 800, width: '20%', fontSize: '13px' }}>
                      STUDENT NAME
                    </th>
                    <th style={{ border: '1.5px solid #000', padding: '10px 6px', textAlign: 'center', fontWeight: 800, fontSize: '12px' }}>
                      ROOM RENT <br />
                      <span style={{ fontSize: '10.5px', fontWeight: 500 }}>({postpaidShort} / {prepaidShort})</span>
                    </th>
                    <th style={{ border: '1.5px solid #000', padding: '10px 6px', textAlign: 'center', fontWeight: 800, fontSize: '12px' }}>
                      PAYMENT DATE
                    </th>
                    <th style={{ border: '1.5px solid #000', padding: '10px 6px', textAlign: 'center', fontWeight: 800, fontSize: '12px' }}>
                      EB CHARGE <br />
                      <span style={{ fontSize: '10.5px', fontWeight: 500 }}>({postpaidShort})</span>
                    </th>
                    <th style={{ border: '1.5px solid #000', padding: '10px 6px', textAlign: 'center', fontWeight: 800, fontSize: '12px' }}>
                      PAYMENT DATE
                    </th>
                    <th style={{ border: '1.5px solid #000', padding: '10px 6px', textAlign: 'center', fontWeight: 800, fontSize: '12px' }}>
                      FINE
                    </th>
                    <th style={{ border: '1.5px solid #000', padding: '10px 6px', textAlign: 'center', fontWeight: 800, fontSize: '12px' }}>
                      PAYMENT DATE
                    </th>
                    <th style={{ border: '1.5px solid #000', padding: '10px 6px', textAlign: 'center', fontWeight: 800, fontSize: '12px' }}>
                      OUTSTANDING
                    </th>
                    <th style={{ border: '1.5px solid #000', padding: '10px 6px', textAlign: 'center', fontWeight: 800, fontSize: '12px' }}>
                      PAYMENT DATE
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {roomGroups.map((group) => (
                    <React.Fragment key={group.roomId}>
                      {/* Room Section Row: Clean centered Room number e.g. A1, A2, A3 */}
                      <tr style={{ backgroundColor: '#f8fafc' }}>
                        <td
                          colSpan={9}
                          style={{
                            border: '1.5px solid #000',
                            padding: '8px 12px',
                            fontWeight: 800,
                            textAlign: 'center',
                            fontSize: '15px', // Larger Room header font
                            letterSpacing: '0.5px',
                          }}
                        >
                          {group.roomId}
                        </td>
                      </tr>

                      {/* Students under this room */}
                      {group.students.map((s, idx) => (
                        <tr key={s.studentId + idx}>
                          <td style={{ border: '1.5px solid #000', padding: '8px 10px', textAlign: 'left' }}>
                            <div style={{ fontWeight: 700, fontSize: '13px', color: '#000' }}>
                              {s.name} {/* ONLY student name, NO college name! */}
                            </div>
                            {s.mobileNo && (
                              <div style={{ fontSize: '11px', color: '#475569', fontWeight: 500, marginTop: '2px' }}>
                                {s.mobileNo}
                              </div>
                            )}
                          </td>
                          <td style={{ border: '1.5px solid #000', padding: '8px 6px', textAlign: 'center', fontSize: '13px' }}>
                            <div>{s.rentDisplay}</div>
                            {s.rentPaidUntilLabel && (
                              <div style={{ fontSize: '11px', color: '#0369a1', fontWeight: 600, marginTop: '2px' }}>
                                Paid till {s.rentPaidUntilLabel}
                              </div>
                            )}
                          </td>
                          <td
                            style={{
                              border: '1.5px solid #000',
                              padding: '8px 6px',
                              textAlign: 'center',
                              fontWeight: 600,
                              fontSize: '12.5px',
                            }}
                          >
                            {s.rentPaidDate ? formatPaymentDate(s.rentPaidDate) : ''}
                          </td>
                          <td style={{ border: '1.5px solid #000', padding: '8px 6px', textAlign: 'center', fontSize: '13px' }}>
                            {s.ebDisplay}
                          </td>
                          <td
                            style={{
                              border: '1.5px solid #000',
                              padding: '8px 6px',
                              textAlign: 'center',
                              fontWeight: 600,
                              fontSize: '12.5px',
                            }}
                          >
                            {s.ebPaidDate ? formatPaymentDate(s.ebPaidDate) : ''}
                          </td>
                          <td style={{ border: '1.5px solid #000', padding: '8px 6px', textAlign: 'center', fontSize: '13px' }}>
                            {s.fineAmount > 0 ? formatAmount(s.fineAmount) : ''}
                          </td>
                          <td
                            style={{
                              border: '1.5px solid #000',
                              padding: '8px 6px',
                              textAlign: 'center',
                              fontWeight: 600,
                              fontSize: '12.5px',
                            }}
                          >
                            {s.finePaidDate ? formatPaymentDate(s.finePaidDate) : ''}
                          </td>
                          <td style={{ border: '1.5px solid #000', padding: '8px 6px', textAlign: 'center', fontSize: '13px' }}>
                            {s.outstandingDisplay}
                          </td>
                          <td
                            style={{
                              border: '1.5px solid #000',
                              padding: '8px 6px',
                              textAlign: 'center',
                              fontWeight: 600,
                              fontSize: '12.5px',
                            }}
                          >
                            {s.outstandingPaidDate ? formatPaymentDate(s.outstandingPaidDate) : ''}
                          </td>
                        </tr>
                      ))}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '12px 22px',
            borderTop: '1px solid #e2e8f0',
            backgroundColor: '#fff',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div style={{ fontSize: '12px', color: '#475569' }}>
            Month: <strong>{monthFullLabel}</strong> &nbsp;•&nbsp;{' '}
            {selectedBlock === 'ALL' ? 'All Blocks' : selectedBlock} &nbsp;•&nbsp;{' '}
            {roomGroups.length} Rooms
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button onClick={onClose} className="ui-btn ui-btn-outline" style={{ cursor: 'pointer', padding: '7px 14px', fontSize: '13px' }}>
              Close
            </button>
            <button
              onClick={handleDownloadPDF}
              className="ui-btn ui-btn-primary"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                backgroundColor: '#1e3a8a',
                borderColor: '#1e3a8a',
                cursor: 'pointer',
                padding: '7px 18px',
                fontSize: '13px',
                fontWeight: 600,
              }}
            >
              <Download size={16} /> Download PDF
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

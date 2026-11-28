import React, { useEffect, useRef, useState } from 'react';
import { X, CheckCircle } from 'lucide-react';
import { FeesAPI } from '../api/fees.api';
import { StudentAPI } from '../api/student.api';
import { toast } from 'react-toastify';
import {
  clearStudentPortalPaymentReturn,
  STUDENT_PORTAL_PAYMENT_RETURN_MOBILE_KEY,
  STUDENT_PORTAL_PAYMENT_RETURN_ORDER_KEY,
} from '../utils/studentPortalPayment';
import { getBillingMonths, isPostpaidPayableFee, resolveFeeBillingMonth, formatBillingMonthShort } from '../utils/billingCycle';
import { sendReceiptViaWhatsApp } from '../utils/whatsappReceipt';

interface RazorpayCheckoutResponse {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

interface RazorpayPaymentFailure {
  error?: { description?: string; reason?: string };
}

interface RazorpayCheckoutInstance {
  open: () => void;
  on: (event: 'payment.failed', handler: (response: RazorpayPaymentFailure) => void) => void;
}

interface RazorpayCheckoutOptions {
  key: string;
  amount: number;
  currency: string;
  order_id: string;
  name: string;
  description: string;
  prefill?: { name?: string; email?: string; contact?: string };
  notes?: Record<string, string>;
  theme?: { color: string };
  handler: (response: RazorpayCheckoutResponse) => void | Promise<void>;
  modal?: { ondismiss?: () => void };
}

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayCheckoutOptions) => RazorpayCheckoutInstance;
  }
}

let razorpayScriptPromise: Promise<void> | null = null;

const loadRazorpayCheckout = () => {
  if (window.Razorpay) return Promise.resolve();
  if (!razorpayScriptPromise) {
    razorpayScriptPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => {
        razorpayScriptPromise = null;
        reject(new Error('Could not load Razorpay Checkout. Check your connection and try again.'));
      };
      document.body.appendChild(script);
    });
  }
  return razorpayScriptPromise;
};

const createPaymentRequestId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `RZP-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;

interface CollectPaymentModalProps {
  fee?: any;
  fees?: any[];
  /**
   * Confirmed payments already made against the outstanding invoices passed in
   * `fee` / `fees`. The modal shows only the remaining balance, and the backend
   * re-validates it again before confirming a new payment.
   */
  outstandingPaid?: number;
  onClose: () => void;
  onSuccess: (paidItems?: any[], paymentMode?: string) => void;
  isStudentMode?: boolean;
  allowPaymentDate?: boolean;
}

const isOutstandingFee = (fee: any) =>
  /\boutstanding\b/i.test(String(fee?.description || '')) ||
  String(fee?.transactionType || '').toUpperCase() === 'OUTSTANDING' ||
  String(fee?.transactionType || '').toUpperCase() === 'BACKLOG';

const roundMoney = (value: number) => Math.round(value * 100) / 100;

const getTodayInput = () => {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
};

const formatDateDMY = (value: string) => {
  const [year, month, day] = String(value || '').split('-').map(Number);
  if (!year || !month || !day) return value;
  return `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year}`;
};

type FineParentType = 'RENT' | 'MESS' | 'EB';

const isFineFee = (fee: any) =>
  String(fee?.transactionType || '').toUpperCase() === 'FINE';

/**
 * New fine rows include the fee type in the description, e.g.
 * "Late fine accumulation - Rent for 7 days overdue (₹10/day)".
 * Returns the parent fee type so the fine can be grouped under it.
 */
const getFineParentType = (fee: any): FineParentType | null => {
  if (!isFineFee(fee)) return null;
  const match = String(fee?.description || '').match(
    /late fine accumulation\s*-\s*(rent|mess|eb)\b/i,
  );
  if (!match) return null;
  const key = match[1].toLowerCase();
  return key === 'rent' ? 'RENT' : key === 'mess' ? 'MESS' : 'EB';
};

const getFeeParentType = (fee: any): FineParentType | null => {
  const type = String(fee?.transactionType || '').toUpperCase();
  if (type.includes('RENT') || type.includes('ADVANCE')) return 'RENT';
  if (type.includes('MESS')) return 'MESS';
  if (type.includes('EB') || type.includes('ELECTRIC')) return 'EB';
  return null;
};

const getFeeLabel = (fee: any) => {
  const fineParent = getFineParentType(fee);
  if (fineParent) {
    const monthLabel = fee?.billingMonth ? formatBillingMonthShort(fee.billingMonth) : '';
    return `${fineParent === 'EB' ? 'EB' : fineParent} FINE${monthLabel ? ` (${monthLabel})` : ''}`;
  }
  return fee?.transactionType || 'FEE';
};

export const CollectPaymentModal: React.FC<CollectPaymentModalProps> = ({
  fee,
  fees,
  outstandingPaid = 0,
  onClose,
  onSuccess,
  isStudentMode,
  allowPaymentDate = false,
}) => {
  const [paymentMode, setPaymentMode] = useState('UPI');
  const [paymentDate, setPaymentDate] = useState(getTodayInput);
  const [fineQuote, setFineQuote] = useState<{
    amount: number;
    currentAmount: number;
    daysOverdue: number;
    dailyFine: number;
    asOfDate: string | null;
    isDoubled?: boolean;
    hasOlderUnpaidDue?: boolean;
    fines: Array<{
      key: 'rent' | 'mess' | 'eb';
      label: string;
      rate: number;
      effectiveRate?: number;
      isDoubled?: boolean;
      regularDays?: number;
      doubledDays?: number;
      dueDate: string;
      daysOverdue: number;
      currentDaysOverdue: number;
      amount: number;
      currentAmount: number;
      months?: Array<{
        billingMonth: string;
        monthLabel: string;
        dueDate: string;
        daysOverdue: number;
        currentDaysOverdue: number;
        rate: number;
        amount: number;
        currentAmount: number;
      }>;
    }>;
    pendingFines: Array<{
      id: string;
      studentId: string;
      amount: number;
      description: string | null;
      status: string;
      billingMonth: string | null;
      dueDate: string | null;
      createdAt: string;
    }>;
  }>({
    amount: 0,
    currentAmount: 0,
    daysOverdue: 0,
    dailyFine: 0,
    asOfDate: null,
    isDoubled: false,
    hasOlderUnpaidDue: false,
    fines: [],
    pendingFines: [],
  });
  const [fineQuoteError, setFineQuoteError] = useState<string | null>(null);
  const [loadingFineQuote, setLoadingFineQuote] = useState(false);
  const [referenceNumber, setReferenceNumber] = useState('');
  const [notes, setNotes] = useState('');
  // Admin-only concession on the selected fees. The net amount is what the
  // student actually pays and what gets stored on the completed fee rows.
  const [discountInput, setDiscountInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [paymentSuccessData, setPaymentSuccessData] = useState<{ updatedItems: any[], paymentMode: string } | null>(null);
  const onlineRequestId = useRef<string | null>(null);
  const onlineOrderId = useRef<string | null>(null);
  const [onlineConfirmationPending, setOnlineConfirmationPending] = useState(false);
  const [fetchedStudentDetails, setFetchedStudentDetails] = useState<any>(null);

  const itemsToPay = fees && fees.length > 0 ? fees : fee ? [fee] : [];
  const rawPrimaryStudent = itemsToPay.length > 0 ? itemsToPay[0].student : null;
  const primaryStudent =
    rawPrimaryStudent && fetchedStudentDetails
      ? { ...rawPrimaryStudent, ...fetchedStudentDetails }
      : fetchedStudentDetails || rawPrimaryStudent;

  useEffect(() => {
    const sid =
      rawPrimaryStudent?.uuid ||
      itemsToPay[0]?.studentId ||
      rawPrimaryStudent?.id;
    const hasRent = Number(rawPrimaryStudent?.rent || rawPrimaryStudent?.room?.rent || 0) > 0;
    const hasPaidUntil = rawPrimaryStudent?.rentPaidUntil !== undefined;
    const hasTransactions = Array.isArray(rawPrimaryStudent?.transactions);
    if (!sid || (hasRent && hasPaidUntil && hasTransactions)) return;

    let active = true;
    StudentAPI.findOne(sid)
      .then((data) => {
        if (active && data) setFetchedStudentDetails(data);
      })
      .catch(() => { });
    return () => {
      active = false;
    };
  }, [rawPrimaryStudent?.id, rawPrimaryStudent?.uuid, itemsToPay[0]?.studentId]);

  // Current-month invoices stay exactly as before. Previous outstanding
  // invoices are consolidated into a single OUTSTANDING item.
  const outstandingItems = itemsToPay.filter(isOutstandingFee);
  // Stored late-fine rows are real dues, so they stay in the list. Their
  // amount is replaced with the fine calculated for the selected receipt
  // date, per fee type (Rent / Mess / EB).
  const currentItems = itemsToPay.filter((f: any) => !isOutstandingFee(f));
  const selectableCurrentItems = isStudentMode
    ? currentItems.filter((f: any) => !(f.transactionType || '').toUpperCase().startsWith('MESS'))
    : currentItems;

  const fineQuoteReady =
    !loadingFineQuote &&
    !fineQuoteError &&
    fineQuote.asOfDate === paymentDate;

  const fineQuoteEntryFor = (fee: any) => {
    const parentType = getFineParentType(fee);
    const key =
      parentType === 'RENT' ? 'rent' : parentType === 'MESS' ? 'mess' : parentType === 'EB' ? 'eb' : null;
    return key ? (fineQuote.fines.find((item) => item.key === key) ?? null) : null;
  };

  const typedFineItems = selectableCurrentItems.filter(
    (fee: any) => isFineFee(fee) && getFineParentType(fee) !== null,
  );

  const legacyLateFineItems = selectableCurrentItems.filter(
    (fee: any) =>
      isFineFee(fee) &&
      getFineParentType(fee) === null &&
      /late fine accumulation/i.test(String(fee?.description || '')),
  );

  const hasFineItems =
    typedFineItems.length > 0 || legacyLateFineItems.length > 0;

  // Older databases keep one combined fine row. The preview splits it into
  // one row per fee type on first open, so show those rows (each with its own
  // checkbox) instead of the stale combined row.
  const shouldUseSplitFineRows =
    typedFineItems.length === 0 &&
    legacyLateFineItems.length > 0 &&
    fineQuote.pendingFines.length > 0;

  const legacyLateFineIds = new Set(
    legacyLateFineItems.map((fee: any) => fee.id),
  );

  const displayCurrentItems = shouldUseSplitFineRows
    ? [
      ...selectableCurrentItems.filter(
        (fee: any) => !legacyLateFineIds.has(fee.id),
      ),
      ...fineQuote.pendingFines.map((row) => ({
        ...legacyLateFineItems[0],
        id: row.id,
        amount: Number(row.amount) || 0,
        description: row.description,
        status: 'PENDING',
        billingMonth: row.billingMonth ?? legacyLateFineItems[0].billingMonth,
        dueDate: row.dueDate ?? legacyLateFineItems[0].dueDate,
        fineMigrated: true,
      })),
    ]
    : selectableCurrentItems;

  /**
   * Returns the date-based amount for a stored FINE row.
   * Typed rows use their own fee type; older untagged rows use the total, or
   * the remaining total when typed fine rows also exist.
   */
  const fineQuoteFor = (fee: any) => {
    if (!fineQuoteReady) return null;

    const entry = fineQuoteEntryFor(fee);
    if (entry) {
      const feeMonth = resolveFeeBillingMonth(fee);
      const monthMatch =
        feeMonth && Array.isArray(entry.months) && entry.months.length > 0
          ? entry.months.find((m) => m.billingMonth === feeMonth)
          : null;

      if (monthMatch) {
        return {
          amount: monthMatch.amount,
          daysOverdue: monthMatch.daysOverdue,
          currentAmount: monthMatch.currentAmount,
          rate: monthMatch.rate,
          effectiveRate: monthMatch.rate,
          monthLabel: monthMatch.monthLabel,
          dueDate: monthMatch.dueDate,
          isDoubled: false,
        };
      }

      return {
        amount: entry.amount,
        daysOverdue: entry.daysOverdue,
        currentAmount: entry.currentAmount,
        rate: entry.rate,
        effectiveRate: entry.rate,
        isDoubled: false,
      };
    }
    if (getFineParentType(fee) !== null) {
      // A typed fine without its own quote basis keeps the stored amount.
      return null;
    }

    // Untagged legacy fine row: it represents the combined fine.
    const typedAmount = roundMoney(
      typedFineItems.reduce((sum: number, item: any) => {
        const itemEntry = fineQuoteEntryFor(item);
        return sum + (itemEntry ? itemEntry.amount : 0);
      }, 0),
    );
    return {
      amount:
        typedFineItems.length > 0
          ? roundMoney(Math.max(0, fineQuote.amount - typedAmount))
          : fineQuote.amount,
      daysOverdue: fineQuote.daysOverdue,
      currentAmount: fineQuote.currentAmount,
      rate: fineQuote.dailyFine,
      effectiveRate: fineQuote.dailyFine,
      isDoubled: false,
    };
  };

  const payableCurrentItems = displayCurrentItems.map((f: any) => {
    if (!isFineFee(f)) return f;
    const quote = fineQuoteFor(f);
    if (!quote) return f;
    return {
      ...f,
      amount: quote.amount,
      originalAmount: Number(f.amount) || 0,
      fineQuote: quote,
    };
  });

  // POSTPAID colleges bill the postpaid month (previous month). PREPAID
  // colleges pay current-month rent but receive previous-month EB and fine.
  // Keep only fees payable in the current cycle; leave the rest out of payment.
  const collegeCycle = (primaryStudent?.college?.billingCycle || 'PREPAID').toUpperCase();
  const billingMonths = getBillingMonths();
  const currentBillingMonth = billingMonths.currentMonthStr;
  const previousBillingMonth = billingMonths.previousMonthStr;
  const isPayableInCycle = (f: any) => {
    if (f?.isUpcomingAdvanceRent) return true;
    const feeMonth = resolveFeeBillingMonth(f);
    if (!feeMonth) return true;
    const type = String(f?.transactionType || '').toUpperCase();
    if (type === 'ADVANCE') return true;
    const isRentLike = type.includes('RENT') || type.includes('ADVANCE');
    const isEb = type.includes('EB') || type.includes('ELECTRIC');
    const isFine = type.includes('FINE');

    if (collegeCycle === 'POSTPAID') {
      return isPostpaidPayableFee(f, previousBillingMonth);
    }

    // PREPAID pays current-month rent in advance; EB from previous/current
    // month is collected now; any overdue pending fine remains payable.
    if (isFine) return true;
    if (isRentLike) return feeMonth === currentBillingMonth;
    if (isEb) return feeMonth === previousBillingMonth || feeMonth === currentBillingMonth;
    return feeMonth === previousBillingMonth || feeMonth === currentBillingMonth;
  };
  const filteredPayableItems = payableCurrentItems.filter(isPayableInCycle);

  const hasUpcomingMonthItems = payableCurrentItems.some(
    (f: any) => !isPayableInCycle(f),
  );

  // Original outstanding invoice amounts minus payments already confirmed by
  // the backend. Invoices are never mutated, so this is the only safe way to
  // show the true remaining balance.
  const outstandingBalance = roundMoney(
    Math.max(
      0,
      outstandingItems.reduce(
        (sum: number, f: any) => sum + (Number(f.amount) || 0),
        0,
      ) - (Number(outstandingPaid) || 0),
    ),
  );

  // A stable id makes retries / double-submits idempotent on the backend.
  const [requestId] = useState(
    () => `OP-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
  );

  const [months, setMonths] = useState(1);
  const [upcomingMonths, setUpcomingMonths] = useState(0);
  // When previous outstanding dues exist, start on the OUTSTANDING item and
  // leave current-month rent / mess / EB unchecked. Paying an outstanding
  // amount must not mark current invoices as paid.
  const hasOutstandingItems = outstandingItems.length > 0 && outstandingBalance > 0;
  const [outstandingSelected, setOutstandingSelected] = useState<boolean>(hasOutstandingItems);
  const [outstandingAmountInput, setOutstandingAmountInput] = useState(() =>
    isStudentMode && hasOutstandingItems ? String(outstandingBalance) : '',
  );
  const [feeStates, setFeeStates] = useState<Record<string, { selected: boolean }>>(() => {
    const initialState: Record<string, { selected: boolean }> = {};
    filteredPayableItems.forEach((f: any) => {
      initialState[f.id] = { selected: !hasOutstandingItems };
    });
    return initialState;
  });

  const isItemSelected = (f: any) => feeStates[f.id]?.selected !== false;

  // Each typed fine belongs to its parent fee (matching billing month first).
  const linkedParentOfFine = (fine: any) => {
    const type = getFineParentType(fine);
    if (!type) return null;
    const fineMonth = resolveFeeBillingMonth(fine);
    if (fineMonth) {
      const exactMatch = filteredPayableItems.find(
        (f: any) =>
          !isFineFee(f) &&
          getFeeParentType(f) === type &&
          resolveFeeBillingMonth(f) === fineMonth,
      );
      if (exactMatch) return exactMatch;
    }
    return (
      filteredPayableItems.find(
        (f: any) => !isFineFee(f) && getFeeParentType(f) === type,
      ) || null
    );
  };

  const displayItems = filteredPayableItems.filter((f: any) => {
    if (!isFineFee(f)) return true;
    const parent = linkedParentOfFine(f);
    if (!parent) return true; // orphan fine stays payable
    return isItemSelected(parent);
  });

  const orderedDisplayItems: any[] = [];
  const placedFineIds = new Set<string>();
  displayItems
    .filter((f: any) => !isFineFee(f))
    .forEach((parent: any) => {
      orderedDisplayItems.push(parent);
      const parentType = getFeeParentType(parent);
      if (!parentType) return;
      displayItems
        .filter(
          (f: any) =>
            isFineFee(f) &&
            !placedFineIds.has(f.id) &&
            linkedParentOfFine(f)?.id === parent.id,
        )
        .forEach((fine: any) => {
          orderedDisplayItems.push(fine);
          placedFineIds.add(fine.id);
        });
    });
  displayItems.forEach((f: any) => {
    if (isFineFee(f) && !placedFineIds.has(f.id)) orderedDisplayItems.push(f);
  });

  const activeItemsToPay = displayItems.filter((f: any) => isItemSelected(f));

  useEffect(() => {
    const targetStudentId =
      primaryStudent?.uuid ||
      itemsToPay[0]?.studentId ||
      itemsToPay[0]?.student?.uuid ||
      itemsToPay[0]?.student?.id ||
      primaryStudent?.id;
    if (!targetStudentId) return;

    let active = true;
    setLoadingFineQuote(true);
    setFineQuoteError(null);
    FeesAPI.previewFine(targetStudentId, paymentDate)
      .then((quote) => {
        if (active) {
          setFineQuote({
            amount: Number(quote.amount) || 0,
            currentAmount: Number(quote.currentAmount) || 0,
            daysOverdue: Number(quote.daysOverdue) || 0,
            dailyFine: Number(quote.dailyFine) || 0,
            asOfDate: quote.asOfDate || paymentDate,
            fines: Array.isArray(quote.fines) ? quote.fines : [],
            pendingFines: Array.isArray(quote.pendingFines) ? quote.pendingFines : [],
          });
        }
      })
      .catch((error: unknown) => {
        if (active) {
          setFineQuoteError(
            error instanceof Error ? error.message : 'Unable to calculate fine for this date.',
          );
          setFineQuote((prev) => ({ ...prev, asOfDate: null }));
        }
      })
      .finally(() => {
        if (active) setLoadingFineQuote(false);
      });

    return () => {
      active = false;
    };
  }, [primaryStudent?.id, paymentDate]);

  const getMultiplier = (type: string) => {
    const t = (type || '').toUpperCase().trim();
    if (t !== 'RENT' && t !== 'MESS') return 1;
    return months;
  };

  const availableAdvanceBalance = roundMoney(
    Number(primaryStudent?.advanceRentBalance || 0),
  );

  const getItemCalculatedAmount = (f: any) => {
    const t = String(f?.transactionType || '').toUpperCase().trim();
    const mult = getMultiplier(t);
    if (t === 'RENT' && !f?.isUpcomingAdvanceRent && mult > 1) {
      const startYm = resolveFeeBillingMonth(f) || (collegeCycle === 'POSTPAID' ? previousBillingMonth : currentBillingMonth);
      const match = String(startYm || '').match(/^(\d{4})-(\d{1,2})$/);
      const startY = match ? Number(match[1]) : new Date().getFullYear();
      const startM = match ? Number(match[2]) : new Date().getMonth() + 1;
      const allTxs = Array.isArray(primaryStudent?.transactions) ? primaryStudent.transactions : [];
      const fallbackRent = roundMoney(Number(primaryStudent?.rent || primaryStudent?.room?.rent || f.amount || 0));
      let total = 0;
      for (let k = 0; k < mult; k++) {
        if (k === 0) {
          total += Number(f.amount || 0);
          continue;
        }
        const totalMonths = startM - 1 + k;
        const y = startY + Math.floor(totalMonths / 12);
        const m = (totalMonths % 12) + 1;
        const ym = `${y}-${String(m).padStart(2, '0')}`;
        const futurePending = allTxs.find(
          (tx: any) =>
            tx &&
            tx.id !== f.id &&
            tx.status === 'PENDING' &&
            String(tx.transactionType || '').toUpperCase().trim() === 'RENT' &&
            resolveFeeBillingMonth(tx) === ym,
        );
        total += futurePending ? Number(futurePending.amount || 0) : fallbackRent;
      }
      return roundMoney(total);
    }
    const gross = roundMoney(Number(f.amount || 0) * mult);
    if (f?.isUpcomingAdvanceRent && availableAdvanceBalance > 0) {
      return roundMoney(Math.max(0, gross - Math.min(availableAdvanceBalance, gross)));
    }
    return gross;
  };

  const currentMonthTotal = activeItemsToPay.reduce((acc: number, f: any) => acc + getItemCalculatedAmount(f), 0);

  // Outstanding amount validation
  const outstandingInputTrimmed = outstandingAmountInput.trim();
  let outstandingError: string | null = null;
  if (outstandingSelected && outstandingInputTrimmed !== '') {
    const parsed = Number(outstandingInputTrimmed);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      outstandingError = 'Enter an amount greater than ₹0.';
    } else if (parsed > outstandingBalance + 0.001) {
      outstandingError = `Amount cannot exceed the remaining outstanding balance of ₹${outstandingBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}.`;
    }
  }

  const outstandingAmount =
    outstandingSelected && !outstandingError && outstandingInputTrimmed !== ''
      ? Math.min(roundMoney(Number(outstandingInputTrimmed)), outstandingBalance)
      : 0;

  const hasOutstandingPayment = outstandingAmount > 0;

  const hasCurrentRentItem = selectableCurrentItems.some(
    (f: any) => (f.transactionType || '').toUpperCase().trim() === 'RENT',
  );
  const studentMonthlyRent = roundMoney(
    Number(primaryStudent?.rent || primaryStudent?.room?.rent || 0),
  );
  const basePayableMonthStr =
    collegeCycle === 'POSTPAID' ? previousBillingMonth : currentBillingMonth;
  const nextUpcomingMonthStr = (() => {
    let latestYM = basePayableMonthStr;
    if (primaryStudent?.rentPaidUntil) {
      const d = new Date(primaryStudent.rentPaidUntil);
      if (!Number.isNaN(d.getTime())) {
        const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        if (ym > latestYM) latestYM = ym;
      }
    }
    const [yStr, mStr] = latestYM.split('-');
    const y = Number(yStr);
    const m = Number(mStr);
    const nextY = m === 12 ? y + 1 : y;
    const nextM = m === 12 ? 1 : m + 1;
    return `${nextY}-${String(nextM).padStart(2, '0')}`;
  })();
  const canPayUpcomingRent = !hasCurrentRentItem && studentMonthlyRent > 0;
  const grossUpcomingRentAmount =
    canPayUpcomingRent && upcomingMonths > 0
      ? roundMoney(studentMonthlyRent * upcomingMonths)
      : 0;
  const upcomingAdvanceCreditUsed =
    canPayUpcomingRent && upcomingMonths > 0
      ? roundMoney(Math.min(availableAdvanceBalance, grossUpcomingRentAmount))
      : 0;
  const upcomingRentAmount = roundMoney(
    Math.max(0, grossUpcomingRentAmount - upcomingAdvanceCreditUsed),
  );
  const hasUpcomingRentPayment = upcomingRentAmount > 0;

  const subTotalAmount = roundMoney(currentMonthTotal + outstandingAmount + upcomingRentAmount);

  // Discount is only offered by the admin (offline collection). It reduces the
  // amount actually collected; the original amount is kept in the fee
  // description so the receipt can show both the gross and the net figure.
  const discountInputTrimmed = discountInput.trim();
  let discountError: string | null = null;
  if (discountInputTrimmed !== '') {
    const parsed = Number(discountInputTrimmed);
    if (!Number.isFinite(parsed) || parsed < 0) {
      discountError = 'Enter a valid discount amount.';
    } else if (parsed >= subTotalAmount) {
      discountError = `Discount must be less than the total fees of ₹${subTotalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}.`;
    }
  }
  const discountAmount =
    !isStudentMode && !discountError && discountInputTrimmed !== ''
      ? roundMoney(Number(discountInputTrimmed))
      : 0;
  const totalAmount = roundMoney(Math.max(0, subTotalAmount - discountAmount));
  const remainingOutstanding = roundMoney(Math.max(0, outstandingBalance - outstandingAmount));

  // Dues still left after this payment: unchecked current fees plus whatever
  // remains of the previous outstanding balance. This is printed on the receipt.
  const pendingBalance = roundMoney(
    displayItems
      .filter((f: any) => !isItemSelected(f))
      .reduce((sum: number, f: any) => sum + f.amount * getMultiplier(f.transactionType), 0) +
    remainingOutstanding,
  );

  const getStartMonthYear = (startDesc: string, billingMonth?: string | null) => {
    const bmMatch = String(billingMonth || '').trim().match(/^(\d{4})-(\d{1,2})$/);
    if (bmMatch) {
      return {
        startYear: parseInt(bmMatch[1], 10),
        startMonthIndex: Math.max(0, Math.min(11, parseInt(bmMatch[2], 10) - 1)),
      };
    }

    let startMonthIndex = new Date().getMonth();
    let startYear = new Date().getFullYear();

    const yearMatch = startDesc.match(/\b(20\d{2})\b/);
    if (yearMatch) {
      startYear = parseInt(yearMatch[1], 10);
    }

    const fullMonthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    for (let i = 0; i < fullMonthNames.length; i++) {
      if (startDesc.includes(fullMonthNames[i])) {
        startMonthIndex = i;
        break;
      }
    }

    return { startYear, startMonthIndex };
  };

  const getMonthNames = (count: number, startDesc: string, billingMonth?: string | null) => {
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const { startYear, startMonthIndex } = getStartMonthYear(startDesc, billingMonth);

    if (count === 1) {
      return `${monthNames[startMonthIndex]} ${startYear}`;
    }

    const endMonthIndex = (startMonthIndex + count - 1) % 12;
    const endYear = startYear + Math.floor((startMonthIndex + count - 1) / 12);

    return `${monthNames[startMonthIndex]} - ${monthNames[endMonthIndex]} ${endYear}`;
  };

  const handleOutstandingAmountChange = (value: string) => {
    if (value === '') {
      setOutstandingAmountInput('');
      return;
    }
    // Only non-negative amounts with at most two decimal places are allowed.
    if (!/^\d*\.?\d{0,2}$/.test(value)) return;
    setOutstandingAmountInput(value);
  };

  const handleDiscountChange = (value: string) => {
    if (value === '') {
      setDiscountInput('');
      return;
    }
    // Only non-negative amounts with at most two decimal places are allowed.
    if (!/^\d*\.?\d{0,2}$/.test(value)) return;
    setDiscountInput(value);
  };

  const handleSubmit = async () => {
    if (outstandingSelected && outstandingError) {
      toast.error(outstandingError);
      return;
    }
    if (discountError) {
      toast.error(discountError);
      return;
    }
    if (activeItemsToPay.length === 0 && !hasOutstandingPayment && !hasUpcomingRentPayment) {
      toast.error('Please select at least one fee, an outstanding amount, or upcoming rent months.');
      return;
    }

    const studentId =
      primaryStudent?.uuid ||
      itemsToPay[0]?.studentId ||
      itemsToPay[0]?.student?.uuid ||
      itemsToPay[0]?.student?.id ||
      primaryStudent?.id;

    if (hasOutstandingPayment && !studentId) {
      toast.error('Unable to identify the student for this payment.');
      return;
    }

    // activeItemsToPay is already limited to the previous billing month for
    // POSTPAID colleges, so nothing more to check here.

    setIsSubmitting(true);
    try {
      let studentUpdates: any = {};
      const selectedPaidDate = new Date(`${paymentDate}T12:00:00`).toISOString();

      const effectivePaymentMode = paymentMode;

      const effectiveRef = isStudentMode && !referenceNumber
        ? 'TXN' + Math.floor(Math.random() * 10000000000).toString()
        : referenceNumber;

      // Share the net amount across all lines of this payment. The gross line
      // amount and the concession are kept in the description so the receipt
      // can print both, while the stored amount stays the real money received.
      const grossParts = [
        ...activeItemsToPay.map((f: any) => getItemCalculatedAmount(f)),
        ...(hasOutstandingPayment ? [outstandingAmount] : []),
        ...(hasUpcomingRentPayment ? [upcomingRentAmount] : []),
      ];
      const grossTotal = roundMoney(grossParts.reduce((sum, value) => sum + value, 0));
      const allocateAcrossGross = (pool: number) => {
        if (pool <= 0 || grossTotal <= 0) return grossParts.map(() => 0);
        let allocated = 0;
        return grossParts.map((part, index) => {
          if (index === grossParts.length - 1) {
            return Math.max(0, roundMoney(pool - allocated));
          }
          const share = roundMoney((part / grossTotal) * pool);
          allocated = roundMoney(allocated + share);
          return share;
        });
      };
      const discountParts = allocateAcrossGross(discountAmount);
      const netParts = grossParts.map((part, index) =>
        Math.max(0, roundMoney(part - discountParts[index])),
      );
      const receiptMeta = (gross: number, lineDiscount: number) => {
        // [PAY:...] ties every row of one submission together so separate
        // payments made within the same minute never merge into one receipt.
        return [
          `Original Amount: ${gross}`,
          `Discount: ${lineDiscount}`,
          `Pending Balance: ${pendingBalance}`,
          `[PAY:${requestId}]`,
        ].join(' | ');
      };

      const currentUpdatedItems = await Promise.all(activeItemsToPay.map(async (f: any, index: number) => {
        let finalDesc = f.description || '';
        const ref = effectiveRef;
        if (ref) finalDesc += ` | Ref: ${ref}`;
        if (notes) finalDesc += ` | Notes: ${notes}`;
        const currentMultiplier = getMultiplier(f.transactionType);
        if (currentMultiplier > 1) {
          const coveredMonths = getMonthNames(currentMultiplier, f.description || '', resolveFeeBillingMonth(f));
          finalDesc += ` | Paid for ${currentMultiplier} Months (${coveredMonths})`;
        }
        finalDesc += ` | ${receiptMeta(grossParts[index], discountParts[index])}`;

        const tType = (f.transactionType || '').toUpperCase();
        if (tType.includes('RENT') || tType.includes('MESS')) {
          const { startYear, startMonthIndex } = getStartMonthYear(
            f.description || '',
            resolveFeeBillingMonth(f),
          );

          const endMonthIndex = startMonthIndex + currentMultiplier - 1;
          const endYear = startYear + Math.floor(endMonthIndex / 12);
          const finalEndMonth = endMonthIndex % 12;

          // Use noon of the last day of the month to avoid timezone shifts
          const paidUntil = new Date(endYear, finalEndMonth + 1, 0, 12, 0, 0);

          if (tType.includes('RENT')) {
            studentUpdates.rentPaidUntil = paidUntil;
          }
          if (tType.includes('MESS')) {
            studentUpdates.messPaidUntil = paidUntil;
          }
        }

        const updated = f.isUpcomingAdvanceRent
          ? await FeesAPI.create({
            studentId: f.studentId || primaryStudent?.uuid || primaryStudent?.id,
            transactionType: 'RENT',
            amount: netParts[index],
            status: 'COMPLETED',
            paymentMode: effectivePaymentMode,
            paidDate: selectedPaidDate,
            billingMonth: f.billingMonth,
            description: finalDesc,
          })
          : await FeesAPI.update(f.id, {
            status: 'COMPLETED',
            paymentMode: effectivePaymentMode,
            paidDate: selectedPaidDate,
            amount: netParts[index],
            description: finalDesc,
          });
        return { ...updated, student: updated.student || f.student };
      }));

      // Apply the outstanding payment through the dedicated backend endpoint.
      // The backend re-validates the amount against the live balance inside a
      // serializable transaction before anything is changed.
      let outstandingRecords: any[] = [];
      const settledOutstandingAmount = roundMoney(
        netParts[activeItemsToPay.length] || 0,
      );
      if (hasOutstandingPayment && settledOutstandingAmount > 0) {
        const outIdx = activeItemsToPay.length;
        const outstandingDiscount = discountParts[outIdx] || 0;
        // The backend appends these as its own "| Notes: ..." segment, so the
        // receipt parser can read them exactly like the current fee rows.
        const outstandingNotes = [
          notes,
          `Original Amount: ${outstandingAmount}`,
          `Discount: ${outstandingDiscount}`,
          `Pending Balance: ${pendingBalance}`,
          `[PAY:${requestId}]`,
        ].filter(Boolean).join(' | ');
        const response = await FeesAPI.payOutstanding({
          studentId,
          amount: settledOutstandingAmount,
          paymentMode: effectivePaymentMode,
          referenceNumber: effectiveRef || undefined,
          notes: outstandingNotes,
          requestId,
          paidDate: selectedPaidDate,
        });

        const studentForReceipt = primaryStudent || itemsToPay[0]?.student;
        outstandingRecords = (response?.payments || []).map((p: any) => ({
          ...p,
          student: p.student || studentForReceipt,
        }));
      }

      const targetStudentId =
        primaryStudent?.uuid ||
        itemsToPay[0]?.studentId ||
        itemsToPay[0]?.student?.uuid ||
        itemsToPay[0]?.student?.id ||
        primaryStudent?.id;

      let upcomingRentRecords: any[] = [];
      if (hasUpcomingRentPayment && targetStudentId) {
        const upIdx = activeItemsToPay.length + (hasOutstandingPayment ? 1 : 0);
        const upGross = grossParts[upIdx] || upcomingRentAmount;
        const upDiscount = discountParts[upIdx] || 0;
        const upNet = netParts[upIdx] ?? upGross;
        const coveredMonthsLabel = getMonthNames(upcomingMonths, '', nextUpcomingMonthStr);
        const startMonthLong = formatCyclePeriod(nextUpcomingMonthStr, 1);
        const [syStr, smStr] = nextUpcomingMonthStr.split('-');
        const startY = Number(syStr);
        const startM = Number(smStr) - 1;
        const endMonthIdx = startM + upcomingMonths - 1;
        const endY = startY + Math.floor(endMonthIdx / 12);
        const endM = endMonthIdx % 12;
        studentUpdates.rentPaidUntil = new Date(endY, endM + 1, 0, 12, 0, 0);

        const upDescParts = [
          `Room Rent for ${startMonthLong}`,
          ...(effectiveRef ? [`Ref: ${effectiveRef}`] : []),
          ...(notes ? [`Notes: ${notes}`] : []),
          ...(upcomingMonths > 1 ? [`Paid for ${upcomingMonths} Months (${coveredMonthsLabel})`] : []),
          receiptMeta(upGross, upDiscount),
        ];

        const createdUpcoming = await FeesAPI.create({
          studentId: targetStudentId,
          transactionType: 'RENT',
          amount: upNet,
          status: 'COMPLETED',
          paymentMode: effectivePaymentMode,
          paidDate: selectedPaidDate,
          billingMonth: nextUpcomingMonthStr,
          description: upDescParts.join(' | '),
        });
        if (createdUpcoming) {
          const studentForReceipt = primaryStudent || itemsToPay[0]?.student;
          upcomingRentRecords = [{ ...createdUpcoming, student: createdUpcoming.student || studentForReceipt }];
        }
      }

      if (targetStudentId && Object.keys(studentUpdates).length > 0) {
        await StudentAPI.update(targetStudentId, studentUpdates);
      }

      const paidCount =
        activeItemsToPay.length +
        (hasOutstandingPayment ? 1 : 0) +
        (hasUpcomingRentPayment ? 1 : 0);
      toast.success(`Payment collected successfully for ${paidCount} item(s)!`);

      // Instead of calling onSuccess immediately, we show the success confirmation state
      setPaymentSuccessData({
        updatedItems: [...currentUpdatedItems, ...outstandingRecords, ...upcomingRentRecords],
        paymentMode: effectivePaymentMode,
      });
    } catch (e: any) {
      toast.error('Failed to collect payment: ' + e.message);
    }
    setIsSubmitting(false);
  };

  const applyOnlinePaymentResult = (result: any, studentId: string) => {
    if (result.refundRequired) {
      setOnlineConfirmationPending(true);
      toast.error(
        `Captured payment ${result.paymentId || ''} needs hostel-office reconciliation. Do not pay again.`,
        { autoClose: false },
      );
      return true;
    }

    if (result.status !== 'PAID' && !result.payments?.length) return false;

    const paidItems = (result.payments || []).map((item: any) => ({
      ...item,
      student: item.student || primaryStudent,
    }));
    sessionStorage.removeItem(`razorpay_pending_order_${studentId}`);
    onlineOrderId.current = null;
    setOnlineConfirmationPending(false);
    toast.success('Online payment verified successfully.');
    setPaymentSuccessData({
      updatedItems: paidItems,
      paymentMode: 'RAZORPAY',
    });
    return true;
  };

  const checkOnlinePaymentStatus = async (
    orderId: string,
    studentId: string,
    failureMessage?: string,
  ) => {
    setIsSubmitting(true);
    setOnlineConfirmationPending(true);
    try {
      const result = await FeesAPI.reconcileRazorpayOrder({ orderId });
      if (applyOnlinePaymentResult(result, studentId)) return;

      if (
        result.paymentStatus === 'failed' ||
        result.paymentStatus === 'abandoned' ||
        (result.attemptCount !== undefined && Number(result.attemptCount) === 0)
      ) {
        sessionStorage.removeItem(`razorpay_pending_order_${studentId}`);
        clearStudentPortalPaymentReturn();
        onlineOrderId.current = null;
        onlineRequestId.current = null;
        setOnlineConfirmationPending(false);
        toast.info(
          failureMessage ||
            (result.paymentStatus === 'abandoned' || Number(result.attemptCount) === 0
              ? 'Payment was cancelled. You can try again or close this window.'
              : 'No successful payment was found. You can try the payment again.'),
        );
        return;
      }

      toast.info(
        'Payment is not confirmed yet. Do not pay again; check the status again shortly.',
        { autoClose: false },
      );
    } catch (error: any) {
      toast.error(
        `Could not confirm payment status. Do not pay again until it is checked. ${error.message || ''}`,
        { autoClose: false },
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOnlinePayment = async () => {
    if (!isStudentMode) return;
    if (outstandingSelected && outstandingError) {
      toast.error(outstandingError);
      return;
    }
    if (activeItemsToPay.length === 0 && !hasOutstandingPayment && !hasUpcomingRentPayment) {
      toast.error('Please select at least one fee, an outstanding amount, or upcoming rent months.');
      return;
    }

    const studentId =
      primaryStudent?.uuid ||
      itemsToPay[0]?.studentId ||
      itemsToPay[0]?.student?.uuid ||
      itemsToPay[0]?.student?.id ||
      primaryStudent?.id;
    if (!studentId) {
      toast.error('Unable to identify the student for this payment.');
      return;
    }

    setIsSubmitting(true);
    try {
      await loadRazorpayCheckout();
      if (!window.Razorpay) {
        throw new Error('Razorpay Checkout did not initialize. Please try again.');
      }

      const order = await FeesAPI.createRazorpayOrder({
        studentId,
        feeItems: [
          ...activeItemsToPay.map(item => ({
            feeId: item.isUpcomingAdvanceRent ? '__UPCOMING_RENT__' : item.id,
            months: getMultiplier(item.transactionType),
            ...(item.isUpcomingAdvanceRent && item.billingMonth ? { billingMonth: item.billingMonth } : {}),
          })),
          ...(hasUpcomingRentPayment
            ? [{ feeId: '__UPCOMING_RENT__', months: upcomingMonths, billingMonth: nextUpcomingMonthStr }]
            : []),
        ],
        outstandingAmount: hasOutstandingPayment ? outstandingAmount : 0,
        requestId:
          onlineRequestId.current ||
          (onlineRequestId.current = createPaymentRequestId()),
      });
      onlineOrderId.current = order.orderId;
      sessionStorage.setItem(`razorpay_pending_order_${studentId}`, order.orderId);
      if (primaryStudent?.mobileNo) {
        localStorage.setItem(
          STUDENT_PORTAL_PAYMENT_RETURN_MOBILE_KEY,
          primaryStudent.mobileNo,
        );
        localStorage.setItem(
          STUDENT_PORTAL_PAYMENT_RETURN_ORDER_KEY,
          order.orderId,
        );
      }

      let paymentHandled = false;
      const checkout = new window.Razorpay({
        key: order.keyId,
        amount: order.amount,
        currency: order.currency,
        order_id: order.orderId,
        name: 'VSR Hostel Management',
        description: `Hostel fees for ${primaryStudent?.name || 'student'}`,
        prefill: {
          name: primaryStudent?.name || order.studentName,
          email: primaryStudent?.emailId || order.email,
          contact: primaryStudent?.mobileNo || order.contact,
        },
        notes: { studentId },
        theme: { color: '#2563eb' },
        handler: async response => {
          paymentHandled = true;
          try {
            const result = await FeesAPI.verifyRazorpayPayment(response);
            if (!applyOnlinePaymentResult(result, studentId)) {
              await checkOnlinePaymentStatus(order.orderId, studentId);
            }
          } catch {
            await checkOnlinePaymentStatus(order.orderId, studentId);
          } finally {
            setIsSubmitting(false);
          }
        },
        modal: {
          ondismiss: () => {
            if (!paymentHandled) {
              void checkOnlinePaymentStatus(order.orderId, studentId);
            }
          },
        },
      });
      checkout.on('payment.failed', response => {
        paymentHandled = true;
        void checkOnlinePaymentStatus(
          order.orderId,
          studentId,
          response.error?.description || 'Razorpay could not complete the payment.',
        );
      });
      checkout.open();
    } catch (error: any) {
      onlineRequestId.current = null;
      setIsSubmitting(false);
      toast.error(error.message || 'Could not start online payment.');
    }
  };

  // The month shown in the modal must match the payable cycle:
  //   Upcoming advance rent -> starts from the next unpaid month
  //   PREPAID  -> current month
  //   POSTPAID -> previous month
  const upcomingRentItem = itemsToPay.find((f: any) => f?.isUpcomingAdvanceRent);
  const payableMonthStr = upcomingRentItem?.billingMonth
    ? upcomingRentItem.billingMonth
    : (collegeCycle === 'POSTPAID' ? previousBillingMonth : currentBillingMonth);
  const monthNamesShort = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const formatCyclePeriod = (startMonth: string, count: number) => {
    const match = String(startMonth || '').match(/^(\d{4})-(\d{2})$/);
    const now = new Date();
    const year = match ? Number(match[1]) : now.getFullYear();
    const monthIndex = match ? Number(match[2]) - 1 : now.getMonth();
    if (count <= 1) return `${monthNamesShort[monthIndex]} ${year}`;
    const endIndex = (monthIndex + count - 1) % 12;
    const endYear = year + Math.floor((monthIndex + count - 1) / 12);
    return `${monthNamesShort[monthIndex]} - ${monthNamesShort[endIndex]} ${endYear}`;
  };

  const currentMonthStr = itemsToPay.length > 0 ? formatCyclePeriod(payableMonthStr, 1) : '';
  const coveredPeriodStr = itemsToPay.length > 0 ? formatCyclePeriod(payableMonthStr, months) : '';

  const selectedTypes = activeItemsToPay.map(f => {
    const fineParent = getFineParentType(f);
    if (fineParent) return `${fineParent === 'EB' ? 'EB' : fineParent} Fine`;

    const t = (f.transactionType || '').toUpperCase();
    if (t.includes('RENT')) return 'Rent';
    if (t.includes('MESS')) return 'Mess';
    if (t.includes('FINE')) return 'Fine';
    if (t.includes('ADVANCE')) return 'Advance';
    return f.transactionType;
  });
  if (hasOutstandingPayment) selectedTypes.push('Outstanding');
  if (hasUpcomingRentPayment) selectedTypes.push(`Upcoming Rent (${upcomingMonths}M)`);
  const uniqueTypes = Array.from(new Set(selectedTypes));
  const summaryText = uniqueTypes.length > 0 ? `Selected: ${uniqueTypes.join(' + ')}` : 'No fees selected';

  const allCurrentSelected =
    filteredPayableItems.length > 0 &&
    filteredPayableItems.every((item: any) => isItemSelected(item));

  const toggleAllCurrentFees = () => {
    const nextSelected = !allCurrentSelected;
    setFeeStates(() => {
      const next: Record<string, { selected: boolean }> = {};
      filteredPayableItems.forEach((item: any) => {
        next[item.id] = { selected: nextSelected };
      });
      return next;
    });
  };

  const outstandingInvalid = outstandingSelected && outstandingInputTrimmed !== '' && outstandingError !== null;
  const discountInvalid = !isStudentMode && discountInputTrimmed !== '' && discountError !== null;
  // The fine quote is fetched for every student, including the portal. Block
  // submission while it is loading; a failed quote only blocks payment when
  // there is actually a fine to recalculate (otherwise stored amounts are safe).
  const fineQuoteBlocked =
    loadingFineQuote || (fineQuoteError !== null && hasFineItems);
  const canSubmit =
    !isSubmitting &&
    !onlineConfirmationPending &&
    !fineQuoteBlocked &&
    !outstandingInvalid &&
    !discountInvalid &&
    (activeItemsToPay.length > 0 || hasOutstandingPayment || hasUpcomingRentPayment);

  if (itemsToPay.length === 0) return null;

  // If the student also has fees from another billing month, they are not
  // collectable in this cycle. Explain which month is payable.
  const upcomingMonthBanner = hasUpcomingMonthItems ? (
    <div style={{ background: '#fef3c7', border: '1px solid #f59e0b', color: '#92400e', padding: '10px 16px', fontSize: '13px', fontWeight: 600 }}>
      Only {currentMonthStr} dues are payable now. Fees from other months are not included in this payment.
    </div>
  ) : null;

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
      <div style={{ background: '#ffffff', padding: '0', borderRadius: '16px', width: '520px', maxWidth: '100%', overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', maxHeight: '90vh' }}>

        {upcomingMonthBanner}

        {paymentSuccessData ? (
          <div style={{ padding: '50px 30px', textAlign: 'center' }}>
            <CheckCircle size={64} color="#16a34a" style={{ margin: '0 auto 20px' }} />
            <h2 style={{ fontSize: '24px', fontWeight: 800, color: '#0f172a', marginBottom: '10px' }}>Payment Successful!</h2>
            <p style={{ color: '#64748b', fontSize: '15px', marginBottom: '30px' }}>Your payment of ₹{totalAmount.toLocaleString('en-IN')} was processed successfully.</p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
              <button
                onClick={() => onSuccess(paymentSuccessData.updatedItems, paymentSuccessData.paymentMode)}
                style={{ background: '#2563eb', color: 'white', border: 'none', padding: '12px 24px', borderRadius: '8px', fontSize: '15px', fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '8px', boxShadow: '0 4px 6px -1px rgba(37,99,235,0.2)' }}
              >
                View Receipt
              </button>
              <button
                onClick={() => {
                  const studentMobile =
                    primaryStudent?.mobileNo ||
                    primaryStudent?.fatherMobileNo ||
                    primaryStudent?.guardianMobileNo ||
                    '';

                  sendReceiptViaWhatsApp({
                    studentName: primaryStudent?.name,
                    regNo: primaryStudent?.manualRegsiName || primaryStudent?.regNo,
                    roomNo: primaryStudent?.roomNo,
                    phone: studentMobile,
                    receiptDate: new Date().toLocaleDateString('en-GB'),
                    totalAmount: totalAmount,
                    paymentMode: paymentSuccessData.paymentMode,
                    items: (paymentSuccessData.updatedItems || []).map((item: any) => ({
                      type: item.type || 'Fee',
                      amount: item.amount,
                    })),
                  });
                }}
                style={{ background: '#25D366', color: 'white', border: 'none', padding: '12px 24px', borderRadius: '8px', fontSize: '15px', fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '8px', boxShadow: '0 4px 6px -1px rgba(37,211,102,0.25)' }}
                title="Send receipt to student or parent on WhatsApp"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z" />
                </svg>
                Send via WhatsApp
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Header */}
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <h2 style={{ margin: '0 0 6px 0', fontSize: '18px', fontWeight: 700, color: '#0f172a' }}>
                  {primaryStudent?.name || 'Unknown'} <span style={{ color: '#64748b', fontWeight: 500, fontSize: '15px' }}>({primaryStudent?.manualRegsiName || primaryStudent?.regNo || 'N/A'})</span>
                </h2>
                <div style={{ fontSize: '14px', color: '#475569', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <span>Room: {primaryStudent?.roomNo || 'N/A'}</span>
                  <span style={{ color: '#cbd5e1' }}>•</span>
                  <span>
                    {collegeCycle === 'POSTPAID' ? 'Payable' : 'Current'}: {currentMonthStr}
                  </span>
                </div>
              </div>
              <button
                onClick={onClose}
                disabled={isSubmitting}
                title={isSubmitting ? 'Please wait...' : 'Close'}
                style={{ background: '#f1f5f9', border: 'none', color: '#64748b', cursor: isSubmitting ? 'not-allowed' : 'pointer', opacity: isSubmitting ? 0.5 : 1, padding: '6px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ padding: '24px', overflowY: 'auto' }}>

              {/* Duration Section */}
              {(hasCurrentRentItem || canPayUpcomingRent) && (
                <div style={{ marginBottom: '24px' }}>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#64748b', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Select Duration
                  </label>
                  <div style={{ position: 'relative' }}>
                    <select
                      value={hasCurrentRentItem ? months : upcomingMonths}
                      onChange={e => (hasCurrentRentItem ? setMonths(Number(e.target.value)) : setUpcomingMonths(Number(e.target.value)))}
                      style={{ width: '100%', padding: '12px 16px', border: '1px solid #cbd5e1', borderRadius: '8px', background: 'white', outline: 'none', fontSize: '15px', fontWeight: 500, color: '#1e293b', appearance: 'none', cursor: 'pointer', boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)' }}
                    >
                      {hasCurrentRentItem ? (
                        [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(m => (
                          <option key={m} value={m}>{m} Month{m > 1 ? 's' : ''} ({formatCyclePeriod(payableMonthStr, m)})</option>
                        ))
                      ) : (
                        <>
                          <option value={0}>Select months (Optional)</option>
                          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(m => {
                            const netM = Math.max(0, roundMoney(studentMonthlyRent * m - availableAdvanceBalance));
                            return (
                              <option key={m} value={m}>
                                {m} Month{m > 1 ? 's' : ''} ({formatCyclePeriod(nextUpcomingMonthStr, m)}) — ₹{netM.toLocaleString('en-IN')}
                              </option>
                            );
                          })}
                        </>
                      )}
                    </select>
                    <div style={{ position: 'absolute', right: '16px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#64748b' }}>
                      <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 5l3 3 3-3" /></svg>
                    </div>
                  </div>
                  {(hasCurrentRentItem || upcomingMonths > 0) && (
                    <div style={{ marginTop: '8px', fontSize: '13px', color: '#475569', fontWeight: 500 }}>
                      {hasCurrentRentItem ? (
                        <>Period: <span style={{ color: '#0f172a', fontWeight: 600 }}>{coveredPeriodStr}</span></>
                      ) : (
                        <>Period: <span style={{ color: '#0f172a', fontWeight: 600 }}>{formatCyclePeriod(nextUpcomingMonthStr, upcomingMonths)}</span> (₹{studentMonthlyRent.toLocaleString('en-IN')}/month)</>
                      )}
                    </div>
                  )}
                </div>
              )}

              {(allowPaymentDate || hasFineItems) && (
                <div style={{ marginBottom: '20px' }}>
                  {allowPaymentDate && (
                    <>
                      <label htmlFor="fee-payment-date" style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#64748b', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        Payment / receipt date
                      </label>
                      <input
                        id="fee-payment-date"
                        type="date"
                        value={paymentDate}
                        max={getTodayInput()}
                        onChange={(event) => setPaymentDate(event.target.value)}
                        disabled={isSubmitting}
                        style={{ width: '100%', padding: '12px 16px', border: '1px solid #cbd5e1', borderRadius: '8px', background: 'white', fontSize: '15px' }}
                      />
                    </>
                  )}
                  {loadingFineQuote ? (
                    <div style={{ marginTop: allowPaymentDate ? '8px' : 0, fontSize: '13px', color: '#64748b' }}>Checking late fine…</div>
                  ) : fineQuoteError ? (
                    <div role="alert" style={{ marginTop: allowPaymentDate ? '8px' : 0, fontSize: '13px', color: '#b91c1c' }}>{fineQuoteError}</div>
                  ) : fineQuoteReady ? (
                    <div style={{
                      marginTop: allowPaymentDate ? '8px' : 0,
                      padding: '10px 14px',
                      borderRadius: '8px',
                      background: '#f8fafc',
                      border: '1px solid #e2e8f0',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px',
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '6px' }}>
                        <div style={{ fontSize: '13px', color: '#334155' }}>
                          Overall Late Fine on {formatDateDMY(paymentDate)}:
                        </div>
                        <strong style={{ color: fineQuote.amount > 0 ? '#b45309' : '#0f172a', fontSize: '14.5px' }}>
                          ₹{fineQuote.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </strong>
                      </div>
                      {fineQuote.fines.length > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                          {fineQuote.fines.flatMap((entry) => {
                            if (entry.months && entry.months.length > 0) {
                              return entry.months.map((m) => (
                                <div
                                  key={`${entry.key}-${m.billingMonth}`}
                                  style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    flexWrap: 'wrap',
                                    gap: '6px',
                                    fontSize: '12px',
                                    color: '#475569',
                                    background: '#ffffff',
                                    border: '1px solid #e2e8f0',
                                    padding: '5px 8px',
                                    borderRadius: '6px',
                                  }}
                                >
                                  <span>
                                    <strong style={{ color: '#0f172a' }}>{m.monthLabel}</strong> · {entry.label}{' '}
                                    <span style={{ color: '#64748b', fontSize: '11px' }}>
                                      (Due {formatDateDMY(m.dueDate)} · {m.daysOverdue}d @ ₹{m.rate}/d)
                                    </span>
                                  </span>
                                  <strong style={{ color: '#0f172a' }}>
                                    ₹{m.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                  </strong>
                                </div>
                              ));
                            }
                            return [
                              <div
                                key={entry.key}
                                style={{
                                  display: 'flex',
                                  justifyContent: 'space-between',
                                  alignItems: 'center',
                                  flexWrap: 'wrap',
                                  gap: '6px',
                                  fontSize: '12px',
                                  color: '#475569',
                                  background: '#ffffff',
                                  border: '1px solid #e2e8f0',
                                  padding: '5px 8px',
                                  borderRadius: '6px',
                                }}
                              >
                                <span>
                                  <strong style={{ color: '#0f172a' }}>{entry.label}</strong>{' '}
                                  <span style={{ color: '#64748b', fontSize: '11px' }}>
                                    ({entry.daysOverdue}d @ ₹{entry.rate}/d)
                                  </span>
                                </span>
                                <strong style={{ color: '#0f172a' }}>
                                  ₹{entry.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                </strong>
                              </div>,
                            ];
                          })}
                        </div>
                      ) : (
                        <div style={{ fontSize: '12px', color: '#64748b' }}>— no overdue fine</div>
                      )}
                    </div>
                  ) : null}
                </div>
              )}

              {/* Fees List */}
              <div style={{ marginBottom: '24px' }}>
                {filteredPayableItems.length > 0 && (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '8px' }}>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Fees to Pay</label>
                    </div>

                    <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
                      <div
                        onClick={toggleAllCurrentFees}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '12px 16px',
                          background: allCurrentSelected ? '#eff6ff' : '#f8fafc',
                          borderBottom: '1px solid #e2e8f0',
                          cursor: 'pointer',
                          transition: 'background 0.2s',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <input
                            type="checkbox"
                            checked={allCurrentSelected}
                            onChange={(e) => { e.stopPropagation(); toggleAllCurrentFees(); }}
                            style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: '#2563eb' }}
                          />
                          <span style={{ fontWeight: 700, color: allCurrentSelected ? '#1e3a8a' : '#64748b', fontSize: '14px' }}>
                            Pay All Current Fees {allCurrentSelected ? '' : <span style={{ fontWeight: 400, color: '#94a3b8' }}>(Unchecked)</span>}
                          </span>
                        </div>
                        <span style={{ fontWeight: 700, color: allCurrentSelected ? '#1e3a8a' : '#94a3b8', fontSize: '14px', textDecoration: allCurrentSelected ? 'none' : 'line-through' }}>
                          ₹{orderedDisplayItems
                            .reduce((sum: number, item: any) => sum + getItemCalculatedAmount(item), 0)
                            .toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </span>
                      </div>

                      {orderedDisplayItems.map((f, index) => {
                        const state = feeStates[f.id] || { selected: true };
                        const currentMultiplier = getMultiplier(f.transactionType);
                        const isLast = index === orderedDisplayItems.length - 1;
                        const calculatedAmount = getItemCalculatedAmount(f);
                        const grossItemAmount = roundMoney(Number(f.amount || 0) * currentMultiplier);
                        const upcomingAdvAdjusted =
                          f?.isUpcomingAdvanceRent && availableAdvanceBalance > 0
                            ? roundMoney(Math.min(availableAdvanceBalance, grossItemAmount))
                            : 0;
                        const fineParent = getFineParentType(f);

                        return (
                          <div key={f.id} style={{ display: 'flex', padding: '12px 16px', paddingLeft: fineParent ? '40px' : '16px', borderBottom: isLast ? 'none' : '1px solid #e2e8f0', background: state.selected ? '#ffffff' : '#f8fafc', transition: 'background 0.2s', alignItems: 'flex-start' }}>
                            <div style={{ flex: 1 }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                                <span style={{ fontWeight: 600, color: state.selected ? '#0f172a' : '#64748b', fontSize: '14px' }}>
                                  {getFeeLabel(f)}
                                </span>
                                <span style={{ fontWeight: 700, color: state.selected ? '#0f172a' : '#94a3b8', fontSize: '14px', textDecoration: state.selected ? 'none' : 'line-through' }}>
                                  ₹{calculatedAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                </span>
                              </div>
                              <div style={{ color: '#64748b', fontSize: '13px' }}>
                                {currentMultiplier > 1
                                  ? (Math.abs(calculatedAmount - Number(f.amount || 0) * currentMultiplier) > 0.01
                                      ? `${currentMultiplier} months (${getMonthNames(currentMultiplier, f.description || '', resolveFeeBillingMonth(f))})`
                                      : `${currentMultiplier} months × ₹${f.amount.toLocaleString('en-IN')}`)
                                  : (f.description || 'One-time fee')}
                                {upcomingAdvAdjusted > 0 && (
                                  <div style={{ marginTop: '3px', color: '#0284c7', fontWeight: 600, fontSize: '12.5px' }}>
                                    · ₹{upcomingAdvAdjusted.toLocaleString('en-IN', { minimumFractionDigits: 2 })} Advance Rent Balance adjusted from ₹{grossItemAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                  </div>
                                )}
                                {f.fineQuote && (
                                  <div style={{ marginTop: '3px', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '6px' }}>
                                    <span style={{ color: '#b45309', fontWeight: 600, fontSize: '12.5px' }}>
                                      · As of {formatDateDMY(paymentDate)}:{' '}
                                      {f.fineQuote.daysOverdue > 0
                                        ? `${f.fineQuote.daysOverdue} overdue day${f.fineQuote.daysOverdue === 1 ? '' : 's'} @ ₹${f.fineQuote.rate}/d`
                                        : 'no fine'}
                                      {!f.fineMigrated && Number(f.originalAmount) !== Number(f.amount) && (
                                        <span style={{ color: '#64748b', fontWeight: 400 }}> (was ₹{Number(f.originalAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })})</span>
                                      )}
                                    </span>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}

                {/* OUTSTANDING item: one consolidated previous balance */}
                {outstandingBalance > 0 && (
                  <div style={{ marginTop: filteredPayableItems.length > 0 ? '12px' : '0' }}>
                    {filteredPayableItems.length === 0 && (
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#64748b', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Outstanding</label>
                    )}
                    <div style={{ border: '1px solid #fde68a', borderRadius: '8px', overflow: 'hidden', background: '#fffbeb' }}>
                      <div
                        onClick={() => setOutstandingSelected(prev => !prev)}
                        style={{ display: 'flex', padding: '12px 16px', alignItems: 'flex-start', cursor: 'pointer', background: outstandingSelected ? '#ffffff' : '#fffbeb', transition: 'background 0.2s' }}
                      >
                        <div style={{ marginRight: '12px', marginTop: '2px' }}>
                          <input
                            type="checkbox"
                            checked={outstandingSelected}
                            onChange={(e) => { e.stopPropagation(); setOutstandingSelected(e.target.checked); }}
                            style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: '#d97706' }}
                          />
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                            <span style={{ fontWeight: 700, color: outstandingSelected ? '#0f172a' : '#64748b', fontSize: '14px', letterSpacing: '0.3px' }}>
                              OUTSTANDING {outstandingSelected ? '' : <span style={{ fontWeight: 400, color: '#94a3b8' }}>(Unchecked)</span>}
                            </span>
                            <span style={{ fontWeight: 700, color: outstandingSelected ? '#b45309' : '#94a3b8', fontSize: '14px' }}>
                              ₹{outstandingBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </span>
                          </div>
                          <div style={{ color: '#92400e', fontSize: '13px' }}>
                            Previous unpaid balance
                          </div>
                        </div>
                      </div>

                      {outstandingSelected && (
                        <div style={{ padding: '12px 16px 16px', borderTop: '1px dashed #fde68a', background: '#ffffff' }}>
                          <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#64748b', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Enter Amount to Pay</label>
                          <div style={{ position: 'relative' }}>
                            <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#64748b', fontWeight: 600, fontSize: '15px' }}>₹</span>
                            <input
                              type="number"
                              min="0"
                              max={outstandingBalance}
                              step="0.01"
                              inputMode="decimal"
                              value={outstandingAmountInput}
                              onChange={(e) => handleOutstandingAmountChange(e.target.value)}
                              placeholder="0.00"
                              style={{ width: '100%', padding: '12px 12px 12px 28px', border: `1px solid ${outstandingError ? '#f87171' : '#cbd5e1'}`, borderRadius: '8px', outline: 'none', fontSize: '15px', fontWeight: 600, color: '#0f172a', boxSizing: 'border-box' }}
                            />
                          </div>

                          <div style={{ display: 'flex', gap: '8px', marginTop: '10px', flexWrap: 'wrap' }}>
                            <span style={{ fontSize: '12px', color: '#94a3b8' }}>
                              Enter any amount up to ₹{outstandingBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </span>

                          </div>

                          {outstandingError ? (
                            <div style={{ marginTop: '8px', fontSize: '13px', color: '#dc2626', fontWeight: 600 }}>
                              {outstandingError}
                            </div>
                          ) : (
                            <div style={{ marginTop: '8px', fontSize: '13px', color: '#475569' }}>
                              Remaining after payment: <span style={{ color: '#0f172a', fontWeight: 700 }}>₹{remainingOutstanding.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Payment Details */}
              <div style={{ marginBottom: '24px' }}>
                {!isStudentMode && (
                  <div style={{ display: 'flex', gap: '16px', marginBottom: '16px' }}>
                    <div style={{ flex: 1 }}>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#64748b', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Payment Mode <span style={{ color: '#ef4444' }}>*</span></label>
                      <select value={paymentMode} onChange={e => setPaymentMode(e.target.value)} style={{ width: '100%', padding: '10px 12px', border: '1px solid #cbd5e1', borderRadius: '8px', background: 'white', outline: 'none', fontSize: '14px', color: '#1e293b' }}>
                        <option value="UPI">UPI / QR (GPay / PhonePe / Paytm)</option>
                        <option value="CASH">Cash</option>
                        <option value="CARD">Credit / Debit Card</option>
                        <option value="NETBANKING">Net Banking</option>
                        <option value="BANK_TRANSFER">Bank Transfer</option>
                      </select>
                    </div>
                    {!isStudentMode && (
                      <div style={{ flex: 1 }}>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#64748b', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Reference #</label>
                        <input type="text" placeholder="UPI Ref ID or Cheque #" value={referenceNumber} onChange={e => setReferenceNumber(e.target.value)} style={{ width: '100%', padding: '10px 12px', border: '1px solid #cbd5e1', borderRadius: '8px', outline: 'none', fontSize: '14px' }} />
                      </div>
                    )}
                  </div>
                )}

                {!isStudentMode && (
                  <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#64748b', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Discount (₹)</label>
                    <div style={{ position: 'relative' }}>
                      <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#64748b', fontWeight: 600, fontSize: '15px' }}>₹</span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        inputMode="decimal"
                        placeholder="0.00"
                        value={discountInput}
                        onChange={(e) => handleDiscountChange(e.target.value)}
                        disabled={isSubmitting}
                        style={{ width: '100%', padding: '10px 12px 10px 28px', border: `1px solid ${discountError ? '#f87171' : '#cbd5e1'}`, borderRadius: '8px', outline: 'none', fontSize: '14px', boxSizing: 'border-box', color: '#1e293b' }}
                      />
                    </div>
                    {discountError ? (
                      <div style={{ marginTop: '6px', fontSize: '12px', color: '#dc2626', fontWeight: 600 }}>{discountError}</div>
                    ) : (
                      <div style={{ marginTop: '6px', fontSize: '12px', color: '#64748b' }}>
                        Enter the amount to reduce from the total fees.
                      </div>
                    )}
                  </div>
                )}

                {isStudentMode && (
                  <div style={{ padding: '12px 14px', border: '1px solid #bfdbfe', borderRadius: '8px', background: '#eff6ff', color: '#1e40af', fontSize: '13px' }}>
                    Secure online checkout supports UPI, cards, net banking, and other Razorpay-enabled payment methods.
                  </div>
                )}

                {!isStudentMode && (
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#64748b', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Notes</label>
                    <input type="text" placeholder="Optional notes (e.g. Paid by father)" value={notes} onChange={e => setNotes(e.target.value)} style={{ width: '100%', padding: '10px 12px', border: '1px solid #cbd5e1', borderRadius: '8px', outline: 'none', fontSize: '14px' }} />
                  </div>
                )}
              </div>

            </div>

            {/* Footer */}
            <div style={{ background: '#f8fafc', padding: '24px', borderTop: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '20px', gap: '12px' }}>
                <div>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>Total Payable</div>
                  <div style={{ fontSize: '14px', color: '#475569', fontWeight: 500 }}>{summaryText}</div>
                  {!isStudentMode && (
                    <div style={{ fontSize: '12px', color: '#64748b', marginTop: '6px' }}>
                      Fees ₹{subTotalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      {discountAmount > 0 && (
                        <> · Discount <strong style={{ color: '#dc2626' }}>−₹{discountAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong></>
                      )}
                    </div>
                  )}
                </div>
                <div style={{ fontSize: '28px', fontWeight: 800, color: '#0f172a', lineHeight: 1, whiteSpace: 'nowrap' }}>
                  ₹{totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </div>
              </div>

              <button
                onClick={() => {
                  const orderId = onlineOrderId.current;
                  const studentId =
                    primaryStudent?.uuid ||
                    itemsToPay[0]?.studentId ||
                    itemsToPay[0]?.student?.uuid ||
                    itemsToPay[0]?.student?.id ||
                    primaryStudent?.id;
                  if (onlineConfirmationPending && orderId && studentId) {
                    void checkOnlinePaymentStatus(orderId, studentId);
                  } else if (isStudentMode) {
                    void handleOnlinePayment();
                  } else {
                    void handleSubmit();
                  }
                }}
                disabled={onlineConfirmationPending ? isSubmitting : !canSubmit}
                style={{ width: '100%', padding: '16px', borderRadius: '10px', background: !canSubmit ? '#94a3b8' : (isStudentMode ? '#2563eb' : '#10b981'), color: 'white', border: 'none', cursor: !canSubmit ? 'not-allowed' : 'pointer', fontWeight: 700, fontSize: '16px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', boxShadow: canSubmit ? '0 4px 6px -1px rgba(16, 185, 129, 0.2), 0 2px 4px -1px rgba(16, 185, 129, 0.1)' : 'none', transition: 'all 0.2s' }}
              >
                {onlineConfirmationPending
                  ? isSubmitting ? 'Checking Payment...' : 'Check Payment Status'
                  : isSubmitting
                    ? 'Processing Payment...'
                    : `${isStudentMode ? 'Pay Online' : 'Proceed to Pay'} ₹${totalAmount.toLocaleString('en-IN')}`}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

/**
 * Fees dashboard reconciliation.
 *
 * The dashboard must account for every in-scope invoice exactly once:
 *
 *   Total Invoiced = Collected + Pending Unpaid + Not Due
 *                    + Partial Balance + Unreconciled
 *
 * The ledger is deliberately built from transactions, not from the grouped
 * display rows. The old cards mixed three different datasets (grouped paid
 * receipts, grouped unpaid rows and a separate invoiced sum), which is why a
 * paid invoice could be counted in "Total Invoiced" while its receipt was
 * skipped by a date cutoff and never appeared in "Collected".
 *
 * Scope rules kept from the existing page:
 * - Mess fees are managed separately and stay excluded from the dashboard.
 * - Imported / previous-settled invoices outside the current-or-previous
 *   billing window are out of scope (they were settled before the fresh
 *   cycle). Future invoices are in scope and land in "Not Due".
 * - Historical outstanding invoices are included once, and their
 *   OUTSTANDING_PAYMENT receipts are netted against them. Outstanding
 *   payments are never counted as invoices again.
 */

import { getBillingMonths, isPostpaidPayableFee, resolveFeeBillingMonth } from './billingCycle';
import {
  buildOutstandingSummary,
  getStudentKey,
  isImportedInvoice,
  isMessFee,
  isOutstandingDescription,
  isOutstandingInvoice,
  isOutstandingPayment,
  isPreviousSettledFee,
  roundMoney,
} from './outstanding';

type FeeCategory = 'rent' | 'eb' | 'fine' | 'advance' | 'other';

export interface FeeReconciliationCounts {
  completedInvoices: number;
  pendingInvoices: number;
  notDueInvoices: number;
  partialStatusInvoices: number;
  outstandingInvoices: number;
  outstandingPayments: number;
}

export interface FeeReconciliation {
  /** Total amount of every in-scope invoice (paid + unpaid). */
  totalInvoiced: number;
  /** Every confirmed receipt: full payments + outstanding receipts. */
  totalCollected: number;
  /** Invoices that are payable now and still fully unpaid. */
  pendingUnpaid: number;
  /** Invoices in scope that are not payable yet (billing-cycle rules). */
  notDue: number;
  /** Remaining balance on invoices that have received a partial payment. */
  partialBalance: number;
  /**
   * Ledger residual. Positive means an amount could not be placed in one of
   * the explicit buckets; negative means receipts exceeded the outstanding
   * invoice total (an overpayment). It is intentionally not forced to zero.
   */
  unreconciled: number;
  isReconciled: boolean;
  overpayment: number;
  counts: FeeReconciliationCounts;
}

const categoryOf = (fee: any): FeeCategory => {
  const type = String(fee?.transactionType || '').toUpperCase();
  if (type.includes('RENT')) return 'rent';
  if (type.includes('EB') || type.includes('ELECTRIC')) return 'eb';
  if (type.includes('FINE')) return 'fine';
  if (type.includes('ADVANCE')) return 'advance';
  return 'other';
};

const billingCycleOf = (fee: any): 'PREPAID' | 'POSTPAID' =>
  String(fee?.student?.college?.billingCycle || 'PREPAID').toUpperCase() === 'POSTPAID'
    ? 'POSTPAID'
    : 'PREPAID';

/**
 * Whether a pending invoice is payable now, mirroring the Fees table and the
 * Collect Payment modal so the cards never disagree with the Pay Now action.
 */
export const isFeePayableNow = (
  fee: any,
  currentMonthStr: string,
  previousMonthStr: string,
): boolean => {
  const category = categoryOf(fee);
  const feeMonth = resolveFeeBillingMonth(fee);

  if (billingCycleOf(fee) === 'POSTPAID') {
    // Postpaid colleges bill the previous month. Current month labels are
    // accepted for legacy rows, exactly like the existing Fees table.
    if (category === 'fine') return isPostpaidPayableFee(fee, previousMonthStr);
    return !feeMonth || feeMonth === previousMonthStr || feeMonth === currentMonthStr;
  }

  // Prepaid: current rent / advance, previous-or-current EB and fine.
  if (!feeMonth) return true;
  if (category === 'rent' || category === 'advance') return feeMonth === currentMonthStr;
  return feeMonth === previousMonthStr || feeMonth === currentMonthStr;
};

/**
 * Fresh-cycle applicability. This matches the existing invoiced-card scope
 * (current or previous billing month) but keeps future invoices in scope so
 * they can be reported as "Not Due" instead of silently disappearing.
 */
const isFreshCycleApplicable = (
  fee: any,
  currentMonthStr: string,
  previousMonthStr: string,
): boolean => {
  const category = categoryOf(fee);
  const feeMonth = resolveFeeBillingMonth(fee);

  const isCycleRelevant =
    !feeMonth ||
    (billingCycleOf(fee) === 'POSTPAID' && category === 'fine'
      ? isPostpaidPayableFee(fee, previousMonthStr)
      : feeMonth === currentMonthStr || feeMonth === previousMonthStr);

  // Imported/previous-settled rows older than the current window were settled
  // outside the fresh cycle and are intentionally out of scope.
  if (isImportedInvoice(fee) && !isCycleRelevant) return false;
  if (isPreviousSettledFee(fee) && !isCycleRelevant) return false;
  return true;
};

export interface BuildFeeReconciliationInput {
  /** Full transaction list, used to net outstanding invoices against receipts. */
  allFees: any[];
  /** Transactions after the page's student / college / room / date / status filters. */
  filteredFees: any[];
  now?: Date;
}

export const buildFeeReconciliation = ({
  allFees,
  filteredFees,
  now = new Date(),
}: BuildFeeReconciliationInput): FeeReconciliation => {
  const { currentMonthStr, previousMonthStr } = getBillingMonths(now);

  let totalInvoiced = 0;
  let totalCollected = 0;
  let pendingUnpaid = 0;
  let notDue = 0;
  let partialBalance = 0;
  let overpayment = 0;

  const counts: FeeReconciliationCounts = {
    completedInvoices: 0,
    pendingInvoices: 0,
    notDueInvoices: 0,
    partialStatusInvoices: 0,
    outstandingInvoices: 0,
    outstandingPayments: 0,
  };

  // 1) Regular invoices and their receipts.
  filteredFees.forEach(fee => {
    if (!fee) return;
    if (isMessFee(fee)) return;
    // Advance deposits are already paid and are not fee-cycle dues.
    if (
      fee.status === 'PENDING' &&
      String(fee.transactionType || '').toUpperCase() === 'ADVANCE'
    ) {
      return;
    }
    // Both outstanding invoices and outstanding receipts belong to the
    // historical ledger below; counting them here would duplicate the money.
    if (isOutstandingDescription(fee) || isOutstandingPayment(fee)) return;
    if (!isFreshCycleApplicable(fee, currentMonthStr, previousMonthStr)) return;

    const amount = roundMoney(Number(fee.amount) || 0);
    if (!Number.isFinite(amount) || amount === 0) return;

    // A PARTIAL row has no linked receipt in the current data model, so we
    // cannot know how much was collected. Keep the invoice amount visible and
    // let it fall into Unreconciled instead of guessing.
    if (fee.status === 'PARTIAL') {
      totalInvoiced = roundMoney(totalInvoiced + amount);
      counts.partialStatusInvoices += 1;
      return;
    }

    if (fee.status !== 'PENDING' && fee.status !== 'COMPLETED') return;

    totalInvoiced = roundMoney(totalInvoiced + amount);

    if (fee.status === 'COMPLETED') {
      totalCollected = roundMoney(totalCollected + amount);
      counts.completedInvoices += 1;
    } else if (isFeePayableNow(fee, currentMonthStr, previousMonthStr)) {
      pendingUnpaid = roundMoney(pendingUnpaid + amount);
      counts.pendingInvoices += 1;
    } else {
      notDue = roundMoney(notDue + amount);
      counts.notDueInvoices += 1;
    }
  });

  // 2) Historical outstanding ledger. The page filters decide which students
  // are visible; once a student is visible we net their complete outstanding
  // ledger so a hidden invoice/payment can never produce a false balance.
  const visibleStudents = new Set(filteredFees.map(getStudentKey));
  const outstandingByStudent = new Map<string, any[]>();

  allFees.forEach(fee => {
    if (!isOutstandingInvoice(fee) && !isOutstandingPayment(fee)) return;
    const studentKey = getStudentKey(fee);
    if (!visibleStudents.has(studentKey)) return;
    if (!outstandingByStudent.has(studentKey)) outstandingByStudent.set(studentKey, []);
    outstandingByStudent.get(studentKey)!.push(fee);
  });

  outstandingByStudent.forEach(rows => {
    const summary = buildOutstandingSummary(rows);

    totalInvoiced = roundMoney(totalInvoiced + summary.original);
    totalCollected = roundMoney(totalCollected + summary.paid);
    counts.outstandingInvoices += summary.invoices.length;
    counts.outstandingPayments += summary.payments.length;
    overpayment = roundMoney(overpayment + Math.max(0, summary.paid - summary.original));

    summary.allocations.forEach(allocation => {
      if (allocation.remainingAmount <= 0.005) return;
      if (allocation.paidAmount > 0.005) {
        partialBalance = roundMoney(partialBalance + allocation.remainingAmount);
      } else {
        pendingUnpaid = roundMoney(pendingUnpaid + allocation.remainingAmount);
      }
    });
  });

  const accounted = roundMoney(totalCollected + pendingUnpaid + notDue + partialBalance);
  const unreconciled = roundMoney(totalInvoiced - accounted);

  return {
    totalInvoiced,
    totalCollected,
    pendingUnpaid,
    notDue,
    partialBalance,
    unreconciled,
    isReconciled: Math.abs(unreconciled) < 0.01,
    overpayment,
    counts,
  };
};

/**
 * Shared helpers for the outstanding-balance ledger.
 *
 * Outstanding invoices are original PENDING transactions whose description
 * starts with "Outstanding". They are never edited. Every payment made against
 * them is a separate COMPLETED `OUTSTANDING_PAYMENT` transaction.
 *
 * Remaining balance = original outstanding invoices - confirmed payments.
 *
 * Keep all balance maths in this file so the Fees page, Student Profile,
 * Hostellers, Dashboard, Clearance and the Student Portal always agree.
 */

export const OUTSTANDING_PAYMENT_TYPE = 'OUTSTANDING_PAYMENT';

export const roundMoney = (value: number) =>
  Math.round((Number(value) || 0) * 100) / 100;

/** True for any row that belongs to the historical outstanding module. */
export const isOutstandingDescription = (fee: any) =>
  /^\s*outstanding\b/i.test(String(fee?.description || ''));

const isOctoberEbBill = (fee: any) =>
  String(fee?.transactionType || '').toUpperCase() === 'EB_BILL' &&
  /(?:\b2026-10\b|\boct(?:ober)?\s*2026\b)/i.test(String(fee?.description || ''));

/** A confirmed payment towards the outstanding balance. */
export const isOutstandingPayment = (fee: any) =>
  !!fee &&
  fee.status === 'COMPLETED' &&
  String(fee.transactionType || '').toUpperCase() === OUTSTANDING_PAYMENT_TYPE;

export const isMessFee = (fee: any) =>
  String(fee?.transactionType || '').trim().toUpperCase().startsWith('MESS');

/**
 * An original outstanding invoice. Only PENDING rows count: once a payment is
 * recorded, the invoice itself still stays PENDING and is netted by the ledger.
 */
export const isOutstandingInvoice = (fee: any) =>
  !!fee &&
  fee.status === 'PENDING' &&
  !isMessFee(fee) &&
  String(fee.transactionType || '').toUpperCase() !== OUTSTANDING_PAYMENT_TYPE &&
  isOutstandingDescription(fee);

/**
 * Fresh billing and collection cycle starts from November 1, 2026.
 * Prior fees (receipts and invoices before Nov 1, 2026) are considered
 * settled outside the fresh cycle, except October 2026 EB bill shares.
 * Any fee created before November 1, 2026 that is NOT for November 2026 or later
 * is considered a previous settled fee and must not be shown on the fresh Fees page.
 */
export const isPreviousSettledFee = (fee: any): boolean => {
  if (!fee) return false;
  // Preserve genuine historical outstanding transactions
  if (isOutstandingDescription(fee) || isOutstandingPayment(fee) || isOctoberEbBill(fee)) return false;

  const desc = String(fee.description || '');
  // November 2026 and future months belong to the fresh billing cycle starting Nov 1
  if (/november|december|2027/i.test(desc)) return false;

  const dateVal = fee.paidDate || fee.createdAt;
  if (!dateVal) return true;
  const d = new Date(dateVal);
  if (isNaN(d.getTime())) return true;

  // Cutoff is November 1, 2026 00:00:00 local time
  const cutoff = new Date('2026-11-01T00:00:00');
  return d < cutoff;
};

/**
 * Checks if a pending fee is an imported invoice or a current October rent/mess
 * fee that was already paid up to Oct 31, 2026.
 * Genuine historical dues (e.g. "Outstanding Rent for Sep 2026") are NEVER matched here.
 * Tomorrow's November fees ("... for November 2026") are NEVER matched here.
 */
export const isImportedInvoice = (fee: any) => {
  if (!fee) return false;
  // Always preserve genuine historical outstanding invoices
  if (isOutstandingDescription(fee) || isOctoberEbBill(fee)) return false;

  const desc = String(fee.description || '');
  if (/imported/i.test(desc)) return true;
  if (/october\s*2026\b/i.test(desc)) return true;

  // Any non-outstanding fee created on or before Oct 31, 2026 (excluding November+)
  const isFutureMonth = /november|december|2027/i.test(desc);
  if (isFutureMonth) return false;

  const created = new Date(fee.createdAt);
  if (!isNaN(created.getTime()) && created < new Date('2026-11-01T00:00:00')) {
    return true;
  }

  return false;
};

export const getStudentKey = (fee: any) =>
  fee?.student?.regNo ||
  fee?.student?.manualRegsiName ||
  fee?.studentId ||
  'unknown';

const timeOf = (fee: any) => {
  const value = fee?.paidDate || fee?.createdAt || fee?.updatedAt;
  const time = value ? new Date(value).getTime() : 0;
  return Number.isFinite(time) ? time : 0;
};

export interface OutstandingTotals {
  original: number;
  paid: number;
  remaining: number;
}

/**
 * Per-student totals. Pass the full transaction list (invoices + payments) so
 * confirmed payments are always netted against their invoices.
 */
export const buildOutstandingTotals = (
  fees: any[],
  getKey: (fee: any) => string = getStudentKey,
): Map<string, OutstandingTotals> => {
  const map = new Map<string, OutstandingTotals>();
  const ensure = (key: string) => {
    if (!map.has(key)) map.set(key, { original: 0, paid: 0, remaining: 0 });
    return map.get(key)!;
  };

  fees.forEach(fee => {
    if (isOutstandingInvoice(fee)) {
      ensure(getKey(fee)).original += Number(fee.amount) || 0;
    } else if (isOutstandingPayment(fee)) {
      ensure(getKey(fee)).paid += Number(fee.amount) || 0;
    }
  });

  map.forEach(totals => {
    totals.original = roundMoney(totals.original);
    totals.paid = roundMoney(totals.paid);
    totals.remaining = roundMoney(Math.max(0, totals.original - totals.paid));
  });

  return map;
};

/**
 * Detailed ledger for one student's outstanding balance. Invoices stay in their
 * original order; each confirmed payment is allocated oldest-first for display
 * only (nothing is persisted twice).
 */
export const buildOutstandingSummary = (fees: any[]) => {
  const invoices = fees
    .filter(isOutstandingInvoice)
    .slice()
    .sort((a, b) => timeOf(a) - timeOf(b));

  const payments = fees
    .filter(isOutstandingPayment)
    .slice()
    .sort((a, b) => timeOf(a) - timeOf(b));

  const original = roundMoney(
    invoices.reduce((sum, invoice) => sum + (Number(invoice.amount) || 0), 0),
  );
  const paid = roundMoney(
    payments.reduce((sum, payment) => sum + (Number(payment.amount) || 0), 0),
  );
  const remaining = roundMoney(Math.max(0, original - paid));

  let pool = paid;
  const allocations = invoices.map(invoice => {
    const originalAmount = roundMoney(Number(invoice.amount) || 0);
    const paidAmount = roundMoney(Math.min(pool, originalAmount));
    pool = roundMoney(pool - paidAmount);
    return {
      invoice,
      invoiceId: invoice.id,
      originalAmount,
      paidAmount,
      remainingAmount: roundMoney(originalAmount - paidAmount),
    };
  });

  return { invoices, payments, original, paid, remaining, allocations };
};

/**
 * Transaction types that count toward the "Pending Fees" total:
 * Monthly Rent + EB Bill. Mess fees, fines, and advances are intentionally
 * excluded from invoice totals and balances.
 *   Pending Fees = Monthly Rent + EB Bill − Total Paid
 * (Total Paid is represented by COMPLETED rows, which are excluded by the
 * PENDING filter below, so the sum of PENDING Rent/EB already equals
 * "billed − paid" for those categories.)
 */
const CURRENT_FEE_TYPES = new Set(['RENT', 'EB_BILL']);

/** A current-cycle pending fee (Rent / EB) that should be counted in
 *  the Pending Fees total. Excludes outstanding invoices, imported/legacy
 *  rows, pre-Nov-2026 settled rows, and non-recurring types (Fine, Advance). */
export const isCurrentCycleFee = (fee: any): boolean =>
  !!fee &&
  fee.status === 'PENDING' &&
  CURRENT_FEE_TYPES.has(String(fee.transactionType || '').toUpperCase()) &&
  !isOutstandingInvoice(fee) &&
  !isImportedInvoice(fee) &&
  !isPreviousSettledFee(fee);

/**
 * Pending dues for a complete transaction list:
 *   current PENDING dues (Rent + EB only, with Total Paid already netted out
 *   via COMPLETED rows)
 * + remaining historical outstanding (original - confirmed payments).
 *
 * This implements: Pending Fees = Monthly Rent + EB Bill − Total Paid
 *                  (+ any separately-tracked historical dues).
 */
export const calculatePendingDues = (fees: any[]) => {
  let pending = 0;

  fees.forEach(fee => {
    if (isCurrentCycleFee(fee)) {
      pending += Number(fee.amount) || 0;
    }
  });

  buildOutstandingTotals(fees).forEach(totals => {
    pending += totals.remaining;
  });

  return roundMoney(pending);
};

/** Hide the internal idempotency marker from payment-history descriptions. */
export const cleanPaymentDescription = (description?: string | null) =>
  String(description || '')
    .replace(/\s*\|\s*\[REQ:[^\]]+\]/g, '')
    .replace(/\[REQ:[^\]]+\]/g, '')
    .trim();

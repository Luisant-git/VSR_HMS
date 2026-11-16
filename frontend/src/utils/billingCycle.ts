/**
 * Billing-cycle helpers shared by the Fees page and payment modal.
 *
 * A college is either PREPAID (current month is payable now) or POSTPAID
 * (the previous month is payable now). Older fees were created before the
 * `billingMonth` column existed, so we also try to read the month out of the
 * description before deciding that a fee belongs to the current cycle.
 */

export const getBillingMonths = (now: Date = new Date()) => {
  const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const prevMonthIndex = now.getMonth() === 0 ? 11 : now.getMonth() - 1;
  const prevYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
  const previousMonthStr = `${prevYear}-${String(prevMonthIndex + 1).padStart(2, '0')}`;
  return { currentMonthStr, previousMonthStr };
};

const MONTH_NAMES = [
  'january',
  'february',
  'march',
  'april',
  'may',
  'june',
  'july',
  'august',
  'september',
  'october',
  'november',
  'december',
];

/** Turn "2026-11" into "November 2026". */
export const formatBillingMonth = (monthStr?: string | null): string => {
  const match = String(monthStr || '').match(/^(\d{4})-(0[1-9]|1[0-2])$/);
  if (!match) return '';
  const label = MONTH_NAMES[Number(match[2]) - 1];
  return `${label.charAt(0).toUpperCase()}${label.slice(1)} ${match[1]}`;
};

/**
 * When the monthly rent & mess cron runs, and which billing month it creates.
 *
 * The cron runs at midnight on the 1st of every month:
 *   PREPAID  -> creates the new month's fees (1 Dec -> December fees)
 *   POSTPAID -> creates the previous month's fees (1 Dec -> November fees)
 */
export const getFeeCycleInfo = (billingCycle: string = 'PREPAID', now: Date = new Date()) => {
  const { currentMonthStr, previousMonthStr } = getBillingMonths(now);
  const cycle =
    String(billingCycle || 'PREPAID').toUpperCase() === 'POSTPAID' ? 'POSTPAID' : 'PREPAID';

  const nextRunDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const nextRunMonthStr = `${nextRunDate.getFullYear()}-${String(
    nextRunDate.getMonth() + 1,
  ).padStart(2, '0')}`;

  const currentPayableMonth = cycle === 'POSTPAID' ? previousMonthStr : currentMonthStr;
  const nextBillingMonth = cycle === 'POSTPAID' ? currentMonthStr : nextRunMonthStr;

  return {
    billingCycle: cycle,
    currentMonthStr,
    previousMonthStr,
    currentPayableMonth,
    currentPayableLabel: formatBillingMonth(currentPayableMonth),
    nextRunDate,
    nextRunMonthStr,
    nextRunLabel: nextRunDate.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }),
    nextBillingMonth,
    nextBillingMonthLabel: formatBillingMonth(nextBillingMonth),
  };
};

/**
 * Resolve the billing month (YYYY-MM) a fee belongs to.
 *
 * Priority:
 * 1. The explicit `billingMonth` stored on the fee.
 * 2. A machine-readable month in the description ("2026-11").
 * 3. A month name + year in the description ("November 2026").
 * 4. The month the fee was created in (covers older rows saved before the
 *    `billingMonth` column existed, e.g. "Month 1 Room Rent").
 */
export const resolveFeeBillingMonth = (fee: any): string | null => {
  const explicit = String(fee?.billingMonth || '').trim();
  if (/^\d{4}-(0[1-9]|1[0-2])$/.test(explicit)) return explicit;

  const description = String(fee?.description || '');

  const isoMatch = description.match(/\b(20\d{2})-(0[1-9]|1[0-2])\b/);
  if (isoMatch) return `${isoMatch[1]}-${isoMatch[2]}`;

  const namedMatch = description.match(
    /\b(january|february|march|april|may|june|july|august|september|october|november|december)\s*,?\s*(20\d{2})\b/i,
  );
  if (namedMatch) {
    const monthIndex = MONTH_NAMES.indexOf(namedMatch[1].toLowerCase());
    if (monthIndex >= 0) {
      return `${namedMatch[2]}-${String(monthIndex + 1).padStart(2, '0')}`;
    }
  }

  const created = new Date(fee?.paidDate || fee?.createdAt || '');
  if (!Number.isNaN(created.getTime())) {
    return `${created.getFullYear()}-${String(created.getMonth() + 1).padStart(2, '0')}`;
  }

  return null;
};

/**
 * True when a PENDING fee is payable for a POSTPAID college.
 *
 * POSTPAID colleges bill the previous month, so only fees that resolve to the
 * previous billing month can be collected. Current/future-month fees are not
 * payable yet. Fines (e.g. late-fine accumulation on overdue dues) are payable
 * when raised, even for postpaid colleges.
 */
export const isPostpaidPayableFee = (fee: any, previousMonthStr: string): boolean => {
  const type = String(fee?.transactionType || '').toUpperCase();
  if (type.includes('FINE')) return true;
  return resolveFeeBillingMonth(fee) === previousMonthStr;
};

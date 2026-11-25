/**
 * Fine Master stores a single due day (1-31) in the college's `dueDate`
 * field. Only the day matters; the month/year in storage are a placeholder.
 * The day repeats every month and fine starts the following day.
 */

export const getDueDay = (value?: string | Date | null): number | null => {
  if (!value) return null;
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  const useUtc = typeof value === 'string' || date.getUTCHours() === 0;
  const day = useUtc ? date.getUTCDate() : date.getDate();
  return day >= 1 && day <= 31 ? day : null;
};

const ordinal = (day: number) => {
  if (day % 100 >= 11 && day % 100 <= 13) return `${day}th`;
  switch (day % 10) {
    case 1: return `${day}st`;
    case 2: return `${day}nd`;
    case 3: return `${day}rd`;
    default: return `${day}th`;
  }
};

export const formatDueDay = (day: number | null): string =>
  day === null ? '-' : `Every ${ordinal(day)}`;

export const formatDueDayShort = (day: number | null): string =>
  day === null ? '-' : ordinal(day);

export const formatDueDayAndYear = (value?: string | Date | null): string => {
  const day = getDueDay(value);
  if (day === null) return '-';
  let year = new Date().getFullYear();
  if (value) {
    const d = value instanceof Date ? value : new Date(value);
    if (!isNaN(d.getTime()) && d.getFullYear() > 2000) {
      year = d.getFullYear();
    }
  }
  return `${ordinal(day)}, ${year}`;
};

/** Local Date for the configured day inside a billing month. */
export const getMonthlyDueDate = (
  day: number,
  year: number,
  monthIndex: number,
): Date => {
  const lastDay = new Date(year, monthIndex + 1, 0).getDate();
  return new Date(year, monthIndex, Math.min(day, lastDay));
};

/**
 * Days a fee is overdue, derived from its billing month (or its own due date)
 * and the Fine Master due day. The due day itself is never overdue.
 */
export const getOverdueDays = (
  collegeDueDateValue?: string | Date | null,
  options: {
    billingMonth?: string | null;
    feeDueDate?: string | Date | null;
    billingCycle?: string | null;
    asOf?: Date;
  } = {},
): number | null => {
  const day = getDueDay(collegeDueDateValue);
  if (day === null) return null;

  const asOf = options.asOf ? new Date(options.asOf) : new Date();
  asOf.setHours(0, 0, 0, 0);

  const match = /^(\d{4})-(\d{1,2})$/.exec(String(options.billingMonth || '').trim());
  let year: number;
  let monthIndex: number;

  if (match) {
    year = Number(match[1]);
    monthIndex = Number(match[2]) - 1;
    if (String(options.billingCycle || '').toUpperCase() === 'POSTPAID') {
      const next = new Date(year, monthIndex + 1, 1);
      year = next.getFullYear();
      monthIndex = next.getMonth();
    }
  } else if (options.feeDueDate) {
    const feeDate = new Date(options.feeDueDate);
    year = feeDate.getFullYear();
    monthIndex = feeDate.getMonth();
  } else {
    year = asOf.getFullYear();
    monthIndex = asOf.getMonth();
  }

  const due = getMonthlyDueDate(day, year, monthIndex);
  if (asOf.getTime() <= due.getTime()) return 0;
  return Math.floor((asOf.getTime() - due.getTime()) / 86_400_000);
};

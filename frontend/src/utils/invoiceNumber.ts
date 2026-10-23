const createInvoiceNumber = (dateValue: string | Date, serial: number | string) => {
  const date = new Date(dateValue || Date.now());
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `INV-${year}-${month}-${String(serial).padStart(3, '0')}`;
};

/**
 * A stable fallback serial derived from the transaction id.
 *
 * Invoice numbers are persisted by the backend, so this is only used if a row
 * reaches the UI before its permanent number has been allocated. Deriving the
 * serial from the id (instead of the position in a list) keeps the Fees page,
 * Student Profile and Receipt modal in sync even when they receive different
 * subsets of transactions.
 */
const serialFromId = (id?: string | null) => {
  const text = String(id || '').trim();
  if (!text) return 1;

  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }

  return ((hash >>> 0) % 900000) + 100000;
};

const buildFallbackSerialMap = (feeGroups?: any[]) => {
  if (!Array.isArray(feeGroups) || feeGroups.length === 0) return new Map<string, number>();

  const rows = feeGroups
    .map((group: any) => group?.feesList?.[0] || group)
    .filter((row: any) => row && !row.invoiceNumber && (row.id || row.studentId));

  const ordered = [...rows].sort((a, b) => {
    const aTime = new Date(a.paidDate || a.createdAt || a.updatedAt || 0).getTime();
    const bTime = new Date(b.paidDate || b.createdAt || b.updatedAt || 0).getTime();
    return aTime - bTime;
  });

  const map = new Map<string, number>();
  ordered.forEach((row, index) => {
    map.set(String(row.id || row.studentId || index), index + 1);
  });
  return map;
};

/**
 * Ensure the invoice number always carries the "INV-" prefix. Some legacy
 * rows may have been stored with a partial prefix ("V-") or without it.
 * Normalising here keeps every page in sync without touching stored data.
 */
const normaliseInvoiceNumber = (value: string | null | undefined): string => {
  if (!value) return '';
  const trimmed = String(value).trim();
  // Already correct: INV-YYYY-MM-###
  if (/^INV-\d{4}-\d{2}-\d{3}$/.test(trimmed)) return trimmed;
  // Partial prefix: V-YYYY-MM-### → INV-YYYY-MM-###
  if (/^V-\d{4}-\d{2}-\d{3}$/.test(trimmed)) return `IN${trimmed}`;
  // Bare date-serial: YYYY-MM-### → INV-YYYY-MM-###
  if (/^\d{4}-\d{2}-\d{3}$/.test(trimmed)) return `INV-${trimmed}`;
  return trimmed;
};

export const formatInvoiceNumber = (fee: any, feeGroups?: any[]) => {
  // Prefer the permanent invoice number assigned by the backend. It never
  // changes, so adding a new payment cannot renumber older receipts.
  if (fee?.invoiceNumber) return normaliseInvoiceNumber(fee.invoiceNumber);
  const numberedChild = fee?.feesList?.find((item: any) => item?.invoiceNumber);
  if (numberedChild?.invoiceNumber) return normaliseInvoiceNumber(numberedChild.invoiceNumber);

  const source = fee?.feesList?.[0] || fee;
  const dateSource =
    source?.paidDate ||
    source?.createdAt ||
    source?.updatedAt ||
    fee?.paidDate ||
    fee?.createdAt ||
    fee?.updatedAt ||
    new Date();

  const fallbackMap = buildFallbackSerialMap(feeGroups);
  const resolvedId = String(source?.id || fee?.id || '');
  const serial = fallbackMap.get(resolvedId) ?? serialFromId(source?.id || fee?.id);

  // Fallback for a row created before its invoice number was allocated.
  // Keep the month prefix but avoid cross-row collisions when the persistent
  // invoice number is still missing.
  return createInvoiceNumber(dateSource, serial);
};

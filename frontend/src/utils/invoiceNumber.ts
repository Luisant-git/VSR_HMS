const createInvoiceNumber = (dateValue: string | Date, serial: number | string) => {
  const date = new Date(dateValue || Date.now());
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `INV-${year}-${month}-${String(serial).padStart(3, '0')}`;
};

/**
 * A stable serial derived from the transaction id.
 *
 * Invoice numbers are not stored in the database, so they must be generated
 * identically everywhere. Deriving the serial from the id (instead of the
 * position in a list) keeps the Fees page, Student Profile and Receipt modal in
 * sync even when they receive different subsets of transactions.
 */
const serialFromId = (id?: string | null) => {
  const hex = String(id || '').replace(/[^0-9a-f]/gi, '');
  if (!hex) return 1;

  const parsed = Number.parseInt(hex.slice(-8), 16);
  if (!Number.isFinite(parsed)) return 1;

  return (parsed % 1000) + 1;
};

/**
 * Format the invoice number for a raw fee transaction or a grouped display row.
 * The optional second argument is kept for backwards compatibility; the number
 * is intentionally independent of the list passed in.
 */
export const formatInvoiceNumber = (fee: any, _feeGroups?: any[]) => {
  const source = fee?.feesList?.[0] || fee;
  const dateSource =
    source?.paidDate ||
    source?.updatedAt ||
    source?.createdAt ||
    fee?.paidDate ||
    fee?.updatedAt ||
    fee?.createdAt ||
    new Date();

  return createInvoiceNumber(dateSource, serialFromId(source?.id || fee?.id));
};

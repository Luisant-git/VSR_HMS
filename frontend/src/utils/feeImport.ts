import * as XLSX from 'xlsx';

export interface FeeImportRow {
  studentKey: string;
  rent?: number;
  eb?: number;
  fine?: number;
  advance?: number;
  outstanding?: number;
  advanceRent?: number;
}

export interface FeeImportParseResult {
  rows: FeeImportRow[];
  skippedPaid: number;
  skippedBlank: number;
  skippedOutstanding: number;
  errors: string[];
}

type FeeCategory = 'rent' | 'eb' | 'fine' | 'advance' | 'outstanding' | 'advanceRent';

const CATEGORY_LABELS: Record<FeeCategory, string> = {
  rent: 'Rent',
  eb: 'EB',
  fine: 'Fine',
  advance: 'Advance',
  outstanding: 'Outstanding Balance',
  advanceRent: 'Advance Rent Amount',
};

const STUDENT_HEADERS = [
  'REGNO',
  'REGISTRATIONNO',
  'STUDENTREGNO',
  'MANUALREGSINAME',
  'MANUALREGNO',
  'STUDENTID',
  'ADMISSIONNO',
  'ADMNO',
  'ROLLNO',
  'ROLLNUMBER',
  'MOBILENO',
  'MOBILE',
  'PHONENO',
  'PHONE',
  'CONTACTNO',
  'CONTACT',
  'STUDENTNAME',
  'STUDENT',
  'NAME',
  'FULLNAME',
];

const FEE_TYPE_HEADERS = ['FEETYPE', 'ROWTYPE', 'TYPE'];
const STATUS_HEADERS = ['STATUS', 'PAYMENTSTATUS'];
const RECEIPT_HEADERS = [
  'RECEIPTNO',
  'RECEIPTNUMBER',
  'INVOICENO',
  'INVOICENUMBER',
];
const OUTSTANDING_HEADERS = [
  'OUTSTANDINGBALANCE',
  'OUTSTANDINGAMOUNT',
  'OUTSTANDING',
  'OUTSTANDINGDUES',
  'PREVIOUSDUE',
  'PREVIOUSDUES',
  'PREVIOUSBALANCE',
  'PREVIOUSTOTAL',
  'ARREARS',
  'OLDDUES',
  'OLDBALANCE',
  'DUEAMOUNT',
  'DUES',
  'DUE',
  'BALANCE',
  'TOTALOUTSTANDING',
  'PENDINGAMOUNT',
  'PENDINGDUES',
  'PENDINGBALANCE',
  'OUTSTANDINGRS',
  'OUTSTANDINGINR',
  'PENDINGRS',
  'BACKLOGDUES',
  'HISTORICALOUTSTANDING',
];

const AMOUNT_HEADERS: Record<FeeCategory, string[]> = {
  rent: ['RENT', 'RENTAMOUNT', 'ROOMRENT', 'MONTHLYRENT', 'HOSTELRENT'],
  eb: ['EB', 'EBILL', 'EBAMOUNT', 'ELECTRICITY', 'ELECTRICITYBILL', 'EBFEES', 'EBFEE'],
  fine: ['FINE', 'FINEAMOUNT', 'LATEFINE', 'PENALTY'],
  advance: ['ADVANCE', 'ADVANCEAMOUNT', 'DEPOSIT', 'CAUTIONDEPOSIT', 'SECURITYDEPOSIT'],
  outstanding: OUTSTANDING_HEADERS,
  advanceRent: [
    'ADVANCERENTAMOUNT',
    'ADVANCERENT',
    'ADVANCERENTCREDIT',
    'ADVANCERENTBALANCE',
    'PREPAIDRENT',
    'RENTADVANCE',
    'ADVANCEMONTHLYRENT',
  ],
};

const normalizeHeader = (value: string) =>
  value.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');

const normalizeRow = (raw: Record<string, unknown>) => {
  const row: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (key === '__rowNum__') continue;
    row[normalizeHeader(key)] = value;
  }
  return row;
};

const readCell = (row: Record<string, unknown>, headers: string[]) => {
  for (const header of headers) {
    if (header in row) return row[header];
  }
  return undefined;
};

const cellText = (row: Record<string, unknown>, headers: string[]) => {
  const value = readCell(row, headers);
  if (value === undefined || value === null) return '';
  return String(value).trim();
};

const parseAmount = (value: unknown): { value?: number; invalid?: boolean } => {
  if (value === undefined || value === null) return {};

  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return { invalid: true };
    return { value: Math.round(value * 100) / 100 };
  }

  const text = String(value).trim();
  if (!text || text === '-' || text === '—' || /^n\/?a$/i.test(text)) {
    return {};
  }

  const cleaned = text
    .replace(/[₹,\s]/g, '')
    .replace(/^\((.*)\)$/, '-$1');
  const numeric = Number(cleaned);
  if (!Number.isFinite(numeric)) return { invalid: true };

  return { value: Math.round(numeric * 100) / 100 };
};

const isReceiptNumber = (receiptNo: string) => {
  const lower = receiptNo.toLowerCase();
  return !!lower && lower !== '—' && lower !== '-' && lower !== 'n/a';
};

interface ParsedSheetRow {
  studentKey: string;
  values: Partial<Record<FeeCategory, number>>;
}

export const parseFeeImportWorkbook = (
  data: ArrayBuffer,
): FeeImportParseResult => {
  const workbook = XLSX.read(data, { type: 'array' });
  const firstSheetName = workbook.SheetNames[0];

  if (!firstSheetName) {
    return {
      rows: [],
      skippedPaid: 0,
      skippedBlank: 0,
      skippedOutstanding: 0,
      errors: ['The workbook does not contain any sheet.'],
    };
  }

  const sheet = workbook.Sheets[firstSheetName];
  const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: '',
  });

  const errors: string[] = [];
  const parsedRows: ParsedSheetRow[] = [];
  let skippedPaid = 0;
  let skippedBlank = 0;
  let skippedOutstanding = 0;

  rawRows.forEach((raw, index) => {
    const rowNumber =
      Number((raw as Record<string, unknown>).__rowNum__) || index + 2;
    const row = normalizeRow(raw);

    const studentKey = cellText(row, STUDENT_HEADERS);
    const receiptNo = cellText(row, RECEIPT_HEADERS);

    // Skip the report TOTAL row and blank rows.
    if (
      !studentKey ||
      studentKey.toUpperCase() === 'TOTAL' ||
      receiptNo.toUpperCase() === 'TOTAL'
    ) {
      if (!studentKey && !receiptNo) skippedBlank += 1;
      return;
    }

    const status = cellText(row, STATUS_HEADERS).toLowerCase();
    const feeType = cellText(row, FEE_TYPE_HEADERS).toLowerCase();

    // Paid / partial receipts can never be edited by this import.
    if (status) {
      if (status !== 'unpaid') {
        skippedPaid += 1;
        return;
      }
    } else if (isReceiptNumber(receiptNo)) {
      skippedPaid += 1;
      return;
    }

    if (feeType.includes('receipt')) {
      skippedPaid += 1;
      return;
    }

    const values: Partial<Record<FeeCategory, number>> = {};
    let invalid = false;

    for (const category of Object.keys(AMOUNT_HEADERS) as FeeCategory[]) {
      const cell = readCell(row, AMOUNT_HEADERS[category]);
      if (cell === undefined) continue;

      const amount = parseAmount(cell);
      if (amount.invalid || (amount.value !== undefined && amount.value < 0)) {
        errors.push(
          `Row ${rowNumber}: ${CATEGORY_LABELS[category]} must be a valid amount greater than or equal to 0.`,
        );
        invalid = true;
        break;
      }
      if (amount.value !== undefined) values[category] = amount.value;
    }

    if (invalid) return;

    const hasOutstandingValue = values.outstanding !== undefined;
    const nonOutstandingTotal = (['rent', 'eb', 'fine', 'advance'] as const)
      .reduce((sum, key) => sum + (Number(values[key]) || 0), 0);

    // Legacy/explicit outstanding rows are ledger rows. They are read-only for
    // Rent/EB/Fine/Advance, but we still allow the Outstanding Balance value to
    // be imported when present.
    if (feeType.includes('outstanding')) {
      if (hasOutstandingValue) {
        parsedRows.push({ studentKey, values: { outstanding: values.outstanding } });
      } else {
        skippedOutstanding += 1;
      }
      return;
    }

    // Older exported files have no "Fee Type" column. Their outstanding row
    // shows a balance with all editable category columns at zero.
    if (!feeType && hasOutstandingValue && nonOutstandingTotal === 0) {
      parsedRows.push({
        studentKey,
        values: {
          outstanding: values.outstanding,
          ...(values.advanceRent !== undefined ? { advanceRent: values.advanceRent } : {}),
        },
      });
      return;
    }

    if (Object.keys(values).length === 0) {
      skippedBlank += 1;
      return;
    }

    parsedRows.push({ studentKey, values });
  });

  // A student may have both a Current Due row and an Outstanding row. Merge
  // them so Rent/EB/Fine/Advance and Outstanding Balance can be imported together.
  const grouped = new Map<string, ParsedSheetRow>();
  for (const row of parsedRows) {
    const key = row.studentKey.toUpperCase();
    const existing = grouped.get(key);
    if (existing) {
      const merged: Partial<Record<FeeCategory, number>> = { ...existing.values };
      for (const [category, value] of Object.entries(row.values) as Array<[FeeCategory, number | undefined]>) {
        if (value !== undefined) merged[category] = value;
      }
      grouped.set(key, { studentKey: existing.studentKey, values: merged });
    } else {
      grouped.set(key, row);
    }
  }

  return {
    rows: Array.from(grouped.values()).map(row => ({
      studentKey: row.studentKey,
      ...row.values,
    })),
    skippedPaid,
    skippedBlank,
    skippedOutstanding,
    errors,
  };
};

export const parseFeeImportFile = async (file: File) => {
  const data = await file.arrayBuffer();
  return parseFeeImportWorkbook(data);
};

import { BadRequestException, Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { WhatsappService } from '../whatsapp/whatsapp.service';
import {
  formatDateInput,
  getFinePeriods,
  latestDueDate,
  resolveFineThrough,
  sumFineDays,
} from '../common/fine-due-date';
import { CreateFeeDto } from './dto/create-fee.dto';
import { UpdateFeeDto } from './dto/update-fee.dto';
import { PayOutstandingDto } from './dto/pay-outstanding.dto';
import { ImportFeeRowInput, ImportFeesDto } from './dto/import-fees.dto';
import {
  FineKey,
  LATE_FINE_RE,
  LATE_FINE_TAG_RE,
  startOfDay,
  roundMoney,
  fineKeyFromDescription,
  hasOlderUnpaidDues,
  calculateTieredFine,
  formatFineDescription,
} from './fine-calculator';

const OUTSTANDING_PAYMENT_TYPE = 'OUTSTANDING_PAYMENT';
const OUTSTANDING_PREFIX = 'Outstanding';
const MONEY_EPSILON = 0.001;

const isOutstandingDescription = (fee: any) =>
  /^\s*outstanding\b/i.test(String(fee?.description || ''));

/**
 * October 2026 EB bills were imported as-is and are still collectable, so the
 * "previous settled" cut-off must not hide them. Kept in sync with the Fees
 * page helpers in frontend/src/utils/outstanding.ts.
 */
const isOctober2026EbBill = (fee: any) =>
  String(fee?.transactionType || '').toUpperCase() === 'EB_BILL' &&
  /(?:\b2026-10\b|\boct(?:ober)?\s*2026\b)/i.test(String(fee?.description || ''));

const IMPORTABLE_CATEGORIES = ['rent', 'eb', 'fine', 'advance'] as const;
type ImportCategory = (typeof IMPORTABLE_CATEGORIES)[number];

const IMPORT_CATEGORY_META: Record<
  ImportCategory,
  { label: string; transactionType: string; description: string }
> = {
  rent: {
    label: 'Rent',
    transactionType: 'RENT',
    description: 'Room Rent (adjusted from fees sheet)',
  },
  eb: {
    label: 'EB',
    transactionType: 'EB_BILL',
    description: 'EB Bill (adjusted from fees sheet)',
  },
  fine: {
    label: 'Fine',
    transactionType: 'FINE',
    description: 'Fine (adjusted from fees sheet)',
  },
  advance: {
    label: 'Advance',
    transactionType: 'ADVANCE',
    description: 'Advance Deposit (adjusted from fees sheet)',
  },
};

@Injectable()
export class FeesService {
  /**
   * Guards the one-time split of aggregate (legacy) fine rows so two preview
   * requests for the same student cannot create duplicate typed rows.
   */
  private readonly legacyFineSplitInFlight = new Set<string>();

  constructor(
    private prisma: PrismaService,
    private whatsapp: WhatsappService,
  ) {}

  async create(data: CreateFeeDto) {
    return this.prisma.$transaction(async tx => {
      const date = this.validatedPaymentDate(data.paidDate) || new Date();
      const invoiceNumber = await this.allocateInvoiceNumber(tx, date);
      return tx.feeTransaction.create({
        data: {
          ...data,
          paidDate: data.paidDate ? date : undefined,
          invoiceNumber,
        },
      });
    });
  }

  async findAll() {
    const rows = await this.prisma.feeTransaction.findMany({
      where: { deletedAt: null },
      include: {
        student: {
          select: {
            id: true,
            name: true,
            regNo: true,
            manualRegsiName: true,
            roomNo: true,
            mobileNo: true,
            fatherMobileNo: true,
            college: {
              select: {
                name: true,
                billingCycle: true,
                dueDate: true,
              },
            },
          },
        },
      },
    });
    return this.ensureInvoiceNumbers(rows);
  }

  async findByStudent(studentId: string) {
    const rows = await this.prisma.feeTransaction.findMany({
      where: { studentId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
      include: {
        student: {
          include: { college: true }
        }
      }
    });
    return this.ensureInvoiceNumbers(rows);
  }

  async findOne(id: string) {
    const row = await this.prisma.feeTransaction.findFirst({
      where: { id, deletedAt: null },
      include: { 
        student: {
          include: { college: true }
        }
      }
    });
    if (row) await this.ensureInvoiceNumbers([row]);
    return row;
  }

  async findTrash() {
    return this.prisma.feeTransaction.findMany({
      where: { deletedAt: { not: null } },
      orderBy: { deletedAt: 'desc' },
      include: {
        student: {
          select: {
            id: true,
            name: true,
            regNo: true,
            manualRegsiName: true,
            roomNo: true,
          },
        },
      },
    });
  }

  async moveToTrash(ids: string[], userId: string) {
    const uniqueIds = [...new Set(ids.map(id => String(id || '').trim()).filter(Boolean))];
    if (uniqueIds.length === 0 || uniqueIds.length !== ids.length) {
      throw new BadRequestException('Provide a non-empty list of unique fee transaction IDs.');
    }

    return this.prisma.$transaction(async tx => {
      const activeRows = await tx.feeTransaction.findMany({
        where: { id: { in: uniqueIds }, deletedAt: null },
        select: { id: true },
      });
      if (activeRows.length !== uniqueIds.length) {
        throw new NotFoundException('One or more fee rows do not exist or are already in the trash.');
      }

      const result = await tx.feeTransaction.updateMany({
        where: { id: { in: uniqueIds }, deletedAt: null },
        data: { deletedAt: new Date(), deletedBy: userId },
      });
      if (result.count !== uniqueIds.length) {
        throw new BadRequestException('Fee rows changed before they could be moved to the trash.');
      }
      return { moved: result.count };
    });
  }

  async restoreFromTrash(ids: string[]) {
    const uniqueIds = [...new Set(ids.map(id => String(id || '').trim()).filter(Boolean))];
    if (uniqueIds.length === 0 || uniqueIds.length !== ids.length) {
      throw new BadRequestException('Provide a non-empty list of unique fee transaction IDs.');
    }

    return this.prisma.$transaction(async tx => {
      const trashedRows = await tx.feeTransaction.findMany({
        where: { id: { in: uniqueIds }, deletedAt: { not: null } },
        select: { id: true },
      });
      if (trashedRows.length !== uniqueIds.length) {
        throw new NotFoundException('One or more trashed fee transactions were not found.');
      }

      const result = await tx.feeTransaction.updateMany({
        where: { id: { in: uniqueIds }, deletedAt: { not: null } },
        data: { deletedAt: null, deletedBy: null },
      });
      if (result.count !== uniqueIds.length) {
        throw new BadRequestException('Trashed fee rows changed before they could be restored.');
      }
      return { restored: result.count };
    });
  }

  /**
   * Invoice numbers are permanent. Any row that predates the numbering feature
   * (or was created by a path that does not allocate one) gets its number here
   * exactly once. Existing numbers are never recalculated, so adding a new
   * payment cannot renumber older receipts.
   */
  private async ensureInvoiceNumbers<T extends { id: string; invoiceNumber?: string | null }>(
    rows: T[],
  ): Promise<T[]> {
    const missing = rows.filter(row => !row.invoiceNumber);
    if (missing.length > 0) {
      missing.sort(
        (a, b) =>
          new Date((a as any).createdAt).getTime() -
          new Date((b as any).createdAt).getTime(),
      );

      // One invoice number per displayed receipt. Outstanding payments are each
      // their own receipt; unpaid outstanding invoices and current pending dues
      // are grouped per student; other paid fees are grouped per payment.
      const groups = new Map<string, T[]>();
      for (const row of missing) {
        const key = this.invoiceGroupKey(row as any);
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key)!.push(row);
      }

      const orderedGroups = Array.from(groups.values()).sort((a, b) => {
        const aTime = new Date((a[0] as any).paidDate || (a[0] as any).createdAt || 0).getTime();
        const bTime = new Date((b[0] as any).paidDate || (b[0] as any).createdAt || 0).getTime();
        return aTime - bTime;
      });

      if (orderedGroups.length > 0) {
        // Reserve one contiguous block from the global sequence so the new
        // numbers stay in order even when several receipts are numbered at once.
        const counter = await this.prisma.invoiceCounter.upsert({
          where: { period: this.invoiceSequenceKey },
          create: { period: this.invoiceSequenceKey, value: orderedGroups.length },
          update: { value: { increment: orderedGroups.length } },
        });
        const firstSerial = counter.value - orderedGroups.length + 1;
        const numberedGroups = orderedGroups.map((group, index) => {
          const first = group[0] as any;
          const date = new Date(first.paidDate || first.createdAt || Date.now());
          return {
            group,
            invoiceNumber: this.formatInvoiceNumber(date, firstSerial + index),
          };
        });

        for (let offset = 0; offset < numberedGroups.length; offset += 25) {
          const batch = numberedGroups.slice(offset, offset + 25);
          await Promise.all(
            batch.map(async ({ group, invoiceNumber }) => {
              await this.prisma.feeTransaction.updateMany({
                where: { id: { in: group.map(row => row.id) } },
                data: { invoiceNumber },
              });
              group.forEach(row => {
                (row as any).invoiceNumber = invoiceNumber;
              });
            }),
          );
        }
      }
    }

    // Keep the sequence counter ahead of every number already stored so a new
    // receipt can never reuse an existing number.
    const maxSerial = rows.reduce((max, row) => {
      const match = /^INV-\d{4}-(\d{3})$/.exec(String((row as any).invoiceNumber || '').trim());
      return match ? Math.max(max, Number(match[1])) : max;
    }, 0);
    const counterRow = await this.prisma.invoiceCounter.findUnique({
      where: { period: this.invoiceSequenceKey },
    });
    if (!counterRow || counterRow.value < maxSerial) {
      await this.prisma.invoiceCounter.upsert({
        where: { period: this.invoiceSequenceKey },
        create: { period: this.invoiceSequenceKey, value: Math.max(maxSerial, 1) },
        update: { value: Math.max(maxSerial, 1) },
      });
    }

    // Convert legacy receipt numbers (INV-YYYY-MM-NNN) to the new global
    // sequence, oldest payment first, and give every separate payment its own
    // number. Numbers already in the new format are left untouched.
    const receiptGroups = new Map<string, any[]>();
    for (const row of rows) {
      const item = row as any;
      if (item.status !== 'COMPLETED') continue;
      const key = `${item.studentId}-${this.paymentGroupKey(item)}`;
      if (!receiptGroups.has(key)) receiptGroups.set(key, []);
      receiptGroups.get(key)!.push(row);
    }
    const orderedReceipts = Array.from(receiptGroups.values()).sort((a, b) => {
      const aTime = new Date((a[0] as any).paidDate || (a[0] as any).createdAt || 0).getTime();
      const bTime = new Date((b[0] as any).paidDate || (b[0] as any).createdAt || 0).getTime();
      return aTime - bTime || String((a[0] as any).id).localeCompare(String((b[0] as any).id));
    });

    const usedNumbers = new Set<string>();
    for (const group of orderedReceipts) {
      const first = group[0] as any;
      const current = String(first.invoiceNumber || '').trim();
      const allSame = group.every(
        row => String((row as any).invoiceNumber || '').trim() === current,
      );
      if (
        current &&
        allSame &&
        this.isSequentialInvoiceNumber(current) &&
        !usedNumbers.has(current)
      ) {
        usedNumbers.add(current);
        continue;
      }

      const date = new Date(first.paidDate || first.createdAt || Date.now());
      const newNumber = await this.allocateInvoiceNumber(this.prisma, date);
      await this.prisma.feeTransaction.updateMany({
        where: { id: { in: group.map(row => (row as any).id) } },
        data: { invoiceNumber: newNumber },
      });
      group.forEach(row => {
        (row as any).invoiceNumber = newNumber;
      });
      usedNumbers.add(newNumber);
    }

    return rows;
  }

  private paymentGroupKey(row: any) {
    const description = String(row.description || '');
    return (
      description.match(/\[PAY:([^\]]+)\]/)?.[1] ||
      description.match(/\|\s*Ref:\s*Razorpay\s+([^\s|]+)/i)?.[1] ||
      String(row.id)
    );
  }

  private invoiceGroupKey(row: any) {
    const type = String(row.transactionType || '').toUpperCase();
    if (type === OUTSTANDING_PAYMENT_TYPE) return `outstanding-payment-${row.id}`;
    if (row.status === 'PENDING' && isOutstandingDescription(row)) {
      return `outstanding-invoice-${row.studentId}`;
    }
    if (row.status === 'PENDING') return `pending-${row.studentId}`;
    // Rows from the same payment submission share one receipt number. Never
    // key on the minute alone: two separate payments made in the same minute
    // would otherwise be handed the same invoice number.
    const paymentToken = this.paymentGroupKey(row);
    if (paymentToken !== String(row.id)) {
      return `paid-${row.studentId}-payment-${paymentToken}`;
    }
    const time = new Date(row.paidDate || row.createdAt).toISOString().slice(0, 16);
    return `paid-${row.studentId}-${time}`;
  }

  private readonly invoiceSequenceKey = 'INVOICE_SEQUENCE';

  private invoicePeriod(date: Date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  }

  /** New numbers look like INV-2026-001 (year + 3-digit sequence). */
  private formatInvoiceNumber(date: Date, serial: number) {
    return `INV-${date.getFullYear()}-${String(serial).padStart(3, '0')}`;
  }

  private isSequentialInvoiceNumber(value?: string | null) {
    return /^INV-\d{4}-\d{3}$/.test(String(value || '').trim());
  }

  private async allocateInvoiceNumber(
    client: Prisma.TransactionClient | PrismaService,
    date: Date,
  ): Promise<string> {
    // One global counter keeps both invoice numbers and receipt numbers in a
    // single unbroken sequence instead of restarting every month.
    const counter = await client.invoiceCounter.upsert({
      where: { period: this.invoiceSequenceKey },
      create: { period: this.invoiceSequenceKey, value: 1 },
      update: { value: { increment: 1 } },
    });
    return this.formatInvoiceNumber(date, counter.value);
  }

  async update(id: string, data: UpdateFeeDto) {
    const existing = await this.prisma.feeTransaction.findFirst({
      where: { id, deletedAt: null },
    });
    if (!existing) {
      throw new NotFoundException('Active fee transaction not found.');
    }

    // Pending dues of one student intentionally share a single invoice number
    // (they are one row in the Fees table). Once a fee is paid it becomes its
    // own receipt, so it needs its own permanent number.
    let invoiceNumber = existing.invoiceNumber;
    const shouldAllocate =
      data.status === 'COMPLETED' &&
      existing.status !== 'COMPLETED' &&
      (!this.isSequentialInvoiceNumber(invoiceNumber) ||
        (await this.prisma.feeTransaction.count({
          where: {
            invoiceNumber,
            deletedAt: null,
            id: { not: id },
          },
        })) > 0);
    if (shouldAllocate) {
      const date = data.paidDate
        ? this.validatedPaymentDate(data.paidDate) ?? new Date()
        : new Date();
      invoiceNumber = await this.allocateInvoiceNumber(this.prisma, date);
    }

    const result = await this.prisma.feeTransaction.updateMany({
      where: { id, deletedAt: null },
      data: {
        ...data,
        ...(invoiceNumber ? { invoiceNumber } : {}),
        paidDate: data.paidDate
          ? this.validatedPaymentDate(data.paidDate)
          : data.paidDate,
      },
    });
    if (result.count !== 1) {
      throw new NotFoundException('Active fee transaction not found.');
    }

    const updated = await this.prisma.feeTransaction.findUnique({
      where: { id },
      include: {
        student: {
          select: {
            name: true,
            regNo: true,
            manualRegsiName: true,
            roomNo: true,
            mobileNo: true,
            fatherMobileNo: true,
          },
        },
      },
    });

    if (data.status === 'COMPLETED' && updated?.student) {
      const student = updated.student;
      const phone = student.mobileNo || student.fatherMobileNo;
      if (phone) {
        const descRaw = String(updated.description || '');
        const parseDesc = (key: string) => {
          const match = descRaw.match(new RegExp(`(?:^|\\|)\\s*${key}:\\s*([^|]+)`, 'i'));
          return match && match[1].trim() ? match[1].trim() : '';
        };

        const rawNotes = parseDesc('Notes').replace(/\s*\[PAY:[^\]]+\]/g, '').trim();
        const notes = /^(Original Amount|Discount|Pending Balance)\s*:/i.test(rawNotes) ? '' : rawNotes;
        const discountStr = parseDesc('Discount');
        const discount = discountStr ? parseFloat(discountStr) || 0 : 0;
        const origStr = parseDesc('Original Amount');
        const grossAmount = origStr ? parseFloat(origStr) || (Number(updated.amount || 0) + discount) : (Number(updated.amount || 0) + discount);
        const pendingStr = parseDesc('Pending Balance');
        const pendingBalance = pendingStr ? parseFloat(pendingStr) || 0 : 0;
        const baseDescription = descRaw.split('|')[0]?.trim() || `${updated.transactionType} for ${updated.billingMonth || ''}`;

        const invoiceNo = updated.invoiceNumber || '';
        const invoiceParts = /^INV-\d{4}-(?:(\d{2})-)?(\d+)$/.exec(invoiceNo);
        const invoiceSerial = invoiceParts?.[2] ?? invoiceParts?.[1];
        const receiptNo = invoiceSerial ? String(Number(invoiceSerial)) : '1';

        this.whatsapp
          .sendFeeReceipt(phone, {
            studentName: student.name,
            regNo: student.manualRegsiName || student.regNo,
            roomNo: student.roomNo || undefined,
            billingMonth: updated.billingMonth || undefined,
            dueDate: updated.dueDate ? new Date(updated.dueDate).toLocaleDateString('en-GB') : undefined,
            invoiceNo: invoiceNo || undefined,
            receiptNo: receiptNo,
            receiptDate: updated.paidDate
              ? new Date(updated.paidDate).toLocaleDateString('en-GB')
              : undefined,
            amount: Number(updated.amount || 0),
            grossAmount: grossAmount > 0 ? grossAmount : Number(updated.amount || 0),
            discountAmount: discount,
            paymentMode: updated.paymentMode || 'Cash',
            gatewayMethod: updated.paymentMode && updated.paymentMode.toUpperCase() === 'RAZORPAY' ? 'Online' : 'Manual',
            paymentStatus: 'PAID',
            pendingBalance: pendingBalance,
            notes: notes || undefined,
            items: [
              {
                description: baseDescription,
                type: updated.transactionType || 'Fee',
                amount: grossAmount > 0 ? grossAmount : Number(updated.amount || 0),
              },
            ],
          })
          .catch((err) => console.error('Automated WhatsApp send error:', err));
      }
    }

    return updated;
  }

  private validatedPaymentDate(value?: string) {
    if (!value) return undefined;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException('Payment date must be valid and cannot be in the future.');
    }
    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);
    if (date > endOfToday) {
      throw new BadRequestException('Payment date must be valid and cannot be in the future.');
    }
    return date;
  }

  async previewFine(studentId: string, asOfDateValue: string) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(asOfDateValue || '')) {
      throw new BadRequestException('Choose a valid payment date.');
    }

    const [year, month, day] = asOfDateValue.split('-').map(Number);
    const asOfDate = new Date(year, month - 1, day);
    if (
      Number.isNaN(asOfDate.getTime()) ||
      asOfDate.getFullYear() !== year ||
      asOfDate.getMonth() !== month - 1 ||
      asOfDate.getDate() !== day
    ) {
      throw new BadRequestException('Choose a valid payment date.');
    }
    asOfDate.setHours(0, 0, 0, 0);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (asOfDate.getTime() > today.getTime()) {
      throw new BadRequestException('Payment date cannot be in the future.');
    }

    const student = await this.prisma.student.findUnique({
      where: { id: studentId },
      include: {
        college: { include: { fineMaster: true } },
        // Include paid fees too so we can tell a genuinely owed fine (parent
        // fee was paid, fine still pending) from an orphan fine left over for
        // a fee this student never had.
        transactions: { where: { status: { in: ['PENDING', 'COMPLETED'] }, deletedAt: null } },
      },
    });
    if (!student) throw new NotFoundException('Student not found.');

    const collegeDueDate = student.college?.dueDate
      ? startOfDay(new Date(student.college.dueDate))
      : null;
    const allTransactions = student.transactions || [];
    const pending = allTransactions.filter((item: any) => item.status === 'PENDING');
    const fineMaster = student.college?.fineMaster;

    // Payment-aware fine basis: completed fees stop at their paid date, and
    // outstanding invoices stop when the matching payment clears them.
    const feeRows = allTransactions.filter((item: any) => {
      const type = String(item.transactionType || '').toUpperCase();
      return type !== 'FINE' && type !== OUTSTANDING_PAYMENT_TYPE;
    });
    const paymentRows = allTransactions.filter(
      (item: any) =>
        String(item.transactionType || '').toUpperCase() === OUTSTANDING_PAYMENT_TYPE &&
        item.status === 'COMPLETED',
    );
    const fineThroughValues = resolveFineThrough(feeRows, paymentRows);
    const fineThroughByFee = new Map<any, Date | null>(
      feeRows.map((row, index) => [row, fineThroughValues[index]]),
    );
    const withFineThrough = (rows: any[]) =>
      rows.map((row) => ({ ...row, fineThrough: fineThroughByFee.get(row) ?? null }));

    const completedFines = await this.prisma.feeTransaction.findMany({
      where: {
        studentId,
        status: 'COMPLETED',
        transactionType: 'FINE',
        deletedAt: null,
        description: { startsWith: 'Late fine accumulation', mode: 'insensitive' },
      },
      select: { amount: true, description: true },
    });

    // Track how much fine was already paid, separately per fee type, so a
    // backdated receipt only reduces the fine types that are still pending.
    const paidByType: Record<FineKey, number> = { rent: 0, mess: 0, eb: 0 };
    let legacyPaid = 0;
    completedFines.forEach((item) => {
      const amount = Number(item.amount) || 0;
      const key = fineKeyFromDescription(item.description);
      if (key) paidByType[key] += amount;
      else legacyPaid += amount;
    });

    const pendingLateFines = pending.filter(
      (item) =>
        String(item.transactionType || '').toUpperCase() === 'FINE' &&
        LATE_FINE_RE.test(String(item.description || '')),
    );

    const configs: Array<{
      key: FineKey;
      label: string;
      rate: number;
      types: string[];
    }> = [
      {
        key: 'rent',
        label: 'Rent',
        rate: Number(fineMaster?.rentFine) || 0,
        types: ['RENT', 'ADVANCE'],
      },
      { key: 'mess', label: 'Mess', rate: Number(fineMaster?.messFine) || 0, types: ['MESS'] },
      { key: 'eb', label: 'EB', rate: Number(fineMaster?.ebFine) || 0, types: ['EB_BILL'] },
    ];

    const fines: Array<{
      key: FineKey;
      label: string;
      rate: number;
      effectiveRate: number;
      isDoubled: boolean;
      regularDays: number;
      doubledDays: number;
      dueDate: string;
      daysOverdue: number;
      currentDaysOverdue: number;
      amount: number;
      currentAmount: number;
    }> = [];

    for (const config of configs) {
      const pendingParents = pending.filter((item) =>
        config.types.includes(
          String(item.transactionType || '').toUpperCase(),
        ),
      );
      const typedFine = pendingLateFines.find(
        (item) => fineKeyFromDescription(item.description) === config.key,
      );

      // Only charge a fee type when the student actually has that fee. A
      // typed fine alone is not enough: an orphan fine (e.g. EB fine with no
      // EB bill) must not keep creating a charge every time Pay Now opens.
      const hasParentFeeEver = allTransactions.some((item: any) =>
        config.types.includes(String(item.transactionType || '').toUpperCase()),
      );
      if (!hasParentFeeEver) continue;

      let rate = config.rate;

      // Older rows may predate Fine Master. Fall back to the rate stored in
      // the fine description ("... (₹10/day)").
      if (rate <= 0) {
        const rateMatch = typedFine?.description?.match(/₹([\d,.]+)\/day/i);
        rate = rateMatch ? Number(rateMatch[1].replace(/,/g, '')) || 0 : 0;
      }
      if (rate <= 0) continue;

      // Fine Master holds a day of month, not a one-off date. Every unpaid
      // fee gets its own due date in its own billing month; counting starts
      // the day after that due date. If every fee of this type was already
      // paid but a fine row is still pending, quote against the last fee so
      // the stored fine remains collectable.
      const feesOfType = allTransactions.filter((item: any) =>
        config.types.includes(String(item.transactionType || '').toUpperCase()),
      );
      const basisFees = pendingParents.length > 0 ? pendingParents : feesOfType;
      const basis = {
        collegeDueDate: student.college?.dueDate,
        billingCycle: student.college?.billingCycle,
      };
      const asOfPeriods = getFinePeriods(withFineThrough(basisFees), basis, asOfDate);
      const currentPeriods = getFinePeriods(withFineThrough(basisFees), basis, today);
      if (asOfPeriods.length === 0 && currentPeriods.length === 0) continue;

      const asOfDays = sumFineDays(asOfPeriods);
      const currentDays = sumFineDays(currentPeriods);
      const paid = roundMoney(paidByType[config.key]);
      const dueDateForDisplay =
        latestDueDate(currentPeriods) ?? latestDueDate(asOfPeriods) ?? collegeDueDate;
      if (!dueDateForDisplay) continue;

      const hasOlder = hasOlderUnpaidDues(pending, dueDateForDisplay);
      const calcAsOf = calculateTieredFine(asOfDays, rate, hasOlder);
      const calcToday = calculateTieredFine(currentDays, rate, hasOlder);

      const amountAsOf = roundMoney(Math.max(0, calcAsOf.amount - paid));
      const amountToday = roundMoney(Math.max(0, calcToday.amount - paid));

      fines.push({
        key: config.key,
        label: config.label,
        rate: roundMoney(rate),
        effectiveRate: roundMoney(calcAsOf.effectiveRate),
        isDoubled: calcAsOf.isDoubled,
        regularDays: calcAsOf.regularDays,
        doubledDays: calcAsOf.doubledDays,
        dueDate: formatDateInput(dueDateForDisplay),
        daysOverdue: asOfDays,
        currentDaysOverdue: currentDays,
        amount: amountAsOf,
        currentAmount: amountToday,
      });
    }

    // Older deployments stored a single combined fine row (no fee-type tag).
    // Split it the first time this student's fine preview is requested, so the
    // Pay Now modal can show a separate Rent/EB fine checkbox immediately
    // instead of waiting for the nightly cron migration.
    await this.splitLegacyPendingFines(studentId, pending, fines);

    const pendingFineRows = await this.prisma.feeTransaction.findMany({
      where: {
        studentId,
        status: 'PENDING',
        transactionType: 'FINE',
        deletedAt: null,
        description: {
          startsWith: 'Late fine accumulation -',
          mode: 'insensitive',
        },
      },
      select: {
        id: true,
        studentId: true,
        amount: true,
        description: true,
        status: true,
        billingMonth: true,
        dueDate: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    // Legacy databases may have no Fine Master rates and no typed fine rows.
    // Fall back to the rate stored in the pending fine description, still
    // applying the configured due day on a monthly basis.
    if (fines.length === 0) {
      const legacyRateMatch = pendingLateFines[0]?.description?.match(
        /₹([\d,.]+)\/day/i,
      );
      const legacyRate = legacyRateMatch
        ? Number(legacyRateMatch[1].replace(/,/g, '')) || 0
        : 0;
      if (legacyRate > 0 && collegeDueDate) {
        const alreadyPaid = roundMoney(
          paidByType.rent + paidByType.mess + paidByType.eb + legacyPaid,
        );
        const basis = {
          collegeDueDate: student.college?.dueDate,
          billingCycle: student.college?.billingCycle,
        };
        const quoteFees = pendingLateFines.length > 0 ? pendingLateFines : allTransactions;
        const asOfDays = sumFineDays(getFinePeriods(quoteFees, basis, asOfDate));
        const currentDays = sumFineDays(getFinePeriods(quoteFees, basis, today));
        const hasOlder = hasOlderUnpaidDues(pending, collegeDueDate);
        const calcAsOf = calculateTieredFine(asOfDays, legacyRate, hasOlder);
        const calcToday = calculateTieredFine(currentDays, legacyRate, hasOlder);
        return {
          asOfDate: asOfDateValue,
          daysOverdue: asOfDays,
          dailyFine: roundMoney(calcAsOf.effectiveRate),
          amount: roundMoney(
            Math.max(0, calcAsOf.amount - alreadyPaid),
          ),
          currentAmount: roundMoney(
            Math.max(0, calcToday.amount - alreadyPaid),
          ),
          hasOlderUnpaidDue: hasOlder,
          isDoubled: calcAsOf.isDoubled,
          fines: [],
          pendingFines: pendingFineRows,
        };
      }
    }

    // Aggregate fields kept for existing callers. Per-type amounts are
    // returned in `fines`; legacy (untagged) paid fines are deducted from the
    // total so the same money is not counted twice.
    const typedAmount = roundMoney(
      fines.reduce((sum, entry) => sum + entry.amount, 0),
    );
    const typedCurrentAmount = roundMoney(
      fines.reduce((sum, entry) => sum + entry.currentAmount, 0),
    );
    const hasDoubled = fines.some((entry) => entry.isDoubled);
    const hasOlder = fines.length > 0 ? hasOlderUnpaidDues(pending, collegeDueDate) : false;

    return {
      asOfDate: asOfDateValue,
      daysOverdue: fines.reduce(
        (max, entry) => Math.max(max, entry.daysOverdue),
        0,
      ),
      dailyFine: roundMoney(
        fines.reduce((sum, entry) => sum + (entry.isDoubled ? entry.effectiveRate : entry.rate), 0),
      ),
      amount: roundMoney(Math.max(0, typedAmount - legacyPaid)),
      currentAmount: roundMoney(
        Math.max(0, typedCurrentAmount - legacyPaid),
      ),
      hasOlderUnpaidDue: hasOlder,
      isDoubled: hasDoubled,
      fines,
      pendingFines: pendingFineRows,
    };
  }

  /**
   * Converts legacy aggregate late-fine rows ("Late fine accumulation for N
   * days overdue") into one row per fee type, preserving the accumulated
   * total. Mirrors the nightly cron migration, but runs on demand so the
   * payment modal can show separate fine checkboxes right away.
   */
  private async splitLegacyPendingFines(
    studentId: string,
    pending: any[],
    fines: Array<{
      key: FineKey;
      label: string;
      rate: number;
      currentDaysOverdue: number;
      currentAmount: number;
    }>,
  ) {
    const pendingLateFines = pending.filter(
      (item) =>
        String(item.transactionType || '').toUpperCase() === 'FINE' &&
        LATE_FINE_RE.test(String(item.description || '')),
    );
    const legacyRows = pendingLateFines.filter(
      (item) => !fineKeyFromDescription(item.description),
    );
    if (legacyRows.length === 0) return;
    // Typed rows already exist -> nothing to migrate.
    if (
      pendingLateFines.some((item) => fineKeyFromDescription(item.description))
    ) {
      return;
    }
    if (this.legacyFineSplitInFlight.has(studentId)) return;

    const entries = fines.filter(
      (entry) => entry.rate > 0 && entry.currentDaysOverdue > 0,
    );
    if (entries.length === 0) return;

    const legacyTotal = roundMoney(
      legacyRows.reduce((sum, item) => sum + (Number(item.amount) || 0), 0),
    );
    if (legacyTotal <= 0) return;

    this.legacyFineSplitInFlight.add(studentId);
    try {
      const grossTotal = roundMoney(
        entries.reduce(
          (sum, entry) => sum + entry.rate * entry.currentDaysOverdue,
          0,
        ),
      );
      let allocated = 0;
      let created = 0;

      for (let index = 0; index < entries.length; index += 1) {
        const entry = entries[index];
        const isLast = index === entries.length - 1;
        const share = isLast
          ? roundMoney(legacyTotal - allocated)
          : roundMoney(
              (legacyTotal * (entry.rate * entry.currentDaysOverdue)) /
                (grossTotal || 1),
            );
        allocated = roundMoney(allocated + share);
        if (share <= 0) continue;

        // Store at least today's per-type amount (what the nightly cron would
        // set), so the Fees table and the Pay Now quote show the same fine.
        const amount = roundMoney(
          Math.max(share, Number(entry.currentAmount) || 0),
        );
        if (amount <= 0) continue;

        const desc = formatFineDescription(
          entry.label,
          entry.currentDaysOverdue,
          entry.rate,
          {
            isDoubled: (entry as any).isDoubled ?? false,
            regularDays: (entry as any).regularDays ?? 30,
            doubledDays: (entry as any).doubledDays ?? 0,
            effectiveRate: (entry as any).effectiveRate ?? entry.rate,
          },
        );
        await this.prisma.feeTransaction.create({
          data: {
            studentId,
            transactionType: 'FINE',
            amount,
            status: 'PENDING',
            description: desc,
          },
        });
        created += 1;
      }

      if (created > 0) {
        await this.prisma.feeTransaction.deleteMany({
          where: { id: { in: legacyRows.map((item) => item.id) } },
        });
      }
    } finally {
      this.legacyFineSplitInFlight.delete(studentId);
    }
  }

  private startOfDay(value: Date) {
    const date = new Date(value);
    date.setHours(0, 0, 0, 0);
    return date;
  }

  /**
   * Applies a (possibly partial) payment against a student's outstanding balance.
   *
   * Ledger model (no invoice is ever mutated):
   * - Outstanding invoices are the original PENDING RENT / EB_BILL rows added
   *   through the Admin "Outstanding Payments" module. Their descriptions start
   *   with "Outstanding" and their amounts are the original billed amounts.
   * - Every confirmed payment is stored as ONE separate COMPLETED
   *   `OUTSTANDING_PAYMENT` transaction.
   * - Remaining balance = sum(original outstanding invoices)
   *                       - sum(confirmed OUTSTANDING_PAYMENT transactions).
   *
   * This guarantees that a partial payment (e.g. ₹2,000 against ₹5,000) only
   * moves the balance to ₹3,000, leaves every invoice amount untouched, and is
   * never subtracted from more than one row.
   *
   * All reads/writes happen inside a serializable transaction so concurrent
   * requests cannot overpay.
   */
  async payOutstanding(dto: PayOutstandingDto) {
    const amount = roundMoney(Number(dto.amount));
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new BadRequestException('Payment amount must be greater than zero.');
    }
    if (dto.paidDate) {
      const paidDate = new Date(dto.paidDate);
      if (Number.isNaN(paidDate.getTime())) {
        throw new BadRequestException('Payment date must be valid and cannot be in the future.');
      }
      const endOfToday = new Date();
      endOfToday.setHours(23, 59, 59, 999);
      if (paidDate > endOfToday) {
        throw new BadRequestException('Payment date must be valid and cannot be in the future.');
      }
    }

    const requestId = dto.requestId?.trim() || undefined;
    const maxAttempts = 3;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await this.prisma.$transaction(
          (tx) => this.applyOutstandingPayment(tx, dto, amount, requestId),
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
        );
      } catch (error: any) {
        // P2034 = write conflict / serialization failure. Retry the whole
        // transaction so the amount is re-validated against fresh data.
        if (error?.code === 'P2034' && attempt < maxAttempts) continue;
        throw error;
      }
    }

    throw new InternalServerErrorException(
      'Unable to process the outstanding payment. Please try again.',
    );
  }

  async applyVerifiedRazorpayOutstandingPayment(
    tx: Prisma.TransactionClient,
    studentId: string,
    amount: number,
    orderId: string,
    paymentId: string,
    paymentStatus: string,
    paymentMethod?: string,
  ) {
    return this.applyOutstandingPayment(
      tx,
      {
        studentId,
        amount,
        paymentMode: 'RAZORPAY',
        referenceNumber: `Razorpay ${paymentId}`,
        requestId: `RZP-${orderId}`,
      },
      roundMoney(amount),
      `RZP-${orderId}`,
      { orderId, paymentId, paymentStatus, paymentMethod },
    );
  }

  private async applyOutstandingPayment(
    tx: Prisma.TransactionClient,
    dto: PayOutstandingDto,
    amount: number,
    requestId?: string,
    gateway?: {
      orderId: string;
      paymentId: string;
      paymentStatus: string;
      paymentMethod?: string;
    },
  ) {
    const { studentId } = dto;

    // Idempotency: a repeat of an already applied request returns the original
    // result instead of charging the student twice.
    if (requestId) {
      const marker = `[REQ:${requestId}]`;
      const existing = await tx.feeTransaction.findMany({
        where: {
          studentId,
          status: 'COMPLETED',
          transactionType: OUTSTANDING_PAYMENT_TYPE,
          deletedAt: null,
          description: { contains: marker },
        },
        orderBy: { createdAt: 'asc' },
      });

      if (existing.length > 0) {
        const payment = existing[0];
        if (!payment.invoiceNumber) {
          const invoiceNumber = await this.allocateInvoiceNumber(
            tx,
            payment.paidDate || payment.createdAt,
          );
          await tx.feeTransaction.update({
            where: { id: payment.id },
            data: { invoiceNumber },
          });
          payment.invoiceNumber = invoiceNumber;
        }
        const invoices = await this.getOutstandingInvoices(tx, studentId);
        const payments = await this.getConfirmedOutstandingPayments(tx, studentId);
        const originalOutstanding = this.sumAmounts(invoices);
        const totalPaid = this.sumAmounts(payments);
        const appliedAmount = roundMoney(Number(payment.amount) || 0);

        return {
          duplicate: true,
          studentId,
          amount: appliedAmount,
          appliedAmount,
          originalOutstanding,
          previouslyPaid: roundMoney(Math.max(0, totalPaid - appliedAmount)),
          remainingOutstanding: roundMoney(Math.max(0, originalOutstanding - totalPaid)),
          payments: [payment],
          payment,
          allocations: this.allocatePayments(invoices, totalPaid - appliedAmount, appliedAmount),
        };
      }
    }

    // Original outstanding invoices. These rows are never modified.
    const invoices = await this.getOutstandingInvoices(tx, studentId);
    if (invoices.length === 0) {
      throw new BadRequestException('This student has no outstanding balance to pay.');
    }

    const originalOutstanding = this.sumAmounts(invoices);
    const payments = await this.getConfirmedOutstandingPayments(tx, studentId);
    const previouslyPaid = this.sumAmounts(payments);
    const remainingBefore = roundMoney(Math.max(0, originalOutstanding - previouslyPaid));

    if (remainingBefore <= MONEY_EPSILON) {
      throw new BadRequestException(
        "This student's outstanding balance has already been settled.",
      );
    }

    if (amount > remainingBefore + MONEY_EPSILON) {
      throw new BadRequestException(
        `Payment amount ₹${amount.toFixed(2)} exceeds the remaining outstanding balance of ₹${remainingBefore.toFixed(2)}.`,
      );
    }

    // ONE ledger row per payment. No invoice amount or status is touched.
    const paidDate = dto.paidDate ? new Date(dto.paidDate) : new Date();
    const invoiceNumber = await this.allocateInvoiceNumber(tx, paidDate);
    const created = await tx.feeTransaction.create({
      data: {
        studentId,
        transactionType: OUTSTANDING_PAYMENT_TYPE,
        amount,
        status: 'COMPLETED',
        paymentMode: dto.paymentMode,
        paidDate,
        invoiceNumber,
        description: `Outstanding payment${this.buildDescriptionSuffix(dto, requestId)}`,
        razorpayOrderId: gateway?.orderId,
        razorpayPaymentId: gateway?.paymentId,
        paymentStatus: gateway?.paymentStatus,
        paymentMethod: gateway?.paymentMethod,
      },
    });

    // Automated WhatsApp receipt dispatch with zero clicks
    this.prisma.student
      .findUnique({
        where: { id: studentId },
        select: {
          name: true,
          regNo: true,
          manualRegsiName: true,
          roomNo: true,
          mobileNo: true,
          fatherMobileNo: true,
        },
      })
      .then((student) => {
        if (student) {
          const phone = student.mobileNo || student.fatherMobileNo;
          if (phone) {
            this.whatsapp
              .sendFeeReceipt(phone, {
                studentName: student.name,
                regNo: student.manualRegsiName || student.regNo,
                roomNo: student.roomNo || undefined,
                invoiceNo: invoiceNumber,
                amount,
                paymentMode: dto.paymentMode,
                receiptDate: paidDate.toLocaleDateString('en-GB'),
                items: [{ type: 'Outstanding Balance Payment', amount }],
              })
              .catch((err) => console.error('Automated WhatsApp dispatch error:', err));
          }
        }
      })
      .catch(() => {});

    return {
      duplicate: false,
      studentId,
      amount,
      appliedAmount: amount,
      originalOutstanding,
      previouslyPaid,
      remainingOutstanding: roundMoney(
        Math.max(0, originalOutstanding - previouslyPaid - amount),
      ),
      payments: [created],
      payment: created,
      // Read-only breakdown of how this payment maps to the original invoices
      // (oldest first). It is derived, never persisted, so a payment cannot be
      // subtracted from more than one invoice row.
      allocations: this.allocatePayments(invoices, previouslyPaid, amount),
    };
  }

  private getOutstandingInvoices(tx: Prisma.TransactionClient, studentId: string) {
    return tx.feeTransaction.findMany({
      where: {
        studentId,
        status: 'PENDING',
        deletedAt: null,
        transactionType: { notIn: ['MESS', 'MESS DEDUCTION'] },
        description: { startsWith: OUTSTANDING_PREFIX, mode: 'insensitive' },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  private getConfirmedOutstandingPayments(tx: Prisma.TransactionClient, studentId: string) {
    return tx.feeTransaction.findMany({
      where: {
        studentId,
        status: 'COMPLETED',
        deletedAt: null,
        transactionType: OUTSTANDING_PAYMENT_TYPE,
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  private sumAmounts(rows: Array<{ amount: number }>) {
    return roundMoney(rows.reduce((sum, row) => sum + (Number(row.amount) || 0), 0));
  }

  /**
   * Distributes already-paid and newly-paid amounts across the original
   * invoices oldest-first. Used only for the response / payment history.
   */
  private allocatePayments(
    invoices: Array<{ id: string; amount: number; transactionType: string; description: string | null }>,
    alreadyPaid: number,
    paymentAmount: number,
  ) {
    let covered = roundMoney(Math.max(0, alreadyPaid));
    let leftToApply = roundMoney(Math.max(0, paymentAmount));

    return invoices.map(invoice => {
      const originalAmount = roundMoney(Number(invoice.amount) || 0);
      const coveredBefore = roundMoney(Math.min(covered, originalAmount));
      covered = roundMoney(covered - coveredBefore);

      const available = roundMoney(originalAmount - coveredBefore);
      const appliedAmount = roundMoney(Math.min(leftToApply, available));
      leftToApply = roundMoney(leftToApply - appliedAmount);

      const paidAmount = roundMoney(coveredBefore + appliedAmount);
      return {
        invoiceId: invoice.id,
        transactionType: invoice.transactionType,
        description: invoice.description,
        originalAmount,
        paidAmount,
        appliedAmount,
        remainingAmount: roundMoney(originalAmount - paidAmount),
      };
    });
  }

  private buildDescriptionSuffix(dto: PayOutstandingDto, requestId?: string) {
    let suffix = '';
    if (dto.referenceNumber) suffix += ` | Ref: ${dto.referenceNumber}`;
    if (dto.notes) {
      // Keep user remarks in Notes, but store receipt metadata as separate
      // segments so parsers don't show metadata as remarks.
      const parts = dto.notes.split('|').map((p) => p.trim()).filter(Boolean);
      const userParts: string[] = [];
      for (const part of parts) {
        if (/^(Original Amount|Discount|Pending Balance):/i.test(part) || /^\[PAY:[^\]]+\]$/i.test(part)) {
          suffix += ` | ${part}`;
        } else {
          userParts.push(part);
        }
      }
      const userNote = userParts.join(' | ').trim();
      if (userNote) suffix += ` | Notes: ${userNote}`;
    }
    if (requestId) suffix += ` | [REQ:${requestId}]`;
    return suffix;
  }

  /**
   * Applies Rent / EB / Fine / Advance / Outstanding Balance values edited in
   * the Fees Excel sheet.
   *
   * Rent/EB/Fine/Advance adjust the student's *current* PENDING dues. Paid
   * receipts, historical outstanding invoices and the pre-cutoff imported
   * ledger are never edited. Outstanding Balance is treated as the target
   * remaining outstanding balance: increases create a new outstanding invoice
   * delta, while reductions are rejected (collect payment in Fees page).
   */
  async importFeeEdits(dto: ImportFeesDto) {
    const rows = Array.isArray(dto?.rows) ? dto.rows : [];
    if (rows.length === 0) {
      throw new BadRequestException(
        'The uploaded file does not contain any fee rows.',
      );
    }

    const dryRun = dto.dryRun === true;
    const changes: Array<{
      studentKey: string;
      studentId: string;
      studentName: string;
      roomNo: string | null;
      items: Array<{
        category: ImportCategory | 'outstanding';
        label: string;
        from: number;
        to: number;
        delta: number;
      }>;
    }> = [];
    const errors: Array<{ studentKey: string; message: string }> = [];
    const seenStudents = new Set<string>();
    let unchanged = 0;

    for (const row of rows) {
      const studentKey = String(row?.studentKey ?? '').trim();
      if (!studentKey) {
        errors.push({ studentKey: '', message: 'Missing Student ID.' });
        continue;
      }

      const dedupeKey = studentKey.toUpperCase();
      if (seenStudents.has(dedupeKey)) {
        errors.push({
          studentKey,
          message: 'Duplicate Student ID in the uploaded file.',
        });
        continue;
      }
      seenStudents.add(dedupeKey);

      const parsed = this.parseImportAmounts(row);
      if (parsed.error) {
        errors.push({ studentKey, message: parsed.error });
        continue;
      }
      if (Object.keys(parsed.amounts).length === 0 && parsed.outstanding === undefined) {
        errors.push({
          studentKey,
          message:
            'No editable fee amount found (Rent / EB / Fine / Advance / Outstanding Balance).',
        });
        continue;
      }

      try {
        const result = await this.applyFeeImportRow(
          studentKey,
          parsed.amounts,
          parsed.outstanding,
          dryRun,
        );
        if (result.items.length > 0) {
          changes.push(result);
        } else {
          unchanged += 1;
        }
      } catch (error: any) {
        errors.push({
          studentKey,
          message: error?.message || 'Failed to update this student.',
        });
      }
    }

    return {
      dryRun,
      updated: changes.length,
      unchanged,
      errors,
      changes,
    };
  }

  private parseImportAmounts(row: ImportFeeRowInput): {
    amounts: Partial<Record<ImportCategory, number>>;
    outstanding?: number;
    error?: string;
  } {
    const amounts: Partial<Record<ImportCategory, number>> = {};
    let outstanding: number | undefined;

    for (const category of IMPORTABLE_CATEGORIES) {
      const raw = row?.[category];
      if (raw === undefined || raw === null) continue;
      if (typeof raw === 'string' && raw.trim() === '') continue;

      const numeric =
        typeof raw === 'number'
          ? raw
          : Number(String(raw).replace(/[₹,\s]/g, ''));

      if (!Number.isFinite(numeric) || numeric < 0) {
        return {
          amounts,
          error: `${IMPORT_CATEGORY_META[category].label} must be a number greater than or equal to 0.`,
        };
      }

      amounts[category] = roundMoney(numeric);
    }

    const outstandingRaw = row?.outstanding;
    if (outstandingRaw !== undefined && outstandingRaw !== null && !(typeof outstandingRaw === 'string' && outstandingRaw.trim() === '')) {
      const numeric =
        typeof outstandingRaw === 'number'
          ? outstandingRaw
          : Number(String(outstandingRaw).replace(/[₹,\s]/g, ''));
      if (!Number.isFinite(numeric) || numeric < 0) {
        return {
          amounts,
          error: 'Outstanding Balance must be a number greater than or equal to 0.',
        };
      }
      outstanding = roundMoney(numeric);
    }

    return { amounts, outstanding };
  }

  private async applyFeeImportRow(
    studentKey: string,
    amounts: Partial<Record<ImportCategory, number>>,
    outstanding: number | undefined,
    dryRun: boolean,
  ) {
    const cleanKey = studentKey.trim();
    const numericKey = cleanKey.replace(/\D/g, '');
    const isMobile = numericKey.length === 10;

    let student = await this.prisma.student.findFirst({
      where: {
        OR: [
          { id: cleanKey },
          { regNo: { equals: cleanKey, mode: 'insensitive' } },
          { manualRegsiName: { equals: cleanKey, mode: 'insensitive' } },
          ...(isMobile ? [{ mobileNo: numericKey }, { mobileNo: { endsWith: numericKey } }] : []),
        ],
      },
      select: {
        id: true,
        regNo: true,
        manualRegsiName: true,
        name: true,
        roomNo: true,
      },
    });

    if (!student) {
      student = await this.prisma.student.findFirst({
        where: {
          name: { equals: cleanKey, mode: 'insensitive' },
        },
        select: {
          id: true,
          regNo: true,
          manualRegsiName: true,
          name: true,
          roomNo: true,
        },
      });
    }

    if (!student && cleanKey.length >= 3) {
      student = await this.prisma.student.findFirst({
        where: {
          name: { contains: cleanKey, mode: 'insensitive' },
        },
        select: {
          id: true,
          regNo: true,
          manualRegsiName: true,
          name: true,
          roomNo: true,
        },
      });
    }

    if (!student) {
      throw new BadRequestException(
        `Student "${studentKey}" was not found.`,
      );
    }

    return this.prisma.$transaction(async tx => {
      const pendingRows = await tx.feeTransaction.findMany({
        where: { studentId: student.id, status: 'PENDING', deletedAt: null },
        orderBy: { createdAt: 'asc' },
      });

      const editableRows = pendingRows.filter(fee =>
        this.isEditablePendingFeeRow(fee),
      );

      const items: Array<{
        category: ImportCategory | 'outstanding';
        label: string;
        from: number;
        to: number;
        delta: number;
      }> = [];

      for (const category of IMPORTABLE_CATEGORIES) {
        const requested = amounts[category];
        if (requested === undefined) continue;

        const categoryRows = editableRows.filter(
          fee => this.importCategoryOf(fee) === category,
        );
        const currentTotal = this.sumAmounts(categoryRows);
        const targetTotal = roundMoney(requested);

        if (Math.abs(targetTotal - currentTotal) < MONEY_EPSILON) continue;

        if (!dryRun) {
          await this.setCategoryTotal(
            tx,
            student.id,
            category,
            categoryRows,
            targetTotal,
          );
        }

        items.push({
          category,
          label: IMPORT_CATEGORY_META[category].label,
          from: currentTotal,
          to: targetTotal,
          delta: roundMoney(targetTotal - currentTotal),
        });
      }

      if (outstanding !== undefined) {
        const outstandingInvoices = await this.getOutstandingInvoices(tx, student.id);
        const confirmedOutstandingPayments = await this.getConfirmedOutstandingPayments(tx, student.id);
        const originalOutstanding = this.sumAmounts(outstandingInvoices);
        const previouslyPaid = this.sumAmounts(confirmedOutstandingPayments);
        const currentRemaining = roundMoney(Math.max(0, originalOutstanding - previouslyPaid));
        const targetRemaining = roundMoney(outstanding);

        if (Math.abs(targetRemaining - currentRemaining) >= MONEY_EPSILON) {
          const delta = roundMoney(targetRemaining - currentRemaining);
          if (delta > 0) {
            if (!dryRun) {
              await tx.feeTransaction.create({
                data: {
                  studentId: student.id,
                  transactionType: 'RENT',
                  amount: delta,
                  status: 'PENDING',
                  description: 'Outstanding Balance (adjusted from fees sheet)',
                },
              });
            }
          } else {
            // Target is less than current: adjust down pending uncollected outstanding invoices
            if (!dryRun) {
              let toReduce = roundMoney(-delta);
              for (
                let idx = outstandingInvoices.length - 1;
                idx >= 0 && toReduce > MONEY_EPSILON;
                idx -= 1
              ) {
                const inv = outstandingInvoices[idx];
                const amt = roundMoney(Number(inv.amount) || 0);
                if (amt <= 0) continue;
                if (amt <= toReduce + MONEY_EPSILON) {
                  toReduce = roundMoney(toReduce - amt);
                  await tx.feeTransaction.delete({ where: { id: inv.id } });
                } else {
                  await tx.feeTransaction.update({
                    where: { id: inv.id },
                    data: { amount: roundMoney(amt - toReduce) },
                  });
                  toReduce = 0;
                }
              }
            }
          }

          items.push({
            category: 'outstanding',
            label: 'Outstanding Balance',
            from: currentRemaining,
            to: targetRemaining,
            delta,
          });
        }
      }

      return {
        studentKey: student.manualRegsiName || student.regNo,
        studentId: student.id,
        studentName: student.name,
        roomNo: student.roomNo,
        items,
      };
    });
  }

  private async setCategoryTotal(
    tx: Prisma.TransactionClient,
    studentId: string,
    category: ImportCategory,
    categoryRows: Array<{ id: string; amount: number; createdAt: Date }>,
    targetTotal: number,
  ) {
    const meta = IMPORT_CATEGORY_META[category];
    const currentTotal = this.sumAmounts(categoryRows);
    const delta = roundMoney(targetTotal - currentTotal);

    if (categoryRows.length === 0) {
      if (targetTotal > 0) {
        await tx.feeTransaction.create({
          data: {
            studentId,
            transactionType: meta.transactionType,
            amount: targetTotal,
            status: 'PENDING',
            description: meta.description,
          },
        });
      }
      return;
    }

    if (delta > 0) {
      const newest = categoryRows[categoryRows.length - 1];
      await tx.feeTransaction.update({
        where: { id: newest.id },
        data: {
          amount: roundMoney((Number(newest.amount) || 0) + delta),
        },
      });
      return;
    }

    // Lowering the total: trim the newest rows first, deleting a row once it
    // reaches zero. Older rows are left untouched unless more has to go.
    let toReduce = roundMoney(-delta);
    for (
      let index = categoryRows.length - 1;
      index >= 0 && toReduce > MONEY_EPSILON;
      index -= 1
    ) {
      const fee = categoryRows[index];
      const amount = roundMoney(Number(fee.amount) || 0);
      if (amount <= 0) continue;

      if (amount <= toReduce + MONEY_EPSILON) {
        toReduce = roundMoney(toReduce - amount);
        await tx.feeTransaction.delete({ where: { id: fee.id } });
      } else {
        await tx.feeTransaction.update({
          where: { id: fee.id },
          data: { amount: roundMoney(amount - toReduce) },
        });
        toReduce = 0;
      }
    }
  }

  /**
   * Mirrors the "Current Due" rows the Fees page renders: PENDING, not a mess
   * fee, not an outstanding invoice and not a pre-cutoff imported/settled row.
   */
  private isEditablePendingFeeRow(fee: any) {
    if (String(fee?.status || '').toUpperCase() !== 'PENDING') return false;

    const type = String(fee?.transactionType || '').toUpperCase();
    if (type.startsWith('MESS')) return false;
    if (isOutstandingDescription(fee)) return false;

    return !this.isHistoricalOrImportedFeeRow(fee);
  }

  private isHistoricalOrImportedFeeRow(fee: any) {
    if (isOctober2026EbBill(fee)) return false;

    const description = String(fee?.description || '');
    if (/november|december|2027/i.test(description)) return false;
    if (/imported/i.test(description) || /october\s*2026\b/i.test(description)) {
      return true;
    }

    const dateVal = fee?.paidDate || fee?.createdAt;
    const feeDate = new Date(dateVal);
    if (
      !Number.isNaN(feeDate.getTime()) &&
      feeDate < new Date('2026-11-01T00:00:00')
    ) {
      return true;
    }

    return false;
  }

  private importCategoryOf(fee: any): ImportCategory | 'other' {
    const type = String(fee?.transactionType || '').toUpperCase();
    if (type.includes('RENT')) return 'rent';
    if (type.includes('EB') || type.includes('ELECTRIC')) return 'eb';
    if (type.includes('FINE')) return 'fine';
    if (type.includes('ADVANCE')) return 'advance';
    return 'other';
  }

  async remove(id: string, userId: string) {
    await this.moveToTrash([id], userId);
    return { id, movedToTrash: true };
  }
}

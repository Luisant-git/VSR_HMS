import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateSalaryDto } from './dto/create-salary.dto';
import { UpdateSalaryDto } from './dto/update-salary.dto';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

@Injectable()
export class StaffSalaryService {
  constructor(private prisma: PrismaService) {}

  private get salaryModel() {
    return (this.prisma as any).staffSalary;
  }

  private get staffModel() {
    return (this.prisma as any).staff;
  }

  private get attendanceModel() {
    return (this.prisma as any).staffAttendance;
  }

  /**
   * Fetches attendance stats for a staff member and month
   */
  async getAttendanceStats(staffId: string, month: string, year: number) {
    const monthNum = this.monthNameToNumber(month);
    const monthStr = monthNum < 10 ? `0${monthNum}` : `${monthNum}`;
    const datePrefix = `${year}-${monthStr}`;
    const totalDays = new Date(year, monthNum, 0).getDate();

    let attendances: any[] = [];
    if (this.attendanceModel?.findMany) {
      attendances = await this.attendanceModel.findMany({
        where: {
          staffId,
          dateStr: { startsWith: datePrefix }
        }
      });
    }

    let presentDays = 0;
    let halfDays = 0;
    let absentDays = 0;
    let leaveDays = 0;

    for (const a of attendances) {
      if (a.status === 'Present') presentDays++;
      else if (a.status === 'Half Day') halfDays++;
      else if (a.status === 'Absent') absentDays++;
      else if (a.status === 'On Leave') leaveDays++;
    }

    const payableDays = presentDays + (halfDays * 0.5);

    return {
      staffId,
      month,
      year,
      totalDays,
      presentDays,
      halfDays,
      absentDays,
      leaveDays,
      payableDays,
      recordedDays: attendances.length
    };
  }

  /**
   * Converts Month Name (e.g. "October") to Month Number (1-12)
   */
  private monthNameToNumber(monthName: string): number {
    const idx = MONTH_NAMES.findIndex(
      m => m.toLowerCase() === (monthName || '').trim().toLowerCase()
    );
    return idx >= 0 ? idx + 1 : new Date().getMonth() + 1;
  }

  /**
   * Generates next sequential Salary Code (e.g. SAL-202610-001)
   */
  async getNextSalaryCode(year: number, month: number): Promise<string> {
    const monthStr = month < 10 ? `0${month}` : `${month}`;
    const prefix = `SAL-${year}${monthStr}-`;

    const latest = await this.salaryModel.findFirst({
      where: {
        salaryCode: {
          startsWith: prefix
        }
      },
      orderBy: {
        salaryCode: 'desc'
      }
    });

    if (!latest) {
      return `${prefix}001`;
    }

    const currentSeq = parseInt(latest.salaryCode.replace(prefix, ''), 10);
    const nextSeq = isNaN(currentSeq) ? 1 : currentSeq + 1;
    return `${prefix}${String(nextSeq).padStart(3, '0')}`;
  }

  /**
   * Creates / records a salary disbursement
   */
  async create(dto: CreateSalaryDto, currentUser?: any) {
    const staff = await this.staffModel.findUnique({
      where: { id: dto.staffId }
    });

    if (!staff) {
      throw new NotFoundException(`Staff member not found with ID ${dto.staffId}`);
    }

    const monthNum = this.monthNameToNumber(dto.month);
    const monthStr = monthNum < 10 ? `0${monthNum}` : `${monthNum}`;
    const salaryMonth = `${dto.year}-${monthStr}`;

    // Prevent duplicate salary disbursement for the same staff member and month
    const existing = await this.salaryModel.findUnique({
      where: {
        staffId_salaryMonth: {
          staffId: dto.staffId,
          salaryMonth
        }
      }
    });

    if (existing) {
      throw new ConflictException(
        `Salary has already been disbursed for ${staff.name} for ${dto.month} ${dto.year} (Record: ${existing.salaryCode}).`
      );
    }

    const salaryCode = await this.getNextSalaryCode(dto.year, monthNum);
    const baseSalary = Number(dto.baseSalary);
    const bonus = Number(dto.bonus || 0);
    const deductions = Number(dto.deductions || 0);
    const netAmount = Math.max(0, baseSalary + bonus - deductions);

    const paymentDate = dto.paymentDate ? new Date(dto.paymentDate) : new Date();
    const createdBy = currentUser?.name || currentUser?.email || dto.createdBy || 'System Administrator';

    return this.salaryModel.create({
      data: {
        salaryCode,
        staffId: dto.staffId,
        salaryMonth,
        year: dto.year,
        month: dto.month,
        baseSalary,
        bonus,
        deductions,
        netAmount,
        paymentDate,
        paymentMode: dto.paymentMode || 'Direct Bank Transfer',
        remarks: dto.remarks ? dto.remarks.trim() : null,
        createdBy
      },
      include: {
        staff: true
      }
    });
  }

  /**
   * Updates an existing salary disbursement
   */
  async update(id: string, dto: UpdateSalaryDto, currentUser?: any) {
    const record = await this.findOne(id);

    const data: any = {};
    if (dto.baseSalary !== undefined) data.baseSalary = Number(dto.baseSalary);
    if (dto.bonus !== undefined) data.bonus = Number(dto.bonus);
    if (dto.deductions !== undefined) data.deductions = Number(dto.deductions);

    const baseSalary = data.baseSalary !== undefined ? data.baseSalary : record.baseSalary;
    const bonus = data.bonus !== undefined ? data.bonus : record.bonus;
    const deductions = data.deductions !== undefined ? data.deductions : record.deductions;
    data.netAmount = Math.max(0, baseSalary + bonus - deductions);

    if (dto.paymentDate !== undefined) data.paymentDate = new Date(dto.paymentDate);
    if (dto.paymentMode !== undefined) data.paymentMode = dto.paymentMode;
    if (dto.remarks !== undefined) data.remarks = dto.remarks ? dto.remarks.trim() : null;

    return this.salaryModel.update({
      where: { id },
      data,
      include: { staff: true }
    });
  }

  /**
   * Deletes a salary disbursement record
   */
  async remove(id: string) {
    await this.findOne(id);
    return this.salaryModel.delete({
      where: { id }
    });
  }

  /**
   * Retrieves single salary disbursement
   */
  async findOne(id: string) {
    const record = await this.salaryModel.findUnique({
      where: { id },
      include: { staff: true }
    });
    if (!record) {
      throw new NotFoundException(`Salary record not found with ID ${id}`);
    }
    return record;
  }

  /**
   * Finds all salary records with filters, search, pagination, and period summary totals
   */
  async findAll(query?: {
    search?: string;
    month?: string;
    year?: string | number;
    staffId?: string;
    page?: string | number;
    limit?: string | number;
  }) {
    const where: any = {};

    if (query?.staffId && query.staffId !== 'ALL') {
      where.staffId = query.staffId;
    }

    if (query?.month && query.month !== 'ALL') {
      where.month = query.month;
    }

    if (query?.year && query.year !== 'ALL') {
      where.year = Number(query.year);
    }

    if (query?.search && query.search.trim()) {
      const q = query.search.trim();
      where.OR = [
        { salaryCode: { contains: q, mode: 'insensitive' } },
        { staff: { name: { contains: q, mode: 'insensitive' } } },
        { staff: { staffCode: { contains: q, mode: 'insensitive' } } },
        { staff: { role: { contains: q, mode: 'insensitive' } } },
        { paymentMode: { contains: q, mode: 'insensitive' } },
      ];
    }

    const page = Math.max(1, parseInt(String(query?.page || 1), 10));
    const limit = Math.max(1, Math.min(100, parseInt(String(query?.limit || 10), 10)));
    const skip = (page - 1) * limit;

    const [records, total] = await Promise.all([
      this.salaryModel.findMany({
        where,
        include: { staff: true },
        orderBy: { paymentDate: 'desc' },
        skip,
        take: limit
      }),
      this.salaryModel.count({ where })
    ]);

    // Summary calculations
    const allMatching = await this.salaryModel.findMany({
      where,
      select: {
        staffId: true,
        netAmount: true,
        baseSalary: true
      }
    });

    const totalDisbursed = allMatching.reduce((acc: number, r: any) => acc + (r.netAmount || 0), 0);
    const uniqueStaff = new Set(allMatching.map((r: any) => r.staffId));

    return {
      records,
      total,
      page,
      limit,
      summary: {
        totalDisbursed,
        totalRecords: total,
        staffCount: uniqueStaff.size
      }
    };
  }
}

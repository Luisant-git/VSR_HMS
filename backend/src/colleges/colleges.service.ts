import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateCollegeDto } from './dto/create-college.dto';
import { UpdateCollegeDto } from './dto/update-college.dto';
import { getFineDueDay, toCanonicalDueDate } from '../common/fine-due-date';

const parseDay = (value?: string | null): number | null => {
  if (!value) return null;
  const raw = String(value).trim();
  if (/^\d{1,2}$/.test(raw)) {
    const day = Number(raw);
    return day >= 1 && day <= 31 ? day : null;
  }
  return getFineDueDay(raw);
};

@Injectable()
export class CollegesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Reject a college name that already exists ignoring case/whitespace, so
   * "srisanmuga" and "SRISANMUGA" can't both be created. The DB's `@unique`
   * index on `name` is case-sensitive, so it does not catch this on its own.
   */
  private async resolveUniqueName(name: string, excludeId?: string): Promise<string> {
    const trimmed = (name || '').trim();
    if (!trimmed) {
      throw new BadRequestException('College name is required.');
    }

    const existing = await this.prisma.college.findFirst({
      where: {
        name: { equals: trimmed, mode: 'insensitive' },
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      select: { name: true },
    });

    if (existing) {
      throw new BadRequestException(`A college named "${existing.name}" already exists.`);
    }

    return trimmed;
  }

  async create(createCollegeDto: CreateCollegeDto) {
    const { rentFine, messFine, ebFine, dueDay, dueDate, billingCycle, ...collegeData } = createCollegeDto as any;
    collegeData.name = await this.resolveUniqueName(collegeData.name);

    // Fine Master holds a due day, stored as a canonical UTC date (only the
    // day component is read). Accept legacy full dates for compatibility.
    const formattedDueDate = toCanonicalDueDate(dueDay !== undefined ? dueDay : dueDate);

    try {
      return await this.prisma.college.create({
        data: {
          ...collegeData,
          ...(formattedDueDate && { dueDate: formattedDueDate }),
          ...(billingCycle && { billingCycle }),
          fineMaster: (rentFine !== undefined || messFine !== undefined || ebFine !== undefined) ? {
            create: { 
              rentFine: rentFine || 0,
              messFine: messFine || 0,
              ebFine: ebFine || 0
            }
          } : undefined
        },
        include: { fineMaster: true }
      });
    } catch (error: any) {
      if (error.code === 'P2002') {
        throw new BadRequestException(`A college named "${collegeData.name}" already exists.`);
      }
      throw error;
    }
  }

  async findAll(
    page: number = 1,
    limit: number = 10,
    search?: string,
    fromDate?: string,
    toDate?: string,
    ruleStatus?: string,
    fromDay?: string,
    toDay?: string,
  ) {
    const where: any = {};
    
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { shortName: { contains: search, mode: 'insensitive' } }
      ];
    }

    // A fine rule is "configured" when the college has a FineMaster record.
    if (ruleStatus === 'set') {
      where.fineMaster = { isNot: null };
    } else if (ruleStatus === 'not-set') {
      where.fineMaster = { is: null };
    }

    // Due dates are now day-of-month values, so range filters are applied to
    // the day rather than to the stored canonical DateTime.
    const minDay = parseDay(fromDay ?? fromDate);
    const maxDay = parseDay(toDay ?? toDate);
    if (minDay !== null || maxDay !== null) {
      const matches = await this.prisma.college.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        include: { fineMaster: true },
      });
      const filtered = matches.filter((college) => {
        const day = getFineDueDay(college.dueDate);
        if (day === null) return false;
        if (minDay !== null && day < minDay) return false;
        if (maxDay !== null && day > maxDay) return false;
        return true;
      });
      const total = filtered.length;
      const skip = (page - 1) * limit;
      return {
        data: filtered.slice(skip, skip + limit),
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      };
    }

    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.prisma.college.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { fineMaster: true }
      }),
      this.prisma.college.count({ where })
    ]);

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    };
  }

  async findOne(id: string) {
    return this.prisma.college.findUnique({
      where: { id },
      include: { fineMaster: true }
    });
  }

  async update(id: string, updateCollegeDto: UpdateCollegeDto) {
    const { rentFine, messFine, ebFine, dueDay, dueDate, billingCycle, ...collegeData } = updateCollegeDto as any;

    if (collegeData.name !== undefined) {
      collegeData.name = await this.resolveUniqueName(collegeData.name, id);
    }
    
    // A null day clears the rule; an omitted one leaves it unchanged.
    let formattedDueDate: any = undefined;
    if (dueDay !== undefined) {
      formattedDueDate = toCanonicalDueDate(dueDay);
    } else if (dueDate === null) {
      formattedDueDate = null;
    } else if (dueDate) {
      formattedDueDate = toCanonicalDueDate(dueDate);
    }

    // If billingCycle is explicitly null, we clear it (reset to default). If undefined, we leave it.
    let formattedBillingCycle: any = undefined;
    if (billingCycle === null) {
      formattedBillingCycle = null;
    } else if (billingCycle) {
      formattedBillingCycle = billingCycle;
    }

    return this.prisma.college.update({
      where: { id },
      data: {
        ...collegeData,
        ...(formattedDueDate !== undefined && { dueDate: formattedDueDate }),
        ...(formattedBillingCycle !== undefined && { billingCycle: formattedBillingCycle }),
        fineMaster: (rentFine !== undefined || messFine !== undefined || ebFine !== undefined) ? {
          upsert: {
            create: { rentFine: rentFine || 0, messFine: messFine || 0, ebFine: ebFine || 0 },
            update: { 
              ...(rentFine !== undefined && { rentFine }),
              ...(messFine !== undefined && { messFine }),
              ...(ebFine !== undefined && { ebFine })
            }
          }
        } : undefined
      },
      include: { fineMaster: true }
    });
  }

  async updateBulk(payload: { rentFine?: number, messFine?: number, ebFine?: number, dueDay?: number | string | null, dueDate?: string | null }) {
    const { rentFine, messFine, ebFine, dueDay, dueDate } = payload;
    
    let formattedDueDate: any = undefined;
    if (dueDay !== undefined) {
      formattedDueDate = toCanonicalDueDate(dueDay);
    } else if (dueDate === null) {
      formattedDueDate = null;
    } else if (dueDate) {
      formattedDueDate = toCanonicalDueDate(dueDate);
    }

    if (formattedDueDate !== undefined) {
      await this.prisma.college.updateMany({
        data: { dueDate: formattedDueDate }
      });
    }

    if (rentFine !== undefined || messFine !== undefined || ebFine !== undefined) {
      const colleges = await this.prisma.college.findMany({ select: { id: true } });
      
      for (const college of colleges) {
        await this.prisma.fineMaster.upsert({
          where: { collegeId: college.id },
          create: {
            collegeId: college.id,
            rentFine: rentFine || 0,
            messFine: messFine || 0,
            ebFine: ebFine || 0
          },
          update: {
            ...(rentFine !== undefined && { rentFine }),
            ...(messFine !== undefined && { messFine }),
            ...(ebFine !== undefined && { ebFine })
          }
        });
      }
    }
    
    return { success: true, message: 'Bulk update successful' };
  }

  async remove(id: string) {
    // Students and fine rules reference the college, so clear those links
    // first; otherwise the foreign key constraint blocks the delete.
    return this.prisma.$transaction(async (tx) => {
      await tx.fineMaster.deleteMany({ where: { collegeId: id } });
      await tx.student.updateMany({
        where: { collegeId: id },
        data: { collegeId: null },
      });
      return tx.college.delete({ where: { id } });
    });
  }
}

import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateEbBillDto } from './dto/create-eb-bill.dto';
import { UpdateEbBillDto } from './dto/update-eb-bill.dto';

@Injectable()
export class EbBillsService {
  constructor(private prisma: PrismaService) { }

  // Normalize incoming readings into AC + Normal + computed units.
  private resolveReadings(data: any, existing?: any) {
    const hasAc = data.hasAcMeter !== undefined ? !!data.hasAcMeter : (existing?.hasAcMeter ?? false);

    let acPrev = Number(data.acPrevReading);
    let acCurr = Number(data.acCurrReading);
    let normalPrev = Number(data.normalPrevReading);
    let normalCurr = Number(data.normalCurrReading);

    // Fall back to existing values when not provided (used by update)
    if (existing) {
      if (isNaN(acPrev)) acPrev = Number(existing.acPrevReading) || 0;
      if (isNaN(acCurr)) acCurr = Number(existing.acCurrReading) || 0;
      if (isNaN(normalPrev)) normalPrev = Number(existing.normalPrevReading) ?? Number(existing.prevReading) ?? 0;
      if (isNaN(normalCurr)) normalCurr = Number(existing.normalCurrReading) ?? Number(existing.currReading) ?? 0;
    }

    // Legacy single-meter fallback: if Normal not sent, use prev/curr
    if (isNaN(normalPrev)) normalPrev = Number(data.prevReading) || 0;
    if (isNaN(normalCurr)) normalCurr = Number(data.currReading) || 0;

    acPrev = acPrev || 0;
    acCurr = acCurr || 0;
    normalPrev = normalPrev || 0;
    normalCurr = normalCurr || 0;

    if (acCurr < acPrev || normalCurr < normalPrev) {
      throw new BadRequestException('Current reading cannot be less than previous reading');
    }

    const acUnits = acCurr - acPrev;
    const normalUnits = normalCurr - normalPrev;
    const unitsConsumed = acUnits + normalUnits;

    return {
      hasAcMeter: hasAc,
      acPrevReading: acPrev,
      acCurrReading: acCurr,
      normalPrevReading: normalPrev,
      normalCurrReading: normalCurr,
      prevReading: normalPrev,   // legacy field mirrors the Normal meter
      currReading: normalCurr,
      unitsConsumed,
    };
  }

  async create(data: CreateEbBillDto) {
    const r = this.resolveReadings(data);

    const room = await this.prisma.room.findUnique({
      where: { id: data.roomNo },
      include: { students: { where: { status: { not: 'Vacated' } } } },
    });
    if (!room) {
      throw new BadRequestException('Room not found');
    }

    // Prevent double entry for the same room in the same billing cycle
    const existing = await this.prisma.ebBill.findFirst({
      where: { roomNo: data.roomNo, billingCycle: data.billingCycle },
    });
    if (existing) {
      throw new BadRequestException(
        `EB bill for room "${data.roomNo}" for cycle "${data.billingCycle}" already exists. Use the Edit option to modify it.`,
      );
    }

    const totalAmount = r.unitsConsumed * data.tariffRate;
    const studentCount = room.students.length;
    const perStudentShare = studentCount > 0 ? totalAmount / studentCount : 0;

    return this.prisma.$transaction(async (prisma) => {
      const ebBill = await prisma.ebBill.create({
        data: {
          roomNo: data.roomNo,
          billingCycle: data.billingCycle,
          hasAcMeter: r.hasAcMeter,
          acPrevReading: r.acPrevReading,
          acCurrReading: r.acCurrReading,
          normalPrevReading: r.normalPrevReading,
          normalCurrReading: r.normalCurrReading,
          prevReading: r.prevReading,
          currReading: r.currReading,
          unitsConsumed: r.unitsConsumed,
          tariffRate: data.tariffRate,
          totalAmount,
          perStudentShare,
        },
      });

      if (studentCount > 0) {
        const feeTransactions = room.students.map((student) => ({
          studentId: student.id,
          transactionType: 'EB_BILL',
          amount: perStudentShare,
          description: `EB Bill for ${data.billingCycle}`,
          status: 'PENDING',
          dueDate: new Date(new Date().setDate(new Date().getDate() + 7)),
        }));
        await prisma.feeTransaction.createMany({ data: feeTransactions });
      }

      return ebBill;
    });
  }

  async update(id: string, data: UpdateEbBillDto) {
    const existing = await this.prisma.ebBill.findUnique({
      where: { id },
      include: { room: true },
    });
    if (!existing) {
      throw new NotFoundException('EB bill not found');
    }

    const roomNo = existing.roomNo;
    const oldCycle = existing.billingCycle;
    const billingCycle = data.billingCycle ?? existing.billingCycle;
    const tariffRate = data.tariffRate ?? existing.tariffRate;

    const r = this.resolveReadings(data, existing);

    if (billingCycle !== oldCycle) {
      const conflict = await this.prisma.ebBill.findFirst({
        where: { roomNo, billingCycle, NOT: { id } },
      });
      if (conflict) {
        throw new BadRequestException(
          `EB bill for room "${roomNo}" for cycle "${billingCycle}" already exists.`,
        );
      }
    }

    const totalAmount = r.unitsConsumed * tariffRate;

    const room = await this.prisma.room.findUnique({
      where: { id: roomNo },
      include: { students: { where: { status: { not: 'Vacated' } } } },
    });
    if (!room) {
      throw new BadRequestException('Room not found');
    }

    const studentCount = room.students.length;
    const perStudentShare = studentCount > 0 ? totalAmount / studentCount : 0;

    return this.prisma.$transaction(async (prisma) => {
      const updated = await prisma.ebBill.update({
        where: { id },
        data: {
          billingCycle,
          hasAcMeter: r.hasAcMeter,
          acPrevReading: r.acPrevReading,
          acCurrReading: r.acCurrReading,
          normalPrevReading: r.normalPrevReading,
          normalCurrReading: r.normalCurrReading,
          prevReading: r.prevReading,
          currReading: r.currReading,
          unitsConsumed: r.unitsConsumed,
          tariffRate,
          totalAmount,
          perStudentShare,
        },
      });

      if (studentCount > 0) {
        const studentIds = room.students.map((s) => s.id);
        await prisma.feeTransaction.updateMany({
          where: {
            studentId: { in: studentIds },
            transactionType: 'EB_BILL',
            status: 'PENDING',
            description: `EB Bill for ${oldCycle}`,
          },
          data: {
            amount: perStudentShare,
            description: `EB Bill for ${billingCycle}`,
          },
        });
      }

      return updated;
    });
  }

  async remove(id: string) {
    const existing = await this.prisma.ebBill.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('EB bill not found');
    }

    const roomNo = existing.roomNo;
    const billingCycle = existing.billingCycle;

    const room = await this.prisma.room.findUnique({
      where: { id: roomNo },
      include: { students: { where: { status: { not: 'Vacated' } } } },
    });
    const studentIds = room ? room.students.map((s) => s.id) : [];

    if (studentIds.length > 0) {
      const paid = await this.prisma.feeTransaction.findFirst({
        where: {
          studentId: { in: studentIds },
          transactionType: 'EB_BILL',
          status: 'COMPLETED',
          description: `EB Bill for ${billingCycle}`,
        },
      });
      if (paid) {
        throw new BadRequestException(
          'Cannot delete: some students have already paid this EB bill. Edit it instead.',
        );
      }
    }

    return this.prisma.$transaction(async (prisma) => {
      if (studentIds.length > 0) {
        await prisma.feeTransaction.deleteMany({
          where: {
            studentId: { in: studentIds },
            transactionType: 'EB_BILL',
            status: 'PENDING',
            description: `EB Bill for ${billingCycle}`,
          },
        });
      }
      await prisma.ebBill.delete({ where: { id } });
      return { id };
    });
  }

  async findAll(page: number = 1, limit: number = 10, search?: string, fromDate?: string, toDate?: string) {
    const where: any = {};
    if (search) {
      where.roomNo = { contains: search, mode: 'insensitive' };
    }
    if (fromDate || toDate) {
      where.createdAt = {};
      if (fromDate) {
        where.createdAt.gte = new Date(fromDate + 'T00:00:00');
      }
      if (toDate) {
        where.createdAt.lte = new Date(toDate + 'T23:59:59.999');
      }
    }

    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.prisma.ebBill.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { room: true }
      }),
      this.prisma.ebBill.count({ where })
    ]);

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) || 1 };
  }

  async findByRoom(roomNo: string) {
    return this.prisma.ebBill.findMany({
      where: { roomNo },
      orderBy: { createdAt: 'desc' }
    });
  }

  async findOne(id: string) {
    return this.prisma.ebBill.findUnique({
      where: { id },
      include: { room: true }
    });
  }
}

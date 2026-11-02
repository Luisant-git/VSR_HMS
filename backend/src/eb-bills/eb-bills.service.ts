import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateEbBillDto } from './dto/create-eb-bill.dto';
import { UpdateEbBillDto } from './dto/update-eb-bill.dto';

/** Compute normal + optional AC meter totals and return all derived fields. */
function computeTotals(
  prevReading: number,
  currReading: number,
  tariffRate: number,
  acPrevReading?: number | null,
  acCurrReading?: number | null,
  acTariffRate?: number | null,
) {
  const unitsConsumed = currReading - prevReading;

  const hasAc =
    acPrevReading != null &&
    acCurrReading != null &&
    acTariffRate != null;

  const acUnitsConsumed = hasAc ? acCurrReading! - acPrevReading! : null;
  const acTotal = hasAc ? acUnitsConsumed! * acTariffRate! : null;
  const normalTotal = unitsConsumed * tariffRate;
  const totalAmount = normalTotal + (acTotal ?? 0);

  return {
    unitsConsumed,
    normalTotal,
    hasAc,
    acUnitsConsumed,
    acTotal,
    totalAmount,
  };
}

@Injectable()
export class EbBillsService {
  constructor(private prisma: PrismaService) { }

  async create(data: CreateEbBillDto) {
    // Validate normal meter
    if (data.currReading < data.prevReading) {
      throw new BadRequestException(
        'Normal meter: current reading cannot be less than previous reading',
      );
    }

    // Validate AC meter if provided
    const hasAc =
      data.acPrevReading != null &&
      data.acCurrReading != null &&
      data.acTariffRate != null;

    if (hasAc && data.acCurrReading! < data.acPrevReading!) {
      throw new BadRequestException(
        'AC meter: current reading cannot be less than previous reading',
      );
    }

    // Find the room with its active (non-vacated) students
    const room = await this.prisma.room.findUnique({
      where: { id: data.roomNo },
      include: { students: { where: { status: { not: 'Vacated' } } } },
    });
    if (!room) throw new BadRequestException('Room not found');

    // Prevent duplicate for same room + cycle
    const existing = await this.prisma.ebBill.findFirst({
      where: { roomNo: data.roomNo, billingCycle: data.billingCycle },
    });
    if (existing) {
      throw new BadRequestException(
        `EB bill for room "${data.roomNo}" for cycle "${data.billingCycle}" already exists. Use the Edit option to modify it.`,
      );
    }

    const { unitsConsumed, acUnitsConsumed, acTotal, totalAmount } = computeTotals(
      data.prevReading,
      data.currReading,
      data.tariffRate,
      data.acPrevReading,
      data.acCurrReading,
      data.acTariffRate,
    );

    const activeStudents = room.students;
    const studentCount = activeStudents.length;
    const perStudentShare = studentCount > 0 ? totalAmount / studentCount : 0;

    return this.prisma.$transaction(async (prisma) => {
      const ebBill = await prisma.ebBill.create({
        data: {
          roomNo: data.roomNo,
          billingCycle: data.billingCycle,
          // Normal meter
          prevReading: data.prevReading,
          currReading: data.currReading,
          unitsConsumed,
          tariffRate: data.tariffRate,
          // AC meter (null when not provided)
          acPrevReading: hasAc ? data.acPrevReading : null,
          acCurrReading: hasAc ? data.acCurrReading : null,
          acUnitsConsumed: hasAc ? acUnitsConsumed : null,
          acTariffRate: hasAc ? data.acTariffRate : null,
          acTotalAmount: hasAc ? acTotal : null,
          // Combined
          totalAmount,
          perStudentShare,
        },
      });

      if (studentCount > 0) {
        const feeTransactions = activeStudents.map((student) => ({
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
    if (!existing) throw new NotFoundException('EB bill not found');

    const roomNo = existing.roomNo;
    const oldCycle = existing.billingCycle;
    const billingCycle = data.billingCycle ?? existing.billingCycle;

    // Normal meter — fall back to stored values
    const prevReading = data.prevReading ?? existing.prevReading;
    const currReading = data.currReading ?? existing.currReading;
    const tariffRate = data.tariffRate ?? existing.tariffRate;

    if (currReading < prevReading) {
      throw new BadRequestException(
        'Normal meter: current reading cannot be less than previous reading',
      );
    }

    // AC meter — three cases:
    // 1. hasAcMeter === false  → explicitly removing AC meter
    // 2. hasAcMeter === true or any AC field supplied → keep / update AC meter
    // 3. nothing supplied → preserve whatever was stored
    const removingAc = data.hasAcMeter === false;
    const addingOrUpdatingAc =
      !removingAc &&
      (data.acPrevReading != null ||
        data.acCurrReading != null ||
        data.acTariffRate != null ||
        data.hasAcMeter === true);

    let acPrevReading: number | null = null;
    let acCurrReading: number | null = null;
    let acTariffRate: number | null = null;

    if (removingAc) {
      // All AC fields → null
    } else if (addingOrUpdatingAc) {
      acPrevReading = data.acPrevReading ?? existing.acPrevReading ?? 0;
      acCurrReading = data.acCurrReading ?? existing.acCurrReading ?? 0;
      acTariffRate = data.acTariffRate ?? existing.acTariffRate ?? 0;
    } else {
      // Preserve stored values
      acPrevReading = existing.acPrevReading;
      acCurrReading = existing.acCurrReading;
      acTariffRate = existing.acTariffRate;
    }

    if (acCurrReading != null && acPrevReading != null && acCurrReading < acPrevReading) {
      throw new BadRequestException(
        'AC meter: current reading cannot be less than previous reading',
      );
    }

    // Cycle clash check
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

    const { unitsConsumed, hasAc, acUnitsConsumed, acTotal, totalAmount } = computeTotals(
      prevReading,
      currReading,
      tariffRate,
      acPrevReading,
      acCurrReading,
      acTariffRate,
    );

    const room = await this.prisma.room.findUnique({
      where: { id: roomNo },
      include: { students: { where: { status: { not: 'Vacated' } } } },
    });
    if (!room) throw new BadRequestException('Room not found');

    const activeStudents = room.students;
    const studentCount = activeStudents.length;
    const perStudentShare = studentCount > 0 ? totalAmount / studentCount : 0;

    return this.prisma.$transaction(async (prisma) => {
      const updated = await prisma.ebBill.update({
        where: { id },
        data: {
          billingCycle,
          prevReading,
          currReading,
          unitsConsumed,
          tariffRate,
          acPrevReading: hasAc ? acPrevReading : null,
          acCurrReading: hasAc ? acCurrReading : null,
          acUnitsConsumed: hasAc ? acUnitsConsumed : null,
          acTariffRate: hasAc ? acTariffRate : null,
          acTotalAmount: hasAc ? acTotal : null,
          totalAmount,
          perStudentShare,
        },
      });

      // Sync pending fee transactions
      if (studentCount > 0) {
        const studentIds = activeStudents.map((s) => s.id);
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
    if (!existing) throw new NotFoundException('EB bill not found');

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

  async findAll(
    page = 1,
    limit = 10,
    search?: string,
    fromDate?: string,
    toDate?: string,
  ) {
    const where: any = {};
    if (search) where.roomNo = { contains: search, mode: 'insensitive' };
    if (fromDate || toDate) {
      where.createdAt = {};
      if (fromDate) where.createdAt.gte = new Date(fromDate + 'T00:00:00');
      if (toDate) where.createdAt.lte = new Date(toDate + 'T23:59:59.999');
    }

    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.prisma.ebBill.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { room: true },
      }),
      this.prisma.ebBill.count({ where }),
    ]);

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) || 1 };
  }

  async findByRoom(roomNo: string) {
    return this.prisma.ebBill.findMany({
      where: { roomNo },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    return this.prisma.ebBill.findUnique({
      where: { id },
      include: { room: true },
    });
  }
}

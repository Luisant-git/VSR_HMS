import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateEbBillDto } from './dto/create-eb-bill.dto';
import { UpdateEbBillDto } from './dto/update-eb-bill.dto';

@Injectable()
export class EbBillsService {
  constructor(private prisma: PrismaService) { }

  async create(data: CreateEbBillDto) {
    const unitsConsumed = data.currReading - data.prevReading;
    if (unitsConsumed < 0) {
      throw new BadRequestException('Current reading cannot be less than previous reading');
    }

    // Find the room with its active (non-vacated) students
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

    const totalAmount = unitsConsumed * data.tariffRate;
    const activeStudents = room.students;
    const studentCount = activeStudents.length;

    const perStudentShare = studentCount > 0 ? totalAmount / studentCount : 0;

    // Use a transaction
    return this.prisma.$transaction(async (prisma) => {
      const ebBill = await prisma.ebBill.create({
        data: {
          roomNo: data.roomNo,
          billingCycle: data.billingCycle,
          prevReading: data.prevReading,
          currReading: data.currReading,
          unitsConsumed,
          tariffRate: data.tariffRate,
          totalAmount,
          perStudentShare,
        },
      });

      // Create fee transactions for each student
      if (studentCount > 0) {
        const feeTransactions = activeStudents.map(student => ({
          studentId: student.id,
          transactionType: 'EB_BILL',
          amount: perStudentShare,
          description: `EB Bill for ${data.billingCycle}`,
          status: 'PENDING',
          dueDate: new Date(new Date().setDate(new Date().getDate() + 7)), // Due in 7 days
        }));

        await prisma.feeTransaction.createMany({
          data: feeTransactions
        });
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
    const prevReading = data.prevReading ?? existing.prevReading;
    const currReading = data.currReading ?? existing.currReading;
    const tariffRate = data.tariffRate ?? existing.tariffRate;

    const unitsConsumed = currReading - prevReading;
    if (unitsConsumed < 0) {
      throw new BadRequestException('Current reading cannot be less than previous reading');
    }

    // If the cycle changed, make sure it doesn't clash with another bill for this room
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

    const totalAmount = unitsConsumed * tariffRate;

    const room = await this.prisma.room.findUnique({
      where: { id: roomNo },
      include: { students: { where: { status: { not: 'Vacated' } } } },
    });
    if (!room) {
      throw new BadRequestException('Room not found');
    }

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
          totalAmount,
          perStudentShare,
        },
      });

      // Sync pending student fee transactions for this room + cycle.
      // Matches the original description (`EB Bill for <oldCycle>`) and updates both
      // the amount and the description (in case the cycle was changed).
      if (studentCount > 0) {
        const studentIds = activeStudents.map(s => s.id);
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
    const studentIds = room ? room.students.map(s => s.id) : [];

    // Block deletion if any student has already paid this bill
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
      // Remove only the pending charges this bill created
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

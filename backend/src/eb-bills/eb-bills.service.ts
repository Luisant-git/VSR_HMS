import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateEbBillDto } from './dto/create-eb-bill.dto';

@Injectable()
export class EbBillsService {
  constructor(private prisma: PrismaService) {}

  async create(data: CreateEbBillDto) {
    const unitsConsumed = data.currReading - data.prevReading;
    if (unitsConsumed < 0) {
      throw new BadRequestException('Current reading cannot be less than previous reading');
    }
    const totalAmount = unitsConsumed * data.tariffRate;

    // Find all active students in the room
    const room = await this.prisma.room.findUnique({
      where: { id: data.roomNo },
      include: { students: { where: { status: { not: 'Vacated' } } } }
    });

    if (!room) {
      throw new BadRequestException('Room not found');
    }

    const activeStudents = room.students;
    const studentCount = activeStudents.length;

    let perStudentShare = 0;
    if (studentCount > 0) {
      perStudentShare = totalAmount / studentCount;
    }

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
        }
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

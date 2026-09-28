import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateGateLogDto } from './dto/create-gate-log.dto';

@Injectable()
export class GateLogsService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateGateLogDto) {
    const student = await this.prisma.student.findUnique({
      where: { id: dto.studentId }
    });

    if (!student) {
      throw new BadRequestException('Student not found');
    }

    if (dto.movementType === 'EXIT') {
      if (student.status === 'Out') {
        throw new BadRequestException('Student is already marked as OUT');
      }

      // Update student status
      await this.prisma.student.update({
        where: { id: dto.studentId },
        data: { status: 'Out' }
      });

      return this.prisma.gateLog.create({
        data: {
          studentId: dto.studentId,
          movementType: 'EXIT',
          outTime: new Date(dto.time),
          expectedInTime: dto.expectedReturnTime ? new Date(dto.expectedReturnTime) : null,
          reason: dto.purpose,
          lateRemarks: dto.remarks
        },
        include: { student: { include: { room: true } } }
      });
    } else {
      if (student.status === 'In') {
        throw new BadRequestException('Student is already marked as IN');
      }

      // Find the last exit to check if late
      const lastExit = await this.prisma.gateLog.findFirst({
        where: {
          studentId: dto.studentId,
          movementType: 'EXIT'
        },
        orderBy: { outTime: 'desc' }
      });

      let isLate = false;
      const inTime = new Date(dto.time);
      if (lastExit && lastExit.expectedInTime && inTime > lastExit.expectedInTime) {
        isLate = true;
      }

      // Update student status
      await this.prisma.student.update({
        where: { id: dto.studentId },
        data: { status: 'In' }
      });

      if (!lastExit) {
        throw new BadRequestException('No exit log found for this student to check in');
      }

      return this.prisma.gateLog.update({
        where: { id: lastExit.id },
        data: {
          inTime: inTime,
          isLate: isLate,
          lateRemarks: dto.remarks
        },
        include: { student: { include: { room: true } } }
      });
    }
  }

  async findAll(options: { page?: number; limit?: number; search?: string; fromDate?: string; toDate?: string; status?: string } = {}) {
    const { page = 1, limit = 10, search = '', fromDate, toDate, status } = options;
    const skip = (page - 1) * limit;

    const where: any = {};
    
    if (search) {
      where.student = {
        OR: [
          { name: { contains: search } },
          { regNo: { contains: search } }
        ]
      };
    }

    if (fromDate || toDate) {
      where.createdAt = {};
      if (fromDate) {
        where.createdAt.gte = new Date(fromDate);
      }
      if (toDate) {
        const toDateObj = new Date(toDate);
        toDateObj.setHours(23, 59, 59, 999);
        where.createdAt.lte = toDateObj;
      }
    }

    if (status) {
      if (status === 'Entry') {
        where.inTime = { not: null };
      } else if (status === 'Exit') {
        where.inTime = null;
      }
    }

    const [data, total] = await Promise.all([
      this.prisma.gateLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          student: {
            include: { room: true }
          }
        }
      }),
      this.prisma.gateLog.count({ where })
    ]);

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    };
  }

  async findMissingOrLate() {
    // Find all students currently OUT whose expected return time has passed
    const outStudents = await this.prisma.student.findMany({
      where: { status: 'Out' }
    });

    const activeLateLogs = [];
    for (const student of outStudents) {
      const lastExit = await this.prisma.gateLog.findFirst({
        where: { studentId: student.id, movementType: 'EXIT' },
        orderBy: { outTime: 'desc' },
        include: { student: { include: { room: true } } }
      });

      if (lastExit && lastExit.expectedInTime && new Date() > lastExit.expectedInTime && !lastExit.inTime) {
        activeLateLogs.push(lastExit);
      }
    }

    // Find historical late returns (where inTime > expectedInTime)
    const returnedLogs = await this.prisma.gateLog.findMany({
      where: {
        inTime: { not: null },
        expectedInTime: { not: null }
      },
      include: { student: { include: { room: true } } },
      orderBy: { inTime: 'desc' },
      take: 200
    });

    const historicalLateLogs = returnedLogs.filter(log => log.inTime && log.expectedInTime && log.inTime > log.expectedInTime);

    return [...activeLateLogs, ...historicalLateLogs];
  }
}

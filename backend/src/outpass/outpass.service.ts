import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateOutpassDto } from './dto/create-outpass.dto';
import { UpdateOutpassDto } from './dto/update-outpass.dto';

@Injectable()
export class OutpassService {
  constructor(private prisma: PrismaService) {}

  async create(createOutpassDto: CreateOutpassDto) {
    const outpassId = `OP-${new Date().getFullYear()}${(new Date().getMonth()+1).toString().padStart(2, '0')}${new Date().getDate().toString().padStart(2, '0')}-${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;
    
    return this.prisma.outpass.create({
      data: {
        outpassId,
        studentId: createOutpassDto.studentId,
        destination: createOutpassDto.destination,
        reason: createOutpassDto.reason,
        leaveDate: new Date(createOutpassDto.leaveDate),
        returnDate: new Date(createOutpassDto.returnDate),
        parentConsent: createOutpassDto.parentConsent,
        status: 'Approved'
      },
    });
  }

  async findAll(page?: number, limit?: number, search?: string, fromDate?: string, toDate?: string) {
    const where: any = {};
    if (search) {
      where.OR = [
        { outpassId: { contains: search, mode: 'insensitive' } },
        { destination: { contains: search, mode: 'insensitive' } },
        { student: { name: { contains: search, mode: 'insensitive' } } },
        { student: { regNo: { contains: search, mode: 'insensitive' } } }
      ];
    }
    
    if (fromDate || toDate) {
      where.createdAt = {};
      if (fromDate) where.createdAt.gte = new Date(fromDate);
      if (toDate) {
        const end = new Date(toDate);
        end.setHours(23, 59, 59, 999);
        where.createdAt.lte = end;
      }
    }

    if (page && limit) {
      const skip = (page - 1) * limit;
      const [data, total] = await Promise.all([
        this.prisma.outpass.findMany({
          where,
          skip,
          take: limit,
          include: { student: { include: { room: true } } },
          orderBy: { createdAt: 'desc' }
        }),
        this.prisma.outpass.count({ where })
      ]);
      return {
        data,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      };
    }

    // Default without pagination (for backwards compatibility if needed, though we will update callers)
    const data = await this.prisma.outpass.findMany({
      where,
      include: { student: { include: { room: true } } },
      orderBy: { createdAt: 'desc' }
    });
    return { data, total: data.length, page: 1, limit: data.length, totalPages: 1 };
  }

  async findOne(id: string) {
    const op = await this.prisma.outpass.findUnique({
      where: { id },
      include: {
        student: true,
      },
    });
    if (!op) throw new NotFoundException('Outpass not found');
    return op;
  }

  async update(id: string, updateOutpassDto: UpdateOutpassDto) {
    return this.prisma.outpass.update({
      where: { id },
      data: {
        ...(updateOutpassDto.destination && { destination: updateOutpassDto.destination }),
        ...(updateOutpassDto.reason && { reason: updateOutpassDto.reason }),
        ...(updateOutpassDto.leaveDate && { leaveDate: new Date(updateOutpassDto.leaveDate) }),
        ...(updateOutpassDto.returnDate && { returnDate: new Date(updateOutpassDto.returnDate) }),
        ...(updateOutpassDto.parentConsent !== undefined && { parentConsent: updateOutpassDto.parentConsent })
      },
    });
  }

  async updateStatus(id: string, status: string, gateAction: string) {
    const op = await this.prisma.outpass.update({
      where: { id },
      data: { status, gateAction },
    });
    
    if (status === 'Active Out') {
      await this.prisma.student.update({
        where: { id: op.studentId },
        data: { status: 'Out' }
      });
    } else if (status === 'Closed Returned') {
      await this.prisma.student.update({
        where: { id: op.studentId },
        data: { status: 'In' }
      });
    }
    
    return op;
  }

  async remove(id: string) {
    return this.prisma.outpass.delete({
      where: { id },
    });
  }
}

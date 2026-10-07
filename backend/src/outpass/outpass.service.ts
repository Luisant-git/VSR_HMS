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
      if (fromDate) {
        where.createdAt.gte = new Date(fromDate + 'T00:00:00');
      }
      if (toDate) {
        where.createdAt.lte = new Date(toDate + 'T23:59:59.999');
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
      const actualReturnDate = new Date();
      
      await this.prisma.student.update({
        where: { id: op.studentId },
        data: { status: 'In' }
      });

      await this.prisma.outpass.update({
        where: { id: op.id },
        data: { returnDate: actualReturnDate }
      });

      // Mess Deduction Logic
      const leaveTime = new Date(op.leaveDate).getTime();
      const returnTime = actualReturnDate.getTime();
      const daysOut = Math.max(0, Math.ceil((returnTime - leaveTime) / (1000 * 3600 * 24)));
      
      if (daysOut > 15) {
        // Prevent duplicate deduction for same outpass
        const existing = await this.prisma.feeTransaction.findFirst({
          where: { studentId: op.studentId, description: { contains: op.outpassId } }
        });
        
        if (!existing) {
          const student = await this.prisma.student.findUnique({
            where: { id: op.studentId },
            include: { room: true }
          });
          
          if (student && student.room && student.room.messFee > 0) {
            const dailyMessFee = student.room.messFee / 30;
            const deductionAmount = Math.round(dailyMessFee * daysOut);
            
            await this.prisma.feeTransaction.create({
              data: {
                studentId: op.studentId,
                transactionType: "MESS DEDUCTION",
                amount: -deductionAmount,
                status: "PENDING",
                description: `Mess deduction for outpass ${op.outpassId} (${daysOut} days)`
              }
            });
          }
        }
      }
    }
    
    return op;
  }

  async remove(id: string) {
    return this.prisma.outpass.delete({
      where: { id },
    });
  }
}

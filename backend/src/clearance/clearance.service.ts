import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateClearanceDto } from './dto/create-clearance.dto';
import { UpdateClearanceDto } from './dto/update-clearance.dto';

@Injectable()
export class ClearanceService {
  constructor(private prisma: PrismaService) {}

  async create(data: CreateClearanceDto) {
    return this.prisma.$transaction(async (prisma) => {
      const student = await prisma.student.findUnique({
        where: { id: data.studentId },
        include: { room: true }
      });
      if (!student) throw new BadRequestException('Student not found');
      if (student.status === 'Vacated') throw new BadRequestException('Student already vacated');

      // Calculate dues
      const pendingFees = await prisma.feeTransaction.findMany({
        where: { studentId: data.studentId, status: 'PENDING' }
      });
      const pendingDues = pendingFees.reduce((acc, fee) => acc + fee.amount, 0);
      const advanceHeld = student.advance || 0;
      
      const deductions = data.deductions || 0;
      let netRefund = advanceHeld - pendingDues - deductions;
      if (netRefund < 0) netRefund = 0; // If dues exceed advance, they might owe money, but refund is 0

      // Create clearance record
      const clearance = await prisma.clearanceRecord.create({
        data: {
          studentId: data.studentId,
          reason: data.reason,
          advanceHeld,
          pendingDues,
          deductions,
          netRefund,
          remarks: data.remarks
        }
      });

      // Update student status to Vacated, free the room
      await prisma.student.update({
        where: { id: data.studentId },
        data: {
          status: 'Vacated',
          roomNo: null,
          bedNo: null
        }
      });

      // Decrement room occupied count
      if (student.roomNo) {
        await prisma.room.update({
          where: { id: student.roomNo },
          data: {
            occupiedCount: { decrement: 1 }
          }
        });
      }

      return clearance;
    });
  }

  findAll() {
    return this.prisma.clearanceRecord.findMany({ include: { student: true }});
  }

  findOne(id: string) {
    return this.prisma.clearanceRecord.findUnique({ where: { id }, include: { student: true } });
  }

  update(id: string, updateClearanceDto: UpdateClearanceDto) {
    return this.prisma.clearanceRecord.update({ where: { id }, data: updateClearanceDto });
  }

  remove(id: string) {
    return this.prisma.clearanceRecord.delete({ where: { id } });
  }
}

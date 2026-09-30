import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Injectable()
export class StudentsService {
  constructor(private prisma: PrismaService) {}

  async create(createStudentDto: any) {
    const totalStudents = await this.prisma.student.count();
    const year = new Date().getFullYear();
    const regNo = `HST-${year}-${(totalStudents + 1).toString().padStart(3, '0')}`;

    const cleanData = { ...createStudentDto };
    Object.keys(cleanData).forEach(key => {
      if (cleanData[key] === '') {
        cleanData[key] = null;
      }
    });

    if (cleanData.dob) {
      cleanData.dob = new Date(cleanData.dob);
    }

    const autoGenerateInvoice = cleanData.autoGenerateInvoice;
    const messFee = cleanData.messFee;
    delete cleanData.autoGenerateInvoice;
    delete cleanData.messFee;

    let student;
    try {
      student = await this.prisma.student.create({
        data: {
          ...cleanData,
          regNo,
        },
      });
    } catch (error: any) {
      if (error.code === 'P2002') {
        const target = error.meta?.target?.[0] || 'field';
        throw new BadRequestException(`A student with this ${target} already exists.`);
      }
      throw error;
    }

    if (student.roomNo) {
      await this.prisma.room.update({
        where: { id: student.roomNo },
        data: {
          occupiedCount: {
            increment: 1,
          },
        },
      });
    }

    if (student.advance && student.advance > 0) {
      await this.prisma.feeTransaction.create({
        data: {
          studentId: student.id,
          transactionType: 'ADVANCE',
          amount: student.advance,
          status: 'COMPLETED',
          paymentMode: 'UPI',
          description: 'Initial Security Deposit Paid',
        }
      });
    }

    if (autoGenerateInvoice) {
      if (student.rent && student.rent > 0) {
        await this.prisma.feeTransaction.create({
          data: {
            studentId: student.id,
            transactionType: 'RENT',
            amount: student.rent,
            status: 'PENDING',
            description: 'Month 1 Room Rent',
          }
        });
      }
      if (messFee && messFee > 0) {
        await this.prisma.feeTransaction.create({
          data: {
            studentId: student.id,
            transactionType: 'MESS',
            amount: messFee,
            status: 'PENDING',
            description: 'Month 1 Mess Fee',
          }
        });
      }
    }

    return student;
  }

  async findAll() {
    return this.prisma.student.findMany({
      orderBy: { createdAt: 'desc' },
      include: { transactions: true, room: true, college: true }
    });
  }

  async findOne(id: string) {
    return this.prisma.student.findUnique({
      where: { regNo: id },
      include: { room: true, clearance: true, college: true } // Include room, clearance, and college
    });
  }

  async update(id: string, updateData: any) {
    const cleanData = { ...updateData };
    Object.keys(cleanData).forEach(key => {
      if (cleanData[key] === '') {
        cleanData[key] = null;
      }
    });
    
    if (cleanData.dob) {
      cleanData.dob = new Date(cleanData.dob);
    }

    const existingStudent = await this.prisma.student.findUnique({
      where: { regNo: id },
      select: { roomNo: true, status: true }
    });

    const updatedStudent = await this.prisma.student.update({
      where: { regNo: id },
      data: cleanData
    });

    const oldRoom = existingStudent?.roomNo;
    const newRoom = updatedStudent.roomNo;
    const oldStatus = existingStudent?.status;
    const newStatus = updatedStudent.status;

    // Check if room or status changed
    if (oldRoom !== newRoom || oldStatus !== newStatus) {
      // Decrease from old room if they had one and were not 'Vacated'
      if (oldRoom && oldStatus !== 'Vacated') {
        await this.prisma.room.update({
          where: { id: oldRoom },
          data: {
            occupiedCount: {
              decrement: 1
            }
          }
        });
      }

      // Increase for new room if they have one and are not 'Vacated'
      if (newRoom && newStatus !== 'Vacated') {
        await this.prisma.room.update({
          where: { id: newRoom },
          data: {
            occupiedCount: {
              increment: 1
            }
          }
        });
      }
    }

    return updatedStudent;
  }
}

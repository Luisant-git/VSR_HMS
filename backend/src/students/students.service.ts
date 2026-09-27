import { Injectable } from '@nestjs/common';
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

    const student = await this.prisma.student.create({
      data: {
        ...cleanData,
        regNo,
      },
    });

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
      include: { transactions: true }
    });
  }

  async findOne(id: string) {
    return this.prisma.student.findUnique({
      where: { regNo: id },
      include: { room: true } // Include room relation if needed
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

    return this.prisma.student.update({
      where: { regNo: id },
      data: cleanData
    });
  }
}

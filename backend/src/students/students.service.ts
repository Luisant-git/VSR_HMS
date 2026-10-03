import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Injectable()
export class StudentsService {
  constructor(private prisma: PrismaService) {}

  async create(createStudentDto: any) {
    const cleanData = { ...createStudentDto };
    
    let regNo = cleanData.regNo;
    if (!regNo) {
      const lastStudent = await this.prisma.student.findFirst({
        orderBy: { createdAt: 'desc' }
      });
      let nextNumber: number | undefined;
      if (lastStudent && lastStudent.regNo) {
        const parts = lastStudent.regNo.split('-');
        if (parts.length === 3) {
          nextNumber = parseInt(parts[2], 10) + 1;
        }
      }
      if (!nextNumber || isNaN(nextNumber)) {
        const totalStudents = await this.prisma.student.count();
        nextNumber = totalStudents + 1;
      }
      const year = new Date().getFullYear();
      regNo = `HST-${year}-${nextNumber.toString().padStart(3, '0')}`;
    }

    Object.keys(cleanData).forEach(key => {
      if (cleanData[key] === '') {
        cleanData[key] = null;
      }
    });

    if (cleanData.dob) {
      cleanData.dob = new Date(cleanData.dob);
    }
    
    if (cleanData.dateOfJoining) {
      cleanData.dateOfJoining = new Date(cleanData.dateOfJoining);
    }

    const autoGenerateInvoice = cleanData.autoGenerateInvoice;
    const messFee = cleanData.messFee;
    const isImport = cleanData.isImport;
    delete cleanData.autoGenerateInvoice;
    delete cleanData.messFee;
    delete cleanData.isImport;

    if (cleanData.roomNo) {
      const roomExists = await this.prisma.room.findUnique({ where: { id: cleanData.roomNo } });
      if (!roomExists) {
        cleanData.roomNo = null;
      }
    }

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
      } else if (error.code === 'P2003') {
        const fieldName = error.meta?.field_name || 'relation';
        if (typeof fieldName === 'string' && fieldName.includes('roomNo')) {
          throw new BadRequestException(`Invalid Room Number provided. The room does not exist.`);
        } else if (typeof fieldName === 'string' && fieldName.includes('collegeId')) {
          throw new BadRequestException(`Invalid College provided. The college does not exist.`);
        }
        throw new BadRequestException(`Foreign key constraint failed on ${fieldName}.`);
      }
      throw new BadRequestException(error.message || 'Failed to create student');
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
          status: isImport ? 'PENDING' : 'COMPLETED',
          paymentMode: isImport ? undefined : 'UPI',
          description: isImport ? 'Security Deposit (Imported)' : 'Initial Security Deposit Paid',
        }
      });
    }

    if (autoGenerateInvoice || isImport) {
      if (student.rent && student.rent > 0) {
        await this.prisma.feeTransaction.create({
          data: {
            studentId: student.id,
            transactionType: 'RENT',
            amount: student.rent,
            status: 'PENDING',
            paymentMode: undefined,
            description: isImport ? 'Month 1 Room Rent (Imported)' : 'Month 1 Room Rent',
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
            paymentMode: undefined,
            description: isImport ? 'Month 1 Mess Fee (Imported)' : 'Month 1 Mess Fee',
          }
        });
      }
    }

    return student;
  }

  async findAll(params?: { page?: number; limit?: number; search?: string; roomFilter?: string; collegeFilter?: string }) {
    const page = params?.page || 1;
    const limit = params?.limit || 10;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (params?.search) {
      const q = params.search;
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { regNo: { contains: q, mode: 'insensitive' } },
        { mobileNo: { contains: q, mode: 'insensitive' } }
      ];
    }
    
    if (params?.roomFilter && params.roomFilter !== '-- All Rooms --') {
      const r = params.roomFilter.replace('Room ', '').trim();
      where.roomNo = r;
    }
    
    if (params?.collegeFilter && params.collegeFilter !== '-- All Colleges --') {
      where.college = {
        name: params.collegeFilter
      };
    }

    const [data, total] = await Promise.all([
      this.prisma.student.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { transactions: true, room: true, college: true }
      }),
      this.prisma.student.count({ where })
    ]);

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    };
  }

  async findByMobile(mobileNo: string) {
    return this.prisma.student.findFirst({
      where: { mobileNo },
      include: { transactions: true, room: true, college: true }
    });
  }

  async findOne(id: string) {
    // Check if ID is a UUID
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
    
    return this.prisma.student.findUnique({
      where: isUuid ? { id } : { regNo: id },
      include: { room: true, clearance: true, college: true } // Include room, clearance, and college
    });
  }

  async update(id: string, updateData: any) {
    console.log('--- BACKEND UPDATE RECEIVED ---');
    console.log('ID:', id);
    console.log('updateData:', updateData);

    const cleanData = { ...updateData };
    Object.keys(cleanData).forEach(key => {
      if (cleanData[key] === '') {
        cleanData[key] = null;
      }
    });
    
    console.log('cleanData:', cleanData);
    
    if (cleanData.dob) {
      cleanData.dob = new Date(cleanData.dob);
    }
    
    if (cleanData.dateOfJoining) {
      cleanData.dateOfJoining = new Date(cleanData.dateOfJoining);
    }

    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
    const whereClause = isUuid ? { id } : { regNo: id };

    const existingStudent = await this.prisma.student.findUnique({
      where: whereClause,
      select: { roomNo: true, status: true }
    });

    const updatedStudent = await this.prisma.student.update({
      where: whereClause,
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

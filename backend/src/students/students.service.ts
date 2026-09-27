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

    return this.prisma.student.create({
      data: {
        ...cleanData,
        regNo,
      },
    });
  }

  async findAll() {
    return this.prisma.student.findMany({
      orderBy: { createdAt: 'desc' }
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

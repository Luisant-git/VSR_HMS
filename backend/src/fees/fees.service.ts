import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateFeeDto } from './dto/create-fee.dto';
import { UpdateFeeDto } from './dto/update-fee.dto';

@Injectable()
export class FeesService {
  constructor(private prisma: PrismaService) {}

  async create(data: CreateFeeDto) {
    return this.prisma.feeTransaction.create({
      data,
    });
  }

  async findAll() {
    return this.prisma.feeTransaction.findMany({
      orderBy: { createdAt: 'desc' },
      include: { 
        student: {
          include: { college: true }
        }
      }
    });
  }

  async findByStudent(studentId: string) {
    return this.prisma.feeTransaction.findMany({
      where: { studentId },
      orderBy: { createdAt: 'desc' },
      include: {
        student: {
          include: { college: true }
        }
      }
    });
  }

  async findOne(id: string) {
    return this.prisma.feeTransaction.findUnique({
      where: { id },
      include: { 
        student: {
          include: { college: true }
        }
      }
    });
  }

  async update(id: string, data: UpdateFeeDto) {
    return this.prisma.feeTransaction.update({
      where: { id },
      data,
    });
  }

  async remove(id: string) {
    return this.prisma.feeTransaction.delete({
      where: { id },
    });
  }
}

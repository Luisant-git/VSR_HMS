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

  async findAll() {
    return this.prisma.outpass.findMany({
      include: {
        student: {
          include: {
            room: true
          }
        },
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
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

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateCollegeDto } from './dto/create-college.dto';
import { UpdateCollegeDto } from './dto/update-college.dto';

@Injectable()
export class CollegesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createCollegeDto: CreateCollegeDto) {
    const { finePerDay, dueDate, ...collegeData } = createCollegeDto;
    
    // Convert YYYY-MM-DD string to ISO DateTime if present
    const formattedDueDate = dueDate ? new Date(dueDate).toISOString() : null;

    return this.prisma.college.create({
      data: {
        ...collegeData,
        ...(formattedDueDate && { dueDate: formattedDueDate }),
        fineMaster: finePerDay !== undefined ? {
          create: { finePerDay }
        } : undefined
      },
      include: { fineMaster: true }
    });
  }

  async findAll(page: number = 1, limit: number = 10, search?: string, dueDate?: string) {
    const where: any = {};
    
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { shortName: { contains: search, mode: 'insensitive' } }
      ];
    }
    
    if (dueDate) {
      const startOfDay = new Date(dueDate);
      const endOfDay = new Date(dueDate);
      endOfDay.setDate(endOfDay.getDate() + 1);
      where.dueDate = {
        gte: startOfDay,
        lt: endOfDay
      };
    }

    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.prisma.college.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { fineMaster: true }
      }),
      this.prisma.college.count({ where })
    ]);

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    };
  }

  async findOne(id: string) {
    return this.prisma.college.findUnique({
      where: { id },
      include: { fineMaster: true }
    });
  }

  async update(id: string, updateCollegeDto: UpdateCollegeDto) {
    const { finePerDay, dueDate, ...collegeData } = updateCollegeDto as any;
    
    // Convert YYYY-MM-DD string to ISO DateTime if present
    const formattedDueDate = dueDate ? new Date(dueDate).toISOString() : null;

    return this.prisma.college.update({
      where: { id },
      data: {
        ...collegeData,
        ...(formattedDueDate && { dueDate: formattedDueDate }),
        fineMaster: finePerDay !== undefined ? {
          upsert: {
            create: { finePerDay },
            update: { finePerDay }
          }
        } : undefined
      },
      include: { fineMaster: true }
    });
  }

  async remove(id: string) {
    return this.prisma.college.delete({
      where: { id },
    });
  }
}

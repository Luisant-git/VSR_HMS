import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateCollegeDto } from './dto/create-college.dto';
import { UpdateCollegeDto } from './dto/update-college.dto';

@Injectable()
export class CollegesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createCollegeDto: CreateCollegeDto) {
    const { rentFine, messFine, ebFine, dueDate, ...collegeData } = createCollegeDto as any;
    
    // Convert YYYY-MM-DD string to ISO DateTime if present
    const formattedDueDate = dueDate ? new Date(dueDate).toISOString() : null;

    try {
      return await this.prisma.college.create({
        data: {
          ...collegeData,
          ...(formattedDueDate && { dueDate: formattedDueDate }),
          fineMaster: (rentFine !== undefined || messFine !== undefined || ebFine !== undefined) ? {
            create: { 
              rentFine: rentFine || 0,
              messFine: messFine || 0,
              ebFine: ebFine || 0
            }
          } : undefined
        },
        include: { fineMaster: true }
      });
    } catch (error: any) {
      if (error.code === 'P2002') {
        throw new BadRequestException(`A college with this name or short name already exists.`);
      }
      throw error;
    }
  }

  async findAll(page: number = 1, limit: number = 10, search?: string, fromDate?: string, toDate?: string) {
    const where: any = {};
    
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { shortName: { contains: search, mode: 'insensitive' } }
      ];
    }
    
    if (fromDate || toDate) {
      where.dueDate = {};
      if (fromDate) {
        where.dueDate.gte = new Date(fromDate + 'T00:00:00');
      }
      if (toDate) {
        where.dueDate.lte = new Date(toDate + 'T23:59:59.999');
      }
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
    const { rentFine, messFine, ebFine, dueDate, ...collegeData } = updateCollegeDto as any;
    
    // If dueDate is explicitly null, we clear it. If undefined, we leave it.
    let formattedDueDate: any = undefined;
    if (dueDate === null) {
      formattedDueDate = null;
    } else if (dueDate) {
      formattedDueDate = new Date(dueDate).toISOString();
    }

    return this.prisma.college.update({
      where: { id },
      data: {
        ...collegeData,
        ...(formattedDueDate !== undefined && { dueDate: formattedDueDate }),
        fineMaster: (rentFine !== undefined || messFine !== undefined || ebFine !== undefined) ? {
          upsert: {
            create: { rentFine: rentFine || 0, messFine: messFine || 0, ebFine: ebFine || 0 },
            update: { 
              ...(rentFine !== undefined && { rentFine }),
              ...(messFine !== undefined && { messFine }),
              ...(ebFine !== undefined && { ebFine })
            }
          }
        } : undefined
      },
      include: { fineMaster: true }
    });
  }

  async updateBulk(payload: { rentFine?: number, messFine?: number, ebFine?: number, dueDate?: string | null }) {
    const { rentFine, messFine, ebFine, dueDate } = payload;
    
    let formattedDueDate: any = undefined;
    if (dueDate === null) {
      formattedDueDate = null;
    } else if (dueDate) {
      formattedDueDate = new Date(dueDate).toISOString();
    }

    if (formattedDueDate !== undefined) {
      await this.prisma.college.updateMany({
        data: { dueDate: formattedDueDate }
      });
    }

    if (rentFine !== undefined || messFine !== undefined || ebFine !== undefined) {
      const colleges = await this.prisma.college.findMany({ select: { id: true } });
      
      for (const college of colleges) {
        await this.prisma.fineMaster.upsert({
          where: { collegeId: college.id },
          create: {
            collegeId: college.id,
            rentFine: rentFine || 0,
            messFine: messFine || 0,
            ebFine: ebFine || 0
          },
          update: {
            ...(rentFine !== undefined && { rentFine }),
            ...(messFine !== undefined && { messFine }),
            ...(ebFine !== undefined && { ebFine })
          }
        });
      }
    }
    
    return { success: true, message: 'Bulk update successful' };
  }

  async remove(id: string) {
    return this.prisma.college.delete({
      where: { id },
    });
  }
}

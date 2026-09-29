import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateCollegeDto } from './dto/create-college.dto';
import { UpdateCollegeDto } from './dto/update-college.dto';

@Injectable()
export class CollegesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createCollegeDto: CreateCollegeDto) {
    return this.prisma.college.create({
      data: createCollegeDto,
    });
  }

  async findAll() {
    return this.prisma.college.findMany({
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string) {
    return this.prisma.college.findUnique({
      where: { id },
    });
  }

  async update(id: string, updateCollegeDto: UpdateCollegeDto) {
    return this.prisma.college.update({
      where: { id },
      data: updateCollegeDto,
    });
  }

  async remove(id: string) {
    return this.prisma.college.delete({
      where: { id },
    });
  }
}

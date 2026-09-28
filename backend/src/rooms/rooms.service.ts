import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateRoomDto } from './dto/create-room.dto';
import { UpdateRoomDto } from './dto/update-room.dto';

@Injectable()
export class RoomsService {
  constructor(private prisma: PrismaService) {}

  async create(createRoomDto: CreateRoomDto) {
    return this.prisma.room.create({ data: createRoomDto });
  }

  async findAll() {
    return this.prisma.room.findMany({
      include: { students: true }
    });
  }

  async findOne(id: string) {
    const room = await this.prisma.room.findUnique({ where: { id } });
    if (!room) throw new NotFoundException(`Room with ID ${id} not found`);
    return room;
  }

  async update(id: string, updateRoomDto: UpdateRoomDto) {
    return this.prisma.room.update({ where: { id }, data: updateRoomDto });
  }

  async remove(id: string) {
    return this.prisma.room.delete({ where: { id } });
  }
}

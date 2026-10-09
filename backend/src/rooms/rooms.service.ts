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

  async syncOccupancy() {
    const rooms = await this.prisma.room.findMany({
      include: { students: true }
    });

    let updatedCount = 0;
    for (const room of rooms) {
      const activeCount = room.students ? room.students.filter((s: any) => s.status !== 'Vacated').length : 0;
      await this.prisma.room.update({
        where: { id: room.id },
        data: { occupiedCount: activeCount }
      });
      updatedCount++;
    }

    return {
      message: `Successfully synchronized occupancy for ${updatedCount} rooms.`,
      updatedCount
    };
  }

  async findAll() {
    const rooms = await this.prisma.room.findMany({
      include: { students: true }
    });

    return rooms.map(room => {
      const activeCount = room.students ? room.students.filter((s: any) => s.status !== 'Vacated').length : 0;
      return {
        ...room,
        occupiedCount: activeCount
      };
    });
  }

  async findOne(id: string) {
    const room = await this.prisma.room.findUnique({
      where: { id },
      include: { students: true }
    });
    if (!room) throw new NotFoundException(`Room with ID ${id} not found`);
    const activeCount = room.students ? room.students.filter((s: any) => s.status !== 'Vacated').length : 0;
    return {
      ...room,
      occupiedCount: activeCount
    };
  }

  async update(id: string, updateRoomDto: UpdateRoomDto) {
    return this.prisma.room.update({ where: { id }, data: updateRoomDto });
  }

  async remove(id: string) {
    return this.prisma.room.delete({ where: { id } });
  }
}

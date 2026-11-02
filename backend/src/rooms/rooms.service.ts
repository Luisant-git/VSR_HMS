import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateRoomDto } from './dto/create-room.dto';
import { UpdateRoomDto } from './dto/update-room.dto';

@Injectable()
export class RoomsService {
  constructor(private prisma: PrismaService) { }

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
    // Fetch the room before updating so we know the old rent
    const existing = await this.prisma.room.findUnique({
      where: { id },
      include: { students: true },
    });
    if (!existing) throw new NotFoundException(`Room with ID ${id} not found`);

    const oldRent = existing.rent ?? 0;
    const newRent = updateRoomDto.rent !== undefined ? (updateRoomDto.rent ?? 0) : oldRent;
    const rentChanged = newRent !== oldRent;

    // Update the room itself
    const updatedRoom = await this.prisma.room.update({ where: { id }, data: updateRoomDto });

    // If rent changed, propagate to students who are using the room default rent.
    // Students with a custom rent (Student.rent != 0 AND Student.rent != oldRent)
    // are intentional overrides — leave them untouched.
    if (rentChanged && existing.students && existing.students.length > 0) {
      const defaultRentStudentIds = existing.students
        .filter((s) => s.status !== 'Vacated')
        .filter((s) => {
          const sr = s.rent ?? 0;
          // Update if they had no rent set (0) OR were on the room default
          return sr === 0 || sr === oldRent;
        })
        .map((s) => s.id);

      if (defaultRentStudentIds.length > 0) {
        await this.prisma.student.updateMany({
          where: { id: { in: defaultRentStudentIds } },
          data: { rent: newRent },
        });
      }
    }

    return {
      ...updatedRoom,
      rentPropagated: rentChanged,
      studentsUpdated: rentChanged
        ? (existing.students ?? [])
          .filter((s) => s.status !== 'Vacated')
          .filter((s) => { const sr = s.rent ?? 0; return sr === 0 || sr === oldRent; }).length
        : 0,
    };
  }

  async remove(id: string) {
    return this.prisma.room.delete({ where: { id } });
  }
}

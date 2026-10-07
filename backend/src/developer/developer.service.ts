import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Injectable()
export class DeveloperService {
  constructor(private readonly prisma: PrismaService) {}

  async truncateData(entity: string) {
    try {
      switch (entity) {
        case 'STUDENTS':
          // Need to delete related entities first
          await this.prisma.feeTransaction.deleteMany({});
          await this.prisma.gateLog.deleteMany({});
          await this.prisma.outpass.deleteMany({});
          await this.prisma.clearanceRecord.deleteMany({});
          await this.prisma.student.deleteMany({});
          await this.prisma.room.updateMany({
            data: { occupiedCount: 0 }
          });
          return { message: 'All Student records and their related data have been truncated, and all rooms are now free.' };
          
        case 'COLLEGES':
          // Must ensure no students are attached, or just delete fineMasters and colleges
          await this.prisma.fineMaster.deleteMany({});
          await this.prisma.college.deleteMany({});
          return { message: 'All Colleges and Fine Masters have been truncated.' };
          
        case 'FEES':
          await this.prisma.feeTransaction.deleteMany({});
          await this.prisma.ebBill.deleteMany({});
          await this.prisma.student.updateMany({
            data: { 
              feeStatus: 'Un-Paid',
              advance: 0,
              rentPaidUntil: null,
              messPaidUntil: null
            }
          });
          return { message: 'All Fee Transactions and EB Bills have been truncated, and student fee statuses reset.' };
          
        case 'OUTPASSES':
          await this.prisma.outpass.deleteMany({});
          return { message: 'All Outpasses have been truncated.' };
          
        case 'ROOMS':
          await this.prisma.room.deleteMany({});
          return { message: 'All Rooms have been truncated.' };
          
        case 'GATELOGS':
          await this.prisma.gateLog.deleteMany({});
          await this.prisma.student.updateMany({
            data: { status: 'In' }
          });
          return { message: 'All Gate Logs have been truncated and student statuses reset.' };
          
        case 'ALL':
          // Full wipe (except Users/Admin)
          await this.prisma.feeTransaction.deleteMany({});
          await this.prisma.ebBill.deleteMany({});
          await this.prisma.gateLog.deleteMany({});
          await this.prisma.outpass.deleteMany({});
          await this.prisma.clearanceRecord.deleteMany({});
          await this.prisma.student.deleteMany({});
          await this.prisma.fineMaster.deleteMany({});
          await this.prisma.college.deleteMany({});
          await this.prisma.room.deleteMany({});
          return { message: 'ALL HOSTEL DATA has been truncated successfully.' };
          
        default:
          throw new BadRequestException('Unknown entity type for truncation');
      }
    } catch (error: any) {
      throw new BadRequestException(`Failed to truncate ${entity}: ${error.message}`);
    }
  }
}

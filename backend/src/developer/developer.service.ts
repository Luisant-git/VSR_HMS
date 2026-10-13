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
          await this.prisma.messAttendance.deleteMany({});
          await this.prisma.student.deleteMany({});
          await this.prisma.room.updateMany({
            data: { occupiedCount: 0 }
          });
          return { message: 'All Student records and their related data (fees, gate logs, outpasses, clearance, mess attendance) have been truncated, and all rooms are now free.' };
          
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

        case 'CLEARANCE':
          await this.prisma.clearanceRecord.deleteMany({});
          return { message: 'All Clearance Records have been truncated.' };

        case 'GATELOGS_MESS_ATTENDANCE':
          await this.prisma.gateLog.deleteMany({});
          await this.prisma.messAttendance.deleteMany({});
          await this.prisma.staffAttendance.deleteMany({});
          await this.prisma.student.updateMany({
            data: { status: 'In' }
          });
          return { message: 'All Gate Logs, Mess Attendance and Staff Attendance have been truncated and student statuses reset.' };
          
        case 'ROOMS':
          await this.prisma.room.deleteMany({});
          return { message: 'All Rooms have been truncated.' };
          
        case 'GATELOGS':
          await this.prisma.gateLog.deleteMany({});
          await this.prisma.messAttendance.deleteMany({});
          await this.prisma.student.updateMany({
            data: { status: 'In' }
          });
          return { message: 'All Gate Logs and Mess Attendance have been truncated and student statuses reset.' };

        case 'STAFF':
          // Salary + attendance first (FK to Staff), then staff
          await this.prisma.staffSalary.deleteMany({});
          await this.prisma.staffAttendance.deleteMany({});
          await this.prisma.staff.deleteMany({});
          return { message: 'All Staff, Staff Attendance and Staff Salary records have been truncated.' };

        case 'CANTEEN_PRODUCTS':
          await this.prisma.canteenPurchaseItem.deleteMany({});
          await this.prisma.canteenProduct.deleteMany({});
          return { message: 'All Canteen Products (and their purchase line items) have been truncated.' };

        case 'CANTEEN_CATEGORIES':
          await this.prisma.canteenProduct.updateMany({ data: { categoryId: null } });
          await this.prisma.canteenCategory.deleteMany({});
          return { message: 'All Canteen Categories have been truncated (products unlinked).' };

        case 'CANTEEN_UNITS':
          await this.prisma.canteenProduct.updateMany({ data: { unitId: null } });
          await this.prisma.canteenUnit.deleteMany({});
          return { message: 'All Canteen Units have been truncated (products unlinked).' };

        case 'CANTEEN_SUPPLIERS':
          await this.prisma.canteenPurchase.updateMany({ data: { supplierId: null } });
          await this.prisma.canteenSupplierPayment.deleteMany({});
          await this.prisma.canteenSupplier.deleteMany({});
          return { message: 'All Canteen Suppliers (and their payment history) have been truncated.' };

        case 'CANTEEN_PAYMENT_MODES':
          await this.prisma.canteenPurchase.updateMany({ data: { paymentModeId: null } });
          await this.prisma.canteenPaymentMode.deleteMany({});
          return { message: 'All Canteen Payment Modes have been truncated (purchases unlinked).' };

        case 'CANTEEN_PURCHASES':
          await this.prisma.canteenPurchaseItem.deleteMany({});
          await this.prisma.canteenPurchase.deleteMany({});
          return { message: 'All Canteen Purchase Entries (and line items) have been truncated.' };

        case 'CANTEEN_SUPPLIER_PAYMENTS':
          await this.prisma.canteenSupplierPayment.deleteMany({});
          return { message: 'All Canteen Supplier Payments have been truncated.' };

        case 'CANTEEN':
          // Full canteen wipe: line items first, then purchases/payments, then masters
          await this.prisma.canteenPurchaseItem.deleteMany({});
          await this.prisma.canteenPurchase.deleteMany({});
          await this.prisma.canteenSupplierPayment.deleteMany({});
          await this.prisma.canteenProduct.deleteMany({});
          await this.prisma.canteenSupplier.deleteMany({});
          await this.prisma.canteenPaymentMode.deleteMany({});
          await this.prisma.canteenCategory.deleteMany({});
          await this.prisma.canteenUnit.deleteMany({});
          return { message: 'All Canteen data (purchases, payments, products, suppliers, payment modes, categories, units) has been truncated.' };

        case 'ALL':
          // Full wipe (except Users/Admin, HostelSettings/MessDeductionMaster, MenuPermission).
          // Child tables first to respect foreign keys.
          await this.prisma.canteenPurchaseItem.deleteMany({});
          await this.prisma.canteenPurchase.deleteMany({});
          await this.prisma.canteenSupplierPayment.deleteMany({});
          await this.prisma.canteenProduct.deleteMany({});
          await this.prisma.canteenSupplier.deleteMany({});
          await this.prisma.canteenPaymentMode.deleteMany({});
          await this.prisma.canteenCategory.deleteMany({});
          await this.prisma.canteenUnit.deleteMany({});
          await this.prisma.feeTransaction.deleteMany({});
          await this.prisma.ebBill.deleteMany({});
          await this.prisma.gateLog.deleteMany({});
          await this.prisma.outpass.deleteMany({});
          await this.prisma.clearanceRecord.deleteMany({});
          await this.prisma.messAttendance.deleteMany({});
          await this.prisma.staffSalary.deleteMany({});
          await this.prisma.staffAttendance.deleteMany({});
          await this.prisma.staff.deleteMany({});
          await this.prisma.student.deleteMany({});
          await this.prisma.fineMaster.deleteMany({});
          await this.prisma.college.deleteMany({});
          await this.prisma.room.deleteMany({});
          return { message: 'ALL HOSTEL DATA has been truncated successfully (Users, System Settings & Menu Permissions preserved).' };
          
        default:
          throw new BadRequestException('Unknown entity type for truncation');
      }
    } catch (error: any) {
      throw new BadRequestException(`Failed to truncate ${entity}: ${error.message}`);
    }
  }
}

import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { randomInt } from 'crypto';
import { PrismaService } from '../prisma.service';
import { WhatsappService } from '../whatsapp/whatsapp.service';

interface PortalOtpRecord {
  otp: string;
  expiresAt: number;
  attempts: number;
  lastSentAt: number;
}

@Injectable()
export class StudentsService {
  private readonly portalOtpStore = new Map<string, PortalOtpRecord>();

  constructor(
    private prisma: PrismaService,
    private whatsappService: WhatsappService,
  ) { }

  async getNextRegsiName(dateOfJoining?: Date | string) {
    const ref = dateOfJoining ? new Date(dateOfJoining) : new Date();
    const yearStr = (isNaN(ref.getTime()) ? new Date() : ref).getFullYear().toString().slice(-2);
    const prefix = `SEASIND${yearStr}`;

    // Find highest numeric sequence for this prefix
    const students = await this.prisma.student.findMany({
      where: { manualRegsiName: { startsWith: prefix } },
      select: { manualRegsiName: true }
    });

    let maxNumber = 0;
    for (const s of students) {
      if (s.manualRegsiName) {
        const numStr = s.manualRegsiName.replace(prefix, '').trim();
        const parsed = parseInt(numStr, 10);
        if (!isNaN(parsed) && parsed > maxNumber) {
          maxNumber = parsed;
        }
      }
    }

    const nextNumber = maxNumber + 1;

    return {
      nextRegsiName: `${prefix}${nextNumber.toString().padStart(3, '0')}`
    };
  }

  async create(createStudentDto: any) {
    const cleanData = { ...createStudentDto };

    const isPlaceholder = (val: any) => {
      if (val === undefined || val === null) return true;
      const s = val.toString().trim();
      if (!s) return true;
      const upper = s.toUpperCase().replace(/\s+/g, '');
      return ['NA', 'N/A', 'N/A.', 'NIL', 'NIL.', 'NONE', '-', '--', '0', '0000000000', '000000000000', 'NULL', 'UNDEFINED', 'NO', 'NOEMAIL', 'NOMOBILE'].includes(upper);
    };

    const isHeaderOrTitle = (name: string) => {
      const upper = name.toUpperCase().trim();
      const keywords = ['SEA SINDU STUDENTS', 'SEASINDU STUDENTS', 'STUDENTS', 'LEDGER', 'SL NO', 'S NO', 'SL.NO', 'S.NO', 'STUDENT NAME', 'FULL NAME', 'MOBILE NO', 'CONTACT NO', 'NEW ADMISSION', 'GRAND TOTAL', 'TOTAL RECORDS'];
      return keywords.some(k => upper === k || upper.includes('STUDENTS') || upper.includes('LEDGER') || upper.startsWith('TOTAL'));
    };

    // Clean keys & convert placeholders to null
    Object.keys(cleanData).forEach(key => {
      if (isPlaceholder(cleanData[key])) {
        cleanData[key] = null;
      } else if (typeof cleanData[key] === 'string') {
        cleanData[key] = cleanData[key].trim();
      }
    });

    const isImport = cleanData.isImport;
    if (isImport) {
      if (cleanData.name && isHeaderOrTitle(cleanData.name)) {
        throw new BadRequestException(`Title / subheading row skipped ("${cleanData.name}")`);
      }
      if (!cleanData.mobileNo || cleanData.mobileNo.trim() === '') {
        throw new BadRequestException(`Mobile number is required for importing student "${cleanData.name || 'Unknown'}". Row skipped.`);
      }
    }
    const autoGenerateInvoice = cleanData.autoGenerateInvoice;
    const messFee = cleanData.messFee;
    delete cleanData.autoGenerateInvoice;
    delete cleanData.messFee;
    delete cleanData.isImport;

    // Auto-generate collision-free regNo if not provided
    let regNo = cleanData.regNo;
    if (!regNo) {
      const year = new Date().getFullYear();
      const prefix = `HST-${year}-`;
      const allStudents = await this.prisma.student.findMany({
        where: { regNo: { startsWith: prefix } },
        select: { regNo: true }
      });
      let maxNum = 0;
      for (const s of allStudents) {
        if (s.regNo) {
          const parts = s.regNo.split('-');
          if (parts.length === 3) {
            const parsed = parseInt(parts[2], 10);
            if (!isNaN(parsed) && parsed > maxNum) {
              maxNum = parsed;
            }
          }
        }
      }
      regNo = `${prefix}${(maxNum + 1).toString().padStart(3, '0')}`;
    }

    if (cleanData.dob) {
      cleanData.dob = new Date(cleanData.dob);
    }

    if (cleanData.dateOfJoining) {
      cleanData.dateOfJoining = new Date(cleanData.dateOfJoining);
    }

    if (cleanData.roomNo) {
      const cleanRoom = cleanData.roomNo.trim().replace(/[`']/g, '');
      const isBadRoom = (
        cleanRoom.length > 10 ||
        /\.[A-Za-z]$/.test(cleanRoom) ||
        (/^[A-Za-z]{3,}$/.test(cleanRoom) && !/^(BLOCK|ROOM|FLAT|FLOOR|HALL|DORM|SUITE)/i.test(cleanRoom))
      );

      if (isBadRoom) {
        cleanData.roomNo = null;
      } else {
        cleanData.roomNo = cleanRoom;
        const roomExists = await this.prisma.room.findUnique({ where: { id: cleanData.roomNo } });
        if (roomExists) {
          if ((cleanData.rent === undefined || cleanData.rent === null || Number(cleanData.rent) === 0) && roomExists.rent > 0) {
            cleanData.rent = roomExists.rent;
          }
        } else {
          try {
            const blockChar = cleanData.roomNo.charAt(0).toUpperCase();
            await this.prisma.room.create({
              data: {
                id: cleanData.roomNo,
                block: blockChar,
                floor: 1,
                capacity: 4,
                type: 'Four Sharing'
              }
            });
          } catch {
            cleanData.roomNo = null;
          }
        }
      }
    }

    const rawCollegeName = cleanData.collegeName || cleanData.college;
    delete cleanData.collegeName;
    delete cleanData.college;

    if (cleanData.collegeId) {
      const collegeExists = await this.prisma.college.findUnique({ where: { id: cleanData.collegeId } });
      if (!collegeExists) {
        cleanData.collegeId = null;
      }
    }

    if (!cleanData.collegeId && rawCollegeName && typeof rawCollegeName === 'string' && rawCollegeName.trim().length >= 2) {
      const cName = rawCollegeName.trim();
      const allColleges = await this.prisma.college.findMany();
      const existing = allColleges.find(c =>
        c.name.toLowerCase() === cName.toLowerCase() ||
        (c.shortName && c.shortName.toLowerCase() === cName.toLowerCase()) ||
        c.name.toLowerCase().includes(cName.toLowerCase()) ||
        cName.toLowerCase().includes(c.name.toLowerCase())
      );

      if (existing) {
        cleanData.collegeId = existing.id;
      } else {
        try {
          const newCol = await this.prisma.college.create({
            data: {
              name: cName,
              shortName: cName.substring(0, 10).toUpperCase()
            }
          });
          cleanData.collegeId = newCol.id;
        } catch {
          const fallback = await this.prisma.college.findFirst({
            where: { name: { equals: cName, mode: 'insensitive' } }
          });
          if (fallback) cleanData.collegeId = fallback.id;
        }
      }
    }

    // Require mobile number for imports
    if (isImport && (!cleanData.mobileNo || cleanData.mobileNo.trim() === '')) {
      throw new BadRequestException(`Mobile number is required for student "${cleanData.name || 'Unknown'}". Record failed.`);
    }

    // On Excel import: Match existing student by ManualRegName, RegNo, or (Name + Mobile) to update record safely
    if (isImport) {
      const allStudents = await this.prisma.student.findMany({
        select: { id: true, name: true, mobileNo: true, aadharNo: true, manualRegsiName: true, regNo: true }
      });

      const isNameMatch = (name1?: string | null, name2?: string | null) => {
        if (!name1 || !name2) return false;
        const n1 = name1.toLowerCase().replace(/[^a-z0-9]/g, '');
        const n2 = name2.toLowerCase().replace(/[^a-z0-9]/g, '');
        if (n1 === n2) return true;
        if (n1.length > 3 && n2.length > 3 && (n1.includes(n2) || n2.includes(n1))) return true;
        return false;
      };

      const isMobileMatch = (mob1?: string | null, mob2?: string | null) => {
        if (!mob1 || !mob2) return false;
        const m1 = mob1.replace(/\D/g, '').slice(-10);
        const m2 = mob2.replace(/\D/g, '').slice(-10);
        return Boolean(m1 && m2 && m1.length >= 7 && m1 === m2);
      };

      let existingStudent: any = null;

      // 1. Match by manualRegsiName if provided in Excel
      if (cleanData.manualRegsiName) {
        existingStudent = allStudents.find(s => s.manualRegsiName && s.manualRegsiName.trim().toUpperCase() === cleanData.manualRegsiName.trim().toUpperCase()) || null;
      }

      // 2. Match by regNo if provided in Excel and not found
      if (!existingStudent && cleanData.regNo) {
        existingStudent = allStudents.find(s => s.regNo && s.regNo.trim().toUpperCase() === cleanData.regNo.trim().toUpperCase()) || null;
      }

      // 3. Match by Name AND Mobile (or Name AND Aadhar) if not found
      if (!existingStudent && cleanData.name) {
        existingStudent = allStudents.find(s => {
          const nameMatches = isNameMatch(s.name, cleanData.name);
          const mobMatches = isMobileMatch(s.mobileNo, cleanData.mobileNo);
          const aadharMatches = cleanData.aadharNo && s.aadharNo && s.aadharNo.replace(/\D/g, '') === cleanData.aadharNo.replace(/\D/g, '');
          return nameMatches && (mobMatches || aadharMatches);
        }) || null;
      }

      // IF MATCHED -> Safe Update
      if (existingStudent) {
        if (cleanData.manualRegsiName && cleanData.manualRegsiName !== existingStudent.manualRegsiName) {
          const clashRegsi = allStudents.find(s => s.manualRegsiName && s.manualRegsiName.trim().toUpperCase() === cleanData.manualRegsiName.trim().toUpperCase() && s.id !== existingStudent.id);
          if (clashRegsi) {
            throw new BadRequestException(
              `Duplicate Manual Reg Name: "${cleanData.manualRegsiName}" already belongs to student "${clashRegsi.name}".`
            );
          }
        }

        const updateData: any = {};
        if (cleanData.manualRegsiName) {
          updateData.manualRegsiName = cleanData.manualRegsiName;
        }

        const allowedKeys = [
          'name', 'gender', 'dob', 'collegeId', 'educationalQua',
          'courseDuration', 'emailId', 'aadharNo', 'bloodGroup', 'fatherName',
          'fatherMobileNo', 'motherName', 'motherMobileNo', 'guardianName',
          'guardianMobileNo', 'maritalStatus', 'roomNo', 'category',
          'foodType', 'vsrLedger1', 'dateOfJoining', 'pursuingYear'
        ];

        for (const key of allowedKeys) {
          if (cleanData[key] !== undefined && cleanData[key] !== null) {
            updateData[key] = cleanData[key];
          }
        }

        const updated = await this.prisma.student.update({
          where: { id: existingStudent.id },
          data: updateData
        });

        return {
          ...updated,
          _isUpdated: true
        };
      }

      // IF NOT MATCHED -> Check if mobileNo, aadharNo, or manualRegsiName belong to ANOTHER student
      if (cleanData.mobileNo) {
        const clashMobile = allStudents.find(s => isMobileMatch(s.mobileNo, cleanData.mobileNo));
        if (clashMobile) {
          throw new BadRequestException(
            `Duplicate Mobile Number: "${cleanData.mobileNo}" is already assigned to existing student "${clashMobile.name}". Cannot assign to "${cleanData.name}".`
          );
        }
      }

      if (cleanData.aadharNo) {
        const cleanAadhar = cleanData.aadharNo.replace(/\D/g, '');
        const clashAadhar = allStudents.find(s => s.aadharNo && s.aadharNo.replace(/\D/g, '') === cleanAadhar);
        if (clashAadhar) {
          throw new BadRequestException(
            `Duplicate Aadhar Number: "${cleanData.aadharNo}" is already assigned to existing student "${clashAadhar.name}". Cannot assign to "${cleanData.name}".`
          );
        }
      }

      if (cleanData.manualRegsiName) {
        const clashRegsi = allStudents.find(s => s.manualRegsiName && s.manualRegsiName.trim().toUpperCase() === cleanData.manualRegsiName.trim().toUpperCase());
        if (clashRegsi) {
          throw new BadRequestException(
            `Duplicate Manual Reg Name: "${cleanData.manualRegsiName}" already belongs to student "${clashRegsi.name}".`
          );
        }
      }
    }

    // For brand new student creation: Check duplicates
    if (cleanData.mobileNo) {
      const existingMobile = await this.prisma.student.findFirst({
        where: { mobileNo: cleanData.mobileNo }
      });
      if (existingMobile) {
        throw new BadRequestException(
          `Duplicate Mobile Number: "${cleanData.mobileNo}" already exists for student "${existingMobile.name}".`
        );
      }
    }

    if (cleanData.aadharNo) {
      const existingAadhar = await this.prisma.student.findFirst({
        where: { aadharNo: cleanData.aadharNo }
      });
      if (existingAadhar) {
        throw new BadRequestException(
          `Duplicate Aadhar Number: "${cleanData.aadharNo}" already exists for student "${existingAadhar.name}".`
        );
      }
    }

    if (cleanData.emailId) {
      const existingEmail = await this.prisma.student.findFirst({
        where: { emailId: cleanData.emailId }
      });
      if (existingEmail) {
        throw new BadRequestException(
          `Duplicate Email: "${cleanData.emailId}" already exists for student "${existingEmail.name}".`
        );
      }
    }

    if (cleanData.manualRegsiName) {
      const existingRegsi = await this.prisma.student.findFirst({
        where: { manualRegsiName: cleanData.manualRegsiName }
      });
      if (existingRegsi) {
        throw new BadRequestException(
          `Duplicate Manual Reg Name: "${cleanData.manualRegsiName}" already belongs to student "${existingRegsi.name}".`
        );
      }
    } else {
      cleanData.manualRegsiName = null;
    }

    let student: any;
    let retries = 5;
    while (retries > 0) {
      try {
        student = await this.prisma.student.create({
          data: {
            ...cleanData,
            regNo,
          },
        });
        break; // Success
      } catch (error: any) {
        if (error.code === 'P2002') {
          const target = error.meta?.target || [];
          const targetStr = Array.isArray(target) ? target.join(', ') : (target || 'field');

          if (targetStr.includes('manualRegsiName')) {
            const generated = await this.getNextRegsiName(cleanData.dateOfJoining);
            cleanData.manualRegsiName = isImport ? `${generated.nextRegsiName}_${Math.floor(Math.random() * 1000)}` : generated.nextRegsiName;
            retries--;
            if (retries === 0) {
              throw new BadRequestException('Failed to generate a unique Manual Regsi Name. Please try again.');
            }
            continue;
          }

          if (targetStr.includes('regNo')) {
            const year = new Date().getFullYear();
            const total = await this.prisma.student.count();
            regNo = `HST-${year}-${(total + retries + Math.floor(Math.random() * 100)).toString().padStart(3, '0')}`;
            retries--;
            if (retries === 0) {
              throw new BadRequestException('Failed to generate a unique Reg No. Please try again.');
            }
            continue;
          }

          if (isImport) {
            if (targetStr.includes('emailId')) { cleanData.emailId = null; retries--; continue; }
            if (targetStr.includes('aadharNo')) { cleanData.aadharNo = null; retries--; continue; }
          }

          throw new BadRequestException(`A student with this ${targetStr} already exists.`);
        } else if (error.code === 'P2003') {
          const fieldName = error.meta?.field_name || 'relation';
          if (typeof fieldName === 'string' && fieldName.includes('roomNo')) {
            throw new BadRequestException(`Invalid Room Number provided. The room does not exist.`);
          } else if (typeof fieldName === 'string' && fieldName.includes('collegeId')) {
            throw new BadRequestException(`Invalid College provided. The college does not exist.`);
          }
          throw new BadRequestException(`Foreign key constraint failed on ${fieldName}.`);
        }
        throw new BadRequestException(error.message || 'Failed to create student');
      }
    }

    if (student.roomNo) {
      await this.prisma.room.update({
        where: { id: student.roomNo },
        data: {
          occupiedCount: {
            increment: 1,
          },
        },
      });
    }

    if (student.advance && student.advance > 0) {
      const now = new Date();
      const currentBillingMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      await this.prisma.feeTransaction.create({
        data: {
          studentId: student.id,
          transactionType: 'ADVANCE',
          amount: student.advance,
          status: 'PENDING',
          billingMonth: currentBillingMonth,
          description: isImport ? 'Security Deposit (Imported)' : 'Security Deposit (Advance)',
        },
      });
      await this.prisma.student.update({
        where: { id: student.id },
        data: { advance: 0 },
      });
    }

    if (autoGenerateInvoice || isImport) {
      if (student.rent && student.rent > 0) {
        await this.prisma.feeTransaction.create({
          data: {
            studentId: student.id,
            transactionType: 'RENT',
            amount: student.rent,
            status: 'PENDING',
            paymentMode: undefined,
            description: isImport ? 'Month 1 Room Rent (Imported)' : 'Month 1 Room Rent',
          }
        });
      }
      if (messFee && messFee > 0) {
        await this.prisma.feeTransaction.create({
          data: {
            studentId: student.id,
            transactionType: 'MESS',
            amount: messFee,
            status: 'PENDING',
            paymentMode: undefined,
            description: isImport ? 'Month 1 Mess Fee (Imported)' : 'Month 1 Mess Fee',
          }
        });
      }
    }

    // Automatically send official Student ID Card PDF to the student via WhatsApp
    const targetPhone = student.mobileNo || cleanData.mobileNo || student.fatherMobileNo;
    if (targetPhone && !isImport) {
      this.whatsappService.sendStudentIdCard(targetPhone, {
        id: student.id,
        uuid: student.id,
        name: student.name,
        regNo: student.regNo,
        manualRegsiName: student.manualRegsiName,
        roomNo: student.roomNo,
        bedNo: student.bedNo,
        bloodGroup: student.bloodGroup,
        collegeName: rawCollegeName || cleanData.collegeName,
        mobileNo: student.mobileNo,
        dateOfJoining: student.dateOfJoining,
        foodType: student.foodType,
        biometricId: student.biometricId,
        photoUrl: student.photoUrl,
      }).catch(err => {
        console.error('Failed to auto-send student ID card on registration:', err);
      });
    }

    return {
      ...student,
      _isUpdated: false
    };
  }

  async findAll(params?: { page?: number; limit?: number; search?: string; roomFilter?: string; blockFilter?: string; collegeFilter?: string; collegeCategory?: string; sortFilter?: string; feeFilter?: string; statusFilter?: string; fromDate?: string; toDate?: string }) {
    const hasPagination = params?.page !== undefined || params?.limit !== undefined;
    const page = params?.page || 1;
    const limit = params?.limit || 10;
    const skip = hasPagination ? (page - 1) * limit : undefined;
    const take = hasPagination ? limit : undefined;

    const where: any = {};
    if (params?.search) {
      const q = params.search.trim();
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { regNo: { contains: q, mode: 'insensitive' } },
        { manualRegsiName: { contains: q, mode: 'insensitive' } },
        { mobileNo: { contains: q, mode: 'insensitive' } },
        { roomNo: { contains: q, mode: 'insensitive' } },
        { educationalQua: { contains: q, mode: 'insensitive' } },
        { fatherName: { contains: q, mode: 'insensitive' } }
      ];
    }

    if (params?.roomFilter && params.roomFilter !== '-- All Rooms --') {
      const r = params.roomFilter.replace('Room ', '').trim();
      where.roomNo = r;
    }

    // Block is stored on the room ("A", "Block A", ...). Also match the room
    // number prefix so students whose room relation is missing are not lost.
    if (
      params?.blockFilter &&
      params.blockFilter !== 'ALL' &&
      params.blockFilter !== 'All Blocks'
    ) {
      const block = params.blockFilter.replace(/^block\s*/i, '').trim();
      if (block) {
        where.AND = [
          ...(where.AND || []),
          {
            OR: [
              { room: { block: { equals: block, mode: 'insensitive' } } },
              { room: { block: { equals: `Block ${block}`, mode: 'insensitive' } } },
              { roomNo: { startsWith: block, mode: 'insensitive' } },
            ],
          },
        ];
      }
    }

    if (params?.collegeFilter && params.collegeFilter !== '-- All Colleges --') {
      where.college = {
        name: params.collegeFilter
      };
    }

    // Separate report category filter: SSM on its own, everything else Seasindhu.
    if (params?.collegeCategory === 'SSM') {
      where.AND = [
        ...(where.AND || []),
        { college: { name: { equals: 'SSM', mode: 'insensitive' } } },
      ];
    } else if (params?.collegeCategory === 'Seasindhu') {
      where.AND = [
        ...(where.AND || []),
        { NOT: { college: { name: { equals: 'SSM', mode: 'insensitive' } } } },
      ];
    }

    if (params?.statusFilter === 'ACTIVE') {
      where.status = { not: 'Vacated' };
    } else if (params?.statusFilter === 'INACTIVE') {
      where.status = 'Vacated';
    }

    // Joining-date range. Inputs are HTML date strings (YYYY-MM-DD); the range
    // is inclusive of the whole selected start and end days.
    if (params?.fromDate || params?.toDate) {
      const joiningDateFilter: any = {};
      if (params.fromDate) {
        const from = new Date(`${params.fromDate}T00:00:00`);
        if (!Number.isNaN(from.getTime())) joiningDateFilter.gte = from;
      }
      if (params.toDate) {
        const to = new Date(`${params.toDate}T23:59:59.999`);
        if (!Number.isNaN(to.getTime())) joiningDateFilter.lte = to;
      }
      if (Object.keys(joiningDateFilter).length > 0) {
        // Fall back to createdAt for legacy records without a joining date,
        // matching the date shown on the Hostellers page.
        where.AND = [
          ...(where.AND || []),
          {
            OR: [
              { dateOfJoining: joiningDateFilter },
              { AND: [{ dateOfJoining: null }, { createdAt: joiningDateFilter }] },
            ],
          },
        ];
      }
    }

    if (params?.feeFilter && params.feeFilter !== '-- All Fee Status --') {
      // Imported/legacy pending rows are excluded from the fee-status filter,
      // except October 2026 EB bills, which remain payable and are counted by
      // the shared frontend pending-fee calculation.
      const importedOrSettledRowsCondition = {
        OR: [
          { description: { contains: 'Imported', mode: 'insensitive' } },
          { description: { contains: 'Month 1', mode: 'insensitive' } },
          {
            AND: [
              { description: { contains: 'October 2026', mode: 'insensitive' } },
              { transactionType: { not: 'EB_BILL' } },
            ],
          },
        ]
      };

      if (params.feeFilter === 'Un-Paid') {
        where.transactions = {
          some: {
            status: 'PENDING',
            deletedAt: null,
            NOT: importedOrSettledRowsCondition
          }
        };
      } else if (params.feeFilter === 'Paid') {
        where.transactions = {
          none: {
            status: 'PENDING',
            deletedAt: null,
            NOT: importedOrSettledRowsCondition
          }
        };
      } else if (params.feeFilter === 'No Dues') {
        where.transactions = { none: { deletedAt: null } };
      } else if (params.feeFilter === 'Outstanding') {
        where.transactions = {
          some: {
            status: 'PENDING',
            deletedAt: null,
            transactionType: { notIn: ['MESS', 'MESS DEDUCTION'] },
            description: { startsWith: 'Outstanding', mode: 'insensitive' },
          },
        };
      }
    }

    let orderBy: any = { createdAt: 'asc' };
    if (params?.sortFilter === 'updated') {
      where.profileUpdatedAt = { not: null };
      orderBy = { profileUpdatedAt: 'desc' };
    }

    const isOutstandingFilter = params?.feeFilter === 'Outstanding';

    let [data, total] = isOutstandingFilter
      ? [
          await this.prisma.student.findMany({
            where,
            orderBy,
            include: { transactions: { where: { deletedAt: null } }, room: true, college: true },
          }),
          0,
        ]
      : await Promise.all([
          this.prisma.student.findMany({
            where,
            skip,
            take,
            orderBy,
            include: { transactions: { where: { deletedAt: null } }, room: true, college: true },
          }),
          this.prisma.student.count({ where }),
        ]);

    if (isOutstandingFilter) {
      const withRemaining = data.filter((student: any) => {
        const txns = Array.isArray(student.transactions) ? student.transactions : [];
        const original = txns
          .filter(
            (t: any) =>
              t.status === 'PENDING' &&
              !['MESS', 'MESS DEDUCTION'].includes(String(t.transactionType || '').toUpperCase()) &&
              /^\s*outstanding\b/i.test(String(t.description || '')),
          )
          .reduce((sum: number, t: any) => sum + (Number(t.amount) || 0), 0);
        const paid = txns
          .filter(
            (t: any) =>
              t.status === 'COMPLETED' &&
              String(t.transactionType || '').toUpperCase() === 'OUTSTANDING_PAYMENT',
          )
          .reduce((sum: number, t: any) => sum + (Number(t.amount) || 0), 0);
        return original - paid > 0.005;
      });
      total = withRemaining.length;
      data = hasPagination ? withRemaining.slice(skip || 0, (skip || 0) + limit) : withRemaining;
    }

    const advanceRows = await this.prisma.$queryRaw<Array<{ id: string; advanceRentBalance: number }>>`
      SELECT "id", COALESCE("advanceRentBalance", 0) AS "advanceRentBalance"
      FROM "public"."Student"
      WHERE COALESCE("advanceRentBalance", 0) > 0
    `.catch((): Array<{ id: string; advanceRentBalance: number }> => []);
    const advanceMap = new Map(advanceRows.map((r) => [r.id, Number(r.advanceRentBalance || 0)]));
    for (const student of data as any[]) {
      student.advanceRentBalance = advanceMap.get(student.id) || 0;
    }

    return {
      data,
      total,
      page: hasPagination ? page : 1,
      limit: hasPagination ? limit : total,
      totalPages: hasPagination ? Math.ceil(total / limit) : 1
    };
  }

  async findByMobile(mobileNo: string) {
    return this.prisma.student.findFirst({
      where: { mobileNo },
      include: { transactions: { where: { deletedAt: null } }, room: true, college: true }
    });
  }

  async sendPortalOtp(mobileNo: string) {
    const cleanMobile = String(mobileNo || '').trim().replace(/\D/g, '');
    if (cleanMobile.length !== 10) {
      throw new BadRequestException('Please enter a valid 10-digit mobile number.');
    }

    const student = await this.prisma.student.findFirst({
      where: { mobileNo: cleanMobile },
      select: { id: true, name: true, status: true, mobileNo: true },
    });
    if (!student) {
      throw new NotFoundException(
        'No student registered with this mobile number. Please check the number and try again.',
      );
    }
    if (student.status === 'Vacated') {
      throw new ForbiddenException(
        'This student account is inactive. Please contact the hostel office for assistance.',
      );
    }

    const existing = this.portalOtpStore.get(cleanMobile);
    if (existing && Date.now() - existing.lastSentAt < 25 * 1000) {
      const waitSec = Math.ceil((25 * 1000 - (Date.now() - existing.lastSentAt)) / 1000);
      throw new BadRequestException(`Please wait ${waitSec}s before requesting another OTP.`);
    }

    const otp = String(randomInt(1000, 10000));
    this.portalOtpStore.set(cleanMobile, {
      otp,
      expiresAt: Date.now() + 5 * 60 * 1000,
      attempts: 0,
      lastSentAt: Date.now(),
    });

    const message = [
      `*SEA SINDHU QUEEN'S PARADISE*`,
      `Hello ${student.name || 'Student'},`,
      `Your Student Payment Portal login OTP is: *${otp}*`,
      ``,
      `This OTP is valid for 5 minutes. Do not share it with anyone.`,
    ].join('\n');

    const sent = await this.whatsappService.sendTextMessage(cleanMobile, message);
    if (!sent) {
      this.portalOtpStore.delete(cleanMobile);
      throw new ServiceUnavailableException(
        'Could not send WhatsApp OTP right now. Please ensure WhatsApp is connected or contact the hostel office.',
      );
    }

    return {
      success: true,
      message: 'OTP sent to your registered WhatsApp number.',
    };
  }

  async verifyPortalOtp(mobileNo: string, otp: string) {
    const cleanMobile = String(mobileNo || '').trim().replace(/\D/g, '');
    const cleanOtp = String(otp || '').trim();
    if (cleanMobile.length !== 10) {
      throw new BadRequestException('Please enter a valid 10-digit mobile number.');
    }
    if (!/^\d{4}$/.test(cleanOtp)) {
      throw new BadRequestException('Please enter a valid 4-digit OTP.');
    }

    const record = this.portalOtpStore.get(cleanMobile);
    if (!record || Date.now() > record.expiresAt) {
      this.portalOtpStore.delete(cleanMobile);
      throw new BadRequestException('OTP has expired or was not requested. Please request a new OTP.');
    }

    if (record.attempts >= 5) {
      this.portalOtpStore.delete(cleanMobile);
      throw new BadRequestException('Too many invalid OTP attempts. Please request a new OTP.');
    }

    if (record.otp !== cleanOtp) {
      record.attempts += 1;
      throw new BadRequestException('Invalid OTP. Please check your WhatsApp message and try again.');
    }

    this.portalOtpStore.delete(cleanMobile);
    const student = await this.findByMobile(cleanMobile);
    if (!student) {
      throw new NotFoundException('Student not found.');
    }
    return student;
  }

  async findOne(id: string) {
    // Check if ID is a UUID
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

    if (isUuid) {
      return this.prisma.student.findUnique({
        where: { id },
        include: { room: true, clearance: true, college: true, transactions: { where: { deletedAt: null }, orderBy: { createdAt: 'desc' } } }
      });
    } else {
      return this.prisma.student.findFirst({
        where: { OR: [{ regNo: id }, { manualRegsiName: id }] },
        include: { room: true, clearance: true, college: true, transactions: { where: { deletedAt: null }, orderBy: { createdAt: 'desc' } } }
      });
    }
  }

  async update(id: string, updateData: any) {
    console.log('--- BACKEND UPDATE RECEIVED ---');
    console.log('ID:', id);
    console.log('updateData:', updateData);

    const cleanData = { ...updateData };
    const newMessFee = cleanData.messFee !== undefined ? (Number(cleanData.messFee) || 2000) : null;
    delete cleanData.messFee;

    Object.keys(cleanData).forEach(key => {
      if (cleanData[key] === '') {
        cleanData[key] = null;
      }
    });

    console.log('cleanData:', cleanData);

    if (cleanData.dob) {
      cleanData.dob = new Date(cleanData.dob);
    }

    if (cleanData.dateOfJoining) {
      cleanData.dateOfJoining = new Date(cleanData.dateOfJoining);
    }

    if (cleanData.rent !== undefined && cleanData.rent !== null) {
      cleanData.rent = Number(cleanData.rent) || 0;
    }
    if (cleanData.advance !== undefined && cleanData.advance !== null) {
      cleanData.advance = Number(cleanData.advance) || 0;
    }

    const existingStudent = await this.prisma.student.findFirst({
      where: { OR: [{ id }, { regNo: id }, { manualRegsiName: id }] },
      select: { id: true, roomNo: true, status: true }
    });

    if (!existingStudent) {
      throw new BadRequestException(`Student with ID ${id} not found.`);
    }

    const updatedStudent = await this.prisma.student.update({
      where: { id: existingStudent.id },
      data: cleanData
    });

    if (newMessFee !== null && newMessFee > 0) {
      const pendingMess = await this.prisma.feeTransaction.findFirst({
        where: { studentId: existingStudent.id, transactionType: 'MESS', status: 'PENDING', deletedAt: null },
        orderBy: { createdAt: 'desc' }
      });
      if (pendingMess) {
        await this.prisma.feeTransaction.update({
          where: { id: pendingMess.id },
          data: { amount: newMessFee }
        });
      }
    }

    // Keep pending RENT invoices in sync with the student's current rent.
    // When an admin edits Student.rent (e.g. via the registration form), every
    // already-generated pending rent invoice must reflect the new rate so that
    // Pending Fees = Monthly Rent + Monthly Mess + EB - Total Paid stays correct.
    if (cleanData.rent !== undefined && Number(cleanData.rent) > 0) {
      await this.prisma.feeTransaction.updateMany({
        where: { studentId: existingStudent.id, transactionType: 'RENT', status: 'PENDING', deletedAt: null },
        data: { amount: Number(cleanData.rent) },
      });
    }

    const oldRoom = existingStudent?.roomNo;
    const newRoom = updatedStudent.roomNo;
    const oldStatus = existingStudent?.status;
    const newStatus = updatedStudent.status;

    // Check if room or status changed
    if (oldRoom !== newRoom || oldStatus !== newStatus) {
      // Decrease from old room if they had one and were not 'Vacated'
      if (oldRoom && oldStatus !== 'Vacated') {
        await this.prisma.room.update({
          where: { id: oldRoom },
          data: {
            occupiedCount: {
              decrement: 1
            }
          }
        });
      }

      // Increase for new room if they have one and are not 'Vacated'
      if (newRoom && newStatus !== 'Vacated') {
        await this.prisma.room.update({
          where: { id: newRoom },
          data: {
            occupiedCount: {
              increment: 1
            }
          }
        });
      }
    }

    // Automatically send updated official Student ID Card PDF to the student via WhatsApp
    const targetPhone = updatedStudent.mobileNo || cleanData.mobileNo || updatedStudent.fatherMobileNo;
    if (targetPhone) {
      let collegeName: string | undefined;
      if (updatedStudent.collegeId) {
        try {
          const col = await this.prisma.college.findUnique({ where: { id: updatedStudent.collegeId } });
          collegeName = col?.name;
        } catch {}
      }

      this.whatsappService.sendStudentIdCard(targetPhone, {
        id: updatedStudent.id,
        uuid: updatedStudent.id,
        name: updatedStudent.name,
        regNo: updatedStudent.regNo,
        manualRegsiName: updatedStudent.manualRegsiName,
        roomNo: updatedStudent.roomNo,
        bedNo: updatedStudent.bedNo,
        bloodGroup: updatedStudent.bloodGroup,
        collegeName: collegeName,
        mobileNo: updatedStudent.mobileNo,
        dateOfJoining: updatedStudent.dateOfJoining,
        foodType: updatedStudent.foodType,
        biometricId: updatedStudent.biometricId,
        photoUrl: updatedStudent.photoUrl,
      }).catch(err => {
        console.error('Failed to auto-send student ID card on update:', err);
      });
    }

    return updatedStudent;
  }

  /**
   * Repair: any student who has a ClearanceRecord but whose status is not 'Vacated'
   * (clearance was created without properly updating the student status). Sets
   * status to 'Vacated' and frees their room/bed.
   */
  async syncVacatedStatus() {
    const cleared = await this.prisma.clearanceRecord.findMany({
      select: { studentId: true },
    });
    const clearedIds = cleared.map((c) => c.studentId);

    const broken = await this.prisma.student.findMany({
      where: { id: { in: clearedIds }, status: { not: 'Vacated' } },
      select: { id: true, roomNo: true },
    });

    let fixedCount = 0;
    for (const s of broken) {
      await this.prisma.student.update({
        where: { id: s.id },
        data: { status: 'Vacated', roomNo: null, bedNo: null },
      });
      if (s.roomNo) {
        await this.prisma.room.update({
          where: { id: s.roomNo },
          data: { occupiedCount: { decrement: 1 } },
        }).catch(() => { /* room may have been deleted */ });
      }
      fixedCount++;
    }

    return {
      message: `Synced ${fixedCount} cleared student(s) to Vacated status.`,
      fixedCount,
      totalCleared: clearedIds.length,
    };
  }

  /**
   * Repair: sync any PENDING RENT invoice to the student's current Student.rent.
   * Fixes stale invoices created before a room/student rent change.
   */
  async syncRentInvoices() {
    const pendingRent = await this.prisma.feeTransaction.findMany({
      where: { transactionType: 'RENT', status: 'PENDING', deletedAt: null },
      include: { student: true },
    });

    let fixedCount = 0;
    for (const tx of pendingRent) {
      const studentRent = tx.student?.rent ?? 0;
      if (studentRent > 0 && Math.abs(studentRent - tx.amount) > 0.001) {
        await this.prisma.feeTransaction.update({
          where: { id: tx.id },
          data: { amount: studentRent },
        });
        fixedCount++;
      }
    }

    return {
      message: `Synced ${fixedCount} pending RENT invoice(s) to match current student rent.`,
      fixedCount,
      totalPendingRent: pendingRent.length,
    };
  }
}

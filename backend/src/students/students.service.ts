import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Injectable()
export class StudentsService {
  constructor(private prisma: PrismaService) {}

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
        if (!roomExists) {
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

    if (cleanData.collegeId) {
      const collegeExists = await this.prisma.college.findUnique({ where: { id: cleanData.collegeId } });
      if (!collegeExists) {
        cleanData.collegeId = null;
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
      await this.prisma.feeTransaction.create({
        data: {
          studentId: student.id,
          transactionType: 'ADVANCE',
          amount: student.advance,
          status: isImport ? 'PENDING' : 'COMPLETED',
          paymentMode: isImport ? undefined : 'UPI',
          description: isImport ? 'Security Deposit (Imported)' : 'Initial Security Deposit Paid',
        }
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

    return {
      ...student,
      _isUpdated: false
    };
  }

  async findAll(params?: { page?: number; limit?: number; search?: string; roomFilter?: string; collegeFilter?: string; sortFilter?: string; feeFilter?: string }) {
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
    
    if (params?.collegeFilter && params.collegeFilter !== '-- All Colleges --') {
      where.college = {
        name: params.collegeFilter
      };
    }

    if (params?.feeFilter && params.feeFilter !== '-- All Fee Status --') {
      if (params.feeFilter === 'Un-Paid') {
        where.transactions = { some: { status: 'PENDING' } };
      } else if (params.feeFilter === 'Paid') {
        where.transactions = { some: { status: 'COMPLETED' }, none: { status: 'PENDING' } };
      } else if (params.feeFilter === 'No Dues') {
        where.transactions = { none: {} };
      }
    }

    let orderBy: any = { createdAt: 'asc' };
    if (params?.sortFilter === 'updated') {
      where.profileUpdatedAt = { not: null };
      orderBy = { profileUpdatedAt: 'desc' };
    }

    const [data, total] = await Promise.all([
      this.prisma.student.findMany({
        where,
        skip,
        take,
        orderBy,
        include: { transactions: true, room: true, college: true }
      }),
      this.prisma.student.count({ where })
    ]);

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
      include: { transactions: true, room: true, college: true }
    });
  }

  async findOne(id: string) {
    // Check if ID is a UUID
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
    
    if (isUuid) {
      return this.prisma.student.findUnique({
        where: { id },
        include: { room: true, clearance: true, college: true }
      });
    } else {
      return this.prisma.student.findFirst({
        where: { OR: [{ regNo: id }, { manualRegsiName: id }] },
        include: { room: true, clearance: true, college: true }
      });
    }
  }

  async update(id: string, updateData: any) {
    console.log('--- BACKEND UPDATE RECEIVED ---');
    console.log('ID:', id);
    console.log('updateData:', updateData);

    const cleanData = { ...updateData };
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

    return updatedStudent;
  }
}


import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateStaffDto } from './dto/create-staff.dto';
import { UpdateStaffDto } from './dto/update-staff.dto';
import { BiometricPunchDto } from './dto/biometric-punch.dto';
import { classifyAttendance, parseTimeToMinutes, ATTENDANCE_RULES } from './staff-attendance-calculator';

@Injectable()
export class StaffService {
  constructor(private readonly prisma: PrismaService) {}

  private get staffModel() {
    return (this.prisma as any).staff;
  }

  async getNextStaffCode(): Promise<{ nextCode: string }> {
    const allStaff = await this.staffModel.findMany({
      select: { staffCode: true },
      orderBy: { createdAt: 'desc' }
    });

    let maxNum = 0;
    const prefix = 'STF-';

    for (const s of allStaff) {
      if (s.staffCode && s.staffCode.startsWith(prefix)) {
        const numPart = s.staffCode.substring(prefix.length);
        const parsed = parseInt(numPart, 10);
        if (!isNaN(parsed) && parsed > maxNum) {
          maxNum = parsed;
        }
      }
    }

    const nextNum = maxNum + 1;
    const nextCode = `${prefix}${String(nextNum).padStart(3, '0')}`;
    return { nextCode };
  }

  async create(dto: CreateStaffDto) {
    let code = dto.staffCode ? dto.staffCode.trim() : '';
    if (!code) {
      const { nextCode } = await this.getNextStaffCode();
      code = nextCode;
    }

    const existing = await this.staffModel.findUnique({
      where: { staffCode: code }
    });
    if (existing) {
      throw new BadRequestException(`Staff code "${code}" already exists.`);
    }

    let joiningDate = new Date();
    if (dto.joiningDate) {
      const parsed = new Date(dto.joiningDate);
      if (!isNaN(parsed.getTime())) {
        joiningDate = parsed;
      }
    }

    return this.staffModel.create({
      data: {
        staffCode: code,
        name: dto.name.trim(),
        joiningDate,
        role: dto.role.trim(),
        phone: dto.phone ? dto.phone.trim() : null,
        email: dto.email ? dto.email.trim() : null,
        salaryBasis: dto.salaryBasis || 'Monthly Fixed',
        baseSalary: dto.baseSalary !== undefined ? Number(dto.baseSalary) : 0.0,
        status: dto.status || 'Active',
        notes: dto.notes || null,
      }
    });
  }

  async findAll(query?: { search?: string; role?: string; salaryBasis?: string; status?: string }) {
    const where: any = {};

    if (query?.search) {
      const term = query.search.trim();
      where.OR = [
        { name: { contains: term, mode: 'insensitive' } },
        { staffCode: { contains: term, mode: 'insensitive' } },
        { phone: { contains: term, mode: 'insensitive' } },
        { role: { contains: term, mode: 'insensitive' } },
      ];
    }

    if (query?.role && query.role !== 'ALL') {
      where.role = query.role;
    }

    if (query?.salaryBasis && query.salaryBasis !== 'ALL') {
      where.salaryBasis = query.salaryBasis;
    }

    if (query?.status && query.status !== 'ALL') {
      where.status = query.status;
    }

    return this.staffModel.findMany({
      where,
      orderBy: { staffCode: 'asc' }
    });
  }

  async findOne(id: string) {
    const staff = await this.staffModel.findUnique({
      where: { id }
    });
    if (!staff) {
      throw new NotFoundException('Staff member not found');
    }
    return staff;
  }

  async update(id: string, dto: UpdateStaffDto) {
    const staff = await this.findOne(id);

    if (dto.staffCode && dto.staffCode.trim() !== staff.staffCode) {
      const clash = await this.staffModel.findUnique({
        where: { staffCode: dto.staffCode.trim() }
      });
      if (clash && clash.id !== id) {
        throw new BadRequestException(`Staff code "${dto.staffCode}" already in use.`);
      }
    }

    const data: any = {};
    if (dto.staffCode !== undefined) data.staffCode = dto.staffCode.trim();
    if (dto.name !== undefined) data.name = dto.name.trim();
    if (dto.role !== undefined) data.role = dto.role.trim();
    if (dto.phone !== undefined) data.phone = dto.phone ? dto.phone.trim() : null;
    if (dto.email !== undefined) data.email = dto.email ? dto.email.trim() : null;
    if (dto.salaryBasis !== undefined) data.salaryBasis = dto.salaryBasis;
    if (dto.baseSalary !== undefined) data.baseSalary = Number(dto.baseSalary);
    if (dto.status !== undefined) data.status = dto.status;
    if (dto.notes !== undefined) data.notes = dto.notes;

    if (dto.joiningDate) {
      const parsed = new Date(dto.joiningDate);
      if (!isNaN(parsed.getTime())) {
        data.joiningDate = parsed;
      }
    }

    return this.staffModel.update({
      where: { id },
      data
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.staffModel.delete({
      where: { id }
    });
  }

  async toggleStatus(id: string) {
    const staff = await this.findOne(id);
    const newStatus = staff.status === 'Active' ? 'Inactive' : 'Active';
    return this.staffModel.update({
      where: { id },
      data: { status: newStatus }
    });
  }

  private get attendanceModel() {
    return (this.prisma as any).staffAttendance || (this.prisma as any)['staffAttendance'];
  }

  async getAttendanceRoster(dateStr?: string) {
    const todayStr = dateStr || new Date().toISOString().split('T')[0];

    const allStaff = await this.staffModel.findMany({
      where: { status: 'Active' },
      orderBy: { staffCode: 'asc' }
    });

    let attendances: any[] = [];
    if (this.attendanceModel?.findMany) {
      attendances = await this.attendanceModel.findMany({
        where: { dateStr: todayStr }
      });
    }

    const attendanceMap = new Map();
    for (const a of attendances) {
      attendanceMap.set(a.staffId, a);
    }

    return allStaff.map((staff: any) => {
      const att = attendanceMap.get(staff.id);
      const classificationResult = classifyAttendance({
        checkInTime: att?.checkInTime,
        checkOutTime: att?.checkOutTime,
        currentStatus: att?.status,
        isManualOverride: att?.status === 'On Leave' || att?.status === 'Absent'
      });

      return {
        staffId: staff.id,
        staffCode: staff.staffCode,
        name: staff.name,
        role: staff.role,
        phone: staff.phone,
        dateStr: todayStr,
        attendanceId: att?.id || null,
        checkInTime: att?.checkInTime || '--:--',
        checkOutTime: att?.checkOutTime || '--:--',
        status: att?.status || 'Not Marked',
        workDuration: classificationResult.workDuration,
        durationMinutes: classificationResult.durationMinutes,
        classification: classificationResult.classification,
        remarks: att?.remarks || ''
      };
    });
  }

  async saveAttendance(dto: any) {
    const { staffId, dateStr, checkInTime, checkOutTime, status, remarks } = dto;
    await this.findOne(staffId);

    if (!this.attendanceModel) {
      throw new BadRequestException('Staff attendance service is not initialized');
    }

    const isManualOverride = status === 'On Leave' || status === 'Absent';
    const autoResult = classifyAttendance({
      checkInTime,
      checkOutTime,
      currentStatus: status,
      isManualOverride
    });

    // If manual override (On Leave or Absent), respect it; otherwise auto-detect Full Day / Half Day if both checkIn and checkOut exist
    let effectiveStatus = status || 'Present';
    if (!isManualOverride && checkInTime && checkOutTime && checkInTime !== '--:--' && checkOutTime !== '--:--') {
      effectiveStatus = autoResult.status;
    }

    const existing = await this.attendanceModel.findUnique({
      where: {
        staffId_dateStr: { staffId, dateStr }
      }
    });

    let record;
    if (existing) {
      record = await this.attendanceModel.update({
        where: { id: existing.id },
        data: {
          checkInTime: checkInTime || null,
          checkOutTime: checkOutTime || null,
          status: effectiveStatus,
          remarks: remarks || null
        }
      });
    } else {
      record = await this.attendanceModel.create({
        data: {
          staffId,
          dateStr,
          checkInTime: checkInTime || null,
          checkOutTime: checkOutTime || null,
          status: effectiveStatus,
          remarks: remarks || null
        }
      });
    }

    return {
      ...record,
      workDuration: autoResult.workDuration,
      durationMinutes: autoResult.durationMinutes,
      classification: autoResult.classification
    };
  }

  async recordBiometricPunch(dto: BiometricPunchDto) {
    if (!this.attendanceModel) {
      throw new BadRequestException('Staff attendance service is not initialized');
    }

    // 1. Identify staff member
    let staff: any = null;
    if (dto.staffId) {
      staff = await this.staffModel.findUnique({ where: { id: dto.staffId } });
    } else if (dto.staffCode) {
      staff = await this.staffModel.findUnique({ where: { staffCode: dto.staffCode.trim() } });
    }

    if (!staff) {
      throw new NotFoundException(`Staff member not found for ID "${dto.staffId || ''}" or Code "${dto.staffCode || ''}"`);
    }

    // 2. Resolve date and time
    let dateStr = dto.dateStr;
    let timeStr = dto.timeStr;

    if (dto.timestamp) {
      const d = new Date(dto.timestamp);
      if (!isNaN(d.getTime())) {
        if (!dateStr) dateStr = d.toISOString().split('T')[0];
        if (!timeStr) {
          timeStr = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
        }
      }
    }

    const now = new Date();
    if (!dateStr) {
      dateStr = now.toISOString().split('T')[0];
    }
    if (!timeStr) {
      timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
    }

    // 3. Find existing attendance record for today
    const existing = await this.attendanceModel.findUnique({
      where: {
        staffId_dateStr: { staffId: staff.id, dateStr }
      }
    });

    const punchMinutes = parseTimeToMinutes(timeStr);
    const punchType = (dto.type || 'AUTO').toUpperCase();

    // 4. Check for duplicate/debounce scans within 2 minutes
    if (existing?.checkInTime && punchMinutes !== null) {
      const existingInMinutes = parseTimeToMinutes(existing.checkInTime);
      if (existingInMinutes !== null && Math.abs(punchMinutes - existingInMinutes) < ATTENDANCE_RULES.DEBOUNCE_MINUTES && punchType !== 'OUT') {
        const currentClassified = classifyAttendance({
          checkInTime: existing.checkInTime,
          checkOutTime: existing.checkOutTime,
          currentStatus: existing.status
        });
        return {
          ...existing,
          isDuplicateIgnored: true,
          workDuration: currentClassified.workDuration,
          classification: currentClassified.classification
        };
      }
    }

    if (existing?.checkOutTime && punchMinutes !== null) {
      const existingOutMinutes = parseTimeToMinutes(existing.checkOutTime);
      if (existingOutMinutes !== null && Math.abs(punchMinutes - existingOutMinutes) < ATTENDANCE_RULES.DEBOUNCE_MINUTES) {
        const currentClassified = classifyAttendance({
          checkInTime: existing.checkInTime,
          checkOutTime: existing.checkOutTime,
          currentStatus: existing.status
        });
        return {
          ...existing,
          isDuplicateIgnored: true,
          workDuration: currentClassified.workDuration,
          classification: currentClassified.classification
        };
      }
    }

    // 5. Determine Check-In vs Check-Out
    let newCheckIn = existing?.checkInTime || null;
    let newCheckOut = existing?.checkOutTime || null;
    const existingStatus = existing?.status || 'Present';
    const remarks = existing?.remarks || null;

    if (punchType === 'IN') {
      newCheckIn = timeStr;
    } else if (punchType === 'OUT') {
      newCheckOut = timeStr;
    } else {
      // AUTO mode
      if (!newCheckIn) {
        newCheckIn = timeStr;
      } else {
        newCheckOut = timeStr;
      }
    }

    // 6. Calculate total duration and auto-classify
    const isManualOverride = existingStatus === 'On Leave' || existingStatus === 'Absent';
    const classificationResult = classifyAttendance({
      checkInTime: newCheckIn,
      checkOutTime: newCheckOut,
      currentStatus: existingStatus,
      isManualOverride
    });

    const statusToSave = isManualOverride ? existingStatus : classificationResult.status;

    let savedRecord;
    if (existing) {
      savedRecord = await this.attendanceModel.update({
        where: { id: existing.id },
        data: {
          checkInTime: newCheckIn,
          checkOutTime: newCheckOut,
          status: statusToSave,
          remarks
        }
      });
    } else {
      savedRecord = await this.attendanceModel.create({
        data: {
          staffId: staff.id,
          dateStr,
          checkInTime: newCheckIn,
          checkOutTime: newCheckOut,
          status: statusToSave,
          remarks
        }
      });
    }

    return {
      ...savedRecord,
      staffName: staff.name,
      staffCode: staff.staffCode,
      workDuration: classificationResult.workDuration,
      durationMinutes: classificationResult.durationMinutes,
      classification: classificationResult.classification
    };
  }

  /**
   * Returns paginated attendance history records across multiple dates,
   * filterable by staffId and/or a date range.
   */
  async getAttendanceHistory(params: {
    staffId?: string;
    fromDate?: string;
    toDate?: string;
    search?: string;
    page?: number;
    limit?: number;
  }) {
    if (!this.attendanceModel)
      return { records: [], total: 0, summary: { present: 0, absent: 0, halfDay: 0, onLeave: 0 }, page: 1, limit: 10 };

    const where: any = {};

    if (params.staffId && params.staffId !== 'ALL') {
      where.staffId = params.staffId;
    }

    if (params.search && params.search.trim()) {
      const s = params.search.trim();
      where.OR = [
        { staff: { is: { name: { contains: s, mode: 'insensitive' } } } },
        { staff: { is: { staffCode: { contains: s, mode: 'insensitive' } } } },
        { staff: { is: { role: { contains: s, mode: 'insensitive' } } } },
        { status: { contains: s, mode: 'insensitive' } },
        { remarks: { contains: s, mode: 'insensitive' } },
        { dateStr: { contains: s } },
      ];
    }

    if (params.fromDate || params.toDate) {
      where.dateStr = {};
      if (params.fromDate) where.dateStr.gte = params.fromDate;
      if (params.toDate) where.dateStr.lte = params.toDate;
    }

    const page = Math.max(1, params.page || 1);
    const limit = Math.max(1, Math.min(200, params.limit || 25));
    const skip = (page - 1) * limit;

    const [rawRecords, total, statusRows] = await Promise.all([
      this.attendanceModel.findMany({
        where,
        include: { staff: { select: { id: true, staffCode: true, name: true, role: true, phone: true } } },
        orderBy: [{ dateStr: 'desc' }, { createdAt: 'desc' }],
        skip,
        take: limit,
      }),
      this.attendanceModel.count({ where }),
      this.attendanceModel.findMany({ where, select: { status: true } }),
    ]);

    const summary = { present: 0, absent: 0, halfDay: 0, onLeave: 0 };
    for (const row of (statusRows as any[]) || []) {
      const s = row.status || 'Not Marked';
      if (s === 'Present') summary.present++;
      else if (s === 'Absent') summary.absent++;
      else if (s === 'Half Day') summary.halfDay++;
      else if (s === 'On Leave') summary.onLeave++;
    }

    const records = rawRecords.map((r: any) => ({
      id: r.id,
      staffId: r.staffId,
      staffCode: r.staff?.staffCode || '',
      staffName: r.staff?.name || '',
      staffRole: r.staff?.role || '',
      phone: r.staff?.phone || '',
      dateStr: r.dateStr,
      checkInTime: r.checkInTime || '--:--',
      checkOutTime: r.checkOutTime || '--:--',
      status: r.status || 'Not Marked',
      remarks: r.remarks || '',
    }));

    return { records, total, summary, page, limit, totalPages: Math.ceil(total / limit) || 1 };
  }
}

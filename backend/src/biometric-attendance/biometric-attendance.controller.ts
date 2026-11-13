import { Controller, Get, Param, Query } from '@nestjs/common';
import { BiometricAttendanceService } from './biometric-attendance.service';

const numberOrUndefined = (value?: string) => (value === undefined || value === '' ? undefined : Number(value));
const booleanOrUndefined = (value?: string) => {
  if (value === undefined || value === '') return undefined;
  return value === 'true' || value === '1';
};

@Controller('biometric-attendance')
export class BiometricAttendanceController {
  constructor(private readonly biometric: BiometricAttendanceService) {}

  @Get('health')
  health() {
    return this.biometric.getHealth();
  }

  @Get('dashboard')
  dashboard() {
    return this.biometric.getDashboard();
  }

  @Get('punch-logs')
  punchLogs(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('date') date?: string,
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string,
    @Query('direction') direction?: string,
  ) {
    return this.biometric.getPunchLogs({
      page: numberOrUndefined(page),
      limit: numberOrUndefined(limit),
      search,
      date,
      fromDate,
      toDate,
      direction,
    });
  }

  @Get('currently-inside')
  currentlyInside(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
  ) {
    return this.biometric.getCurrentlyInside({
      page: numberOrUndefined(page),
      limit: numberOrUndefined(limit),
      search,
    });
  }

  @Get('currently-outside')
  currentlyOutside(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('minHours') minHours?: string,
  ) {
    return this.biometric.getCurrentlyOutside({
      page: numberOrUndefined(page),
      limit: numberOrUndefined(limit),
      search,
      minHours: numberOrUndefined(minHours),
    });
  }

  @Get('daily')
  daily(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('date') date?: string,
    @Query('status') status?: string,
  ) {
    return this.biometric.getDailyAttendance({
      page: numberOrUndefined(page),
      limit: numberOrUndefined(limit),
      search,
      date,
      status,
    });
  }

  @Get('absentees')
  absentees(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('date') date?: string,
  ) {
    return this.biometric.getAbsentees({
      page: numberOrUndefined(page),
      limit: numberOrUndefined(limit),
      search,
      date,
    });
  }

  @Get('curfew/frequent')
  frequentCurfew(
    @Query('days') days?: string,
    @Query('minCount') minCount?: string,
    @Query('curfewTime') curfewTime?: string,
    @Query('search') search?: string,
  ) {
    return this.biometric.getFrequentCurfew({
      days: numberOrUndefined(days),
      minCount: numberOrUndefined(minCount),
      curfewTime,
      search,
    });
  }

  @Get('curfew')
  curfew(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('date') date?: string,
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string,
    @Query('curfewTime') curfewTime?: string,
  ) {
    return this.biometric.getCurfew({
      page: numberOrUndefined(page),
      limit: numberOrUndefined(limit),
      search,
      date,
      fromDate,
      toDate,
      curfewTime,
    });
  }

  @Get('room-wise')
  roomWise(
    @Query('search') search?: string,
    @Query('date') date?: string,
    @Query('floor') floor?: string,
  ) {
    return this.biometric.getRoomWise({ search, date, floor });
  }

  @Get('monthly')
  monthly(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('month') month?: string,
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string,
    @Query('lowOnly') lowOnly?: string,
    @Query('lowThreshold') lowThreshold?: string,
  ) {
    return this.biometric.getMonthly({
      page: numberOrUndefined(page),
      limit: numberOrUndefined(limit),
      search,
      month,
      fromDate,
      toDate,
      lowOnly: booleanOrUndefined(lowOnly),
      lowThreshold: numberOrUndefined(lowThreshold),
    });
  }

  @Get('students')
  students(@Query('search') search?: string, @Query('limit') limit?: string) {
    return this.biometric.searchStudents({ search, limit: numberOrUndefined(limit) });
  }

  @Get('students/:identifier/punches')
  studentPunches(
    @Param('identifier') identifier: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string,
    @Query('direction') direction?: string,
  ) {
    return this.biometric.getStudentPunches(identifier, {
      page: numberOrUndefined(page),
      limit: numberOrUndefined(limit),
      fromDate,
      toDate,
      direction,
    });
  }

  @Get('devices')
  devices() {
    return this.biometric.getDevices();
  }
}

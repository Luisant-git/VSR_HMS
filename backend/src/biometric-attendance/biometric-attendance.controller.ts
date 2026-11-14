import { Controller, Get, Query } from '@nestjs/common';
import { BiometricAttendanceService } from './biometric-attendance.service';

const numberOrUndefined = (value?: string) => (value === undefined || value === '' ? undefined : Number(value));

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

  @Get('currently-outside')
  currentlyOutside(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('minHours') minHours?: string,
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string,
  ) {
    return this.biometric.getCurrentlyOutside({
      page: numberOrUndefined(page),
      limit: numberOrUndefined(limit),
      search,
      minHours: numberOrUndefined(minHours),
      fromDate,
      toDate,
    });
  }

  @Get('daily')
  daily(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('date') date?: string,
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string,
    @Query('status') status?: string,
  ) {
    return this.biometric.getDailyAttendance({
      page: numberOrUndefined(page),
      limit: numberOrUndefined(limit),
      search,
      date,
      fromDate,
      toDate,
      status,
    });
  }

  @Get('devices')
  devices() {
    return this.biometric.getDevices();
  }
}

import { Controller, Get, Post, Body, Param, Query } from '@nestjs/common';
import { MessAttendanceService } from './mess-attendance.service';

@Controller('mess-attendance')
export class MessAttendanceController {
  constructor(private readonly messAttendanceService: MessAttendanceService) {}

  @Get('reports')
  getAllTodayAttendance(@Query('date') date?: string) {
    return this.messAttendanceService.getAllTodayAttendance(date);
  }

  @Get(':studentId/today')
  getTodayAttendance(@Param('studentId') studentId: string) {
    return this.messAttendanceService.getTodayAttendance(studentId);
  }

  @Post(':studentId')
  markAttendance(
    @Param('studentId') studentId: string, 
    @Body() body: { mealType: string }
  ) {
    return this.messAttendanceService.markAttendance(studentId, body.mealType);
  }
}

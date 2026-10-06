import { Controller, Get, Post, Body, Query } from '@nestjs/common';
import { GateLogsService } from './gate-logs.service';
import { CreateGateLogDto } from './dto/create-gate-log.dto';

@Controller('gate-logs')
export class GateLogsController {
  constructor(private readonly gateLogsService: GateLogsService) {}

  @Post()
  create(@Body() createGateLogDto: CreateGateLogDto) {
    return this.gateLogsService.create(createGateLogDto);
  }

  @Get()
  findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string,
    @Query('status') status?: string
  ) {
    return this.gateLogsService.findAll({
      page: page ? parseInt(page) : 1,
      limit: limit ? parseInt(limit) : 10,
      search: search || '',
      fromDate,
      toDate,
      status
    });
  }

  @Get('missing')
  findMissingOrLate(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string
  ) {
    return this.gateLogsService.findMissingOrLate(
      page ? Number(page) : undefined,
      limit ? Number(limit) : undefined,
      search,
      fromDate,
      toDate
    );
  }
}

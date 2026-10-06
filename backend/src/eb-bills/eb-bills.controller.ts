import { Controller, Get, Post, Body, Param, Query } from '@nestjs/common';
import { EbBillsService } from './eb-bills.service';
import { CreateEbBillDto } from './dto/create-eb-bill.dto';

@Controller('eb-bills')
export class EbBillsController {
  constructor(private readonly ebBillsService: EbBillsService) {}

  @Post()
  create(@Body() createEbBillDto: CreateEbBillDto) {
    return this.ebBillsService.create(createEbBillDto);
  }

  @Get()
  findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string,
  ) {
    return this.ebBillsService.findAll(
      page ? parseInt(page) : 1, 
      limit ? parseInt(limit) : 10, 
      search, 
      fromDate,
      toDate
    );
  }

  @Get('room/:roomNo')
  findByRoom(@Param('roomNo') roomNo: string) {
    return this.ebBillsService.findByRoom(roomNo);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.ebBillsService.findOne(id);
  }
}

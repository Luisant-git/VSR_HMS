import { Controller, Get, Post, Body, Param, Query, Patch, Delete } from '@nestjs/common';
import { EbBillsService } from './eb-bills.service';
import { CreateEbBillDto } from './dto/create-eb-bill.dto';
import { UpdateEbBillDto } from './dto/update-eb-bill.dto';

@Controller('eb-bills')
export class EbBillsController {
  constructor(private readonly ebBillsService: EbBillsService) { }

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
    @Query('billingCycle') billingCycle?: string,
  ) {
    return this.ebBillsService.findAll(
      page ? parseInt(page) : 1,
      limit ? parseInt(limit) : 10,
      search,
      fromDate,
      toDate,
      billingCycle,
    );
  }

  @Get('cycles')
  findBillingCycles() {
    return this.ebBillsService.findBillingCycles();
  }

  @Get('room/:roomNo')
  findByRoom(@Param('roomNo') roomNo: string) {
    return this.ebBillsService.findByRoom(roomNo);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.ebBillsService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateEbBillDto: UpdateEbBillDto) {
    return this.ebBillsService.update(id, updateEbBillDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.ebBillsService.remove(id);
  }
}

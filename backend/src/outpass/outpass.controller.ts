import { Controller, Get, Post, Body, Patch, Param, Delete, Query } from '@nestjs/common';
import { OutpassService } from './outpass.service';
import { CreateOutpassDto } from './dto/create-outpass.dto';
import { UpdateOutpassDto } from './dto/update-outpass.dto';

@Controller('outpass')
export class OutpassController {
  constructor(private readonly outpassService: OutpassService) {}

  @Post()
  create(@Body() createOutpassDto: CreateOutpassDto) {
    return this.outpassService.create(createOutpassDto);
  }

  @Get()
  findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string
  ) {
    return this.outpassService.findAll(
      page ? Number(page) : undefined,
      limit ? Number(limit) : undefined,
      search,
      fromDate,
      toDate
    );
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.outpassService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateOutpassDto: UpdateOutpassDto) {
    return this.outpassService.update(id, updateOutpassDto);
  }

  @Patch(':id/status')
  updateStatus(@Param('id') id: string, @Body() data: { status: string, gateAction: string }) {
    return this.outpassService.updateStatus(id, data.status, data.gateAction);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.outpassService.remove(id);
  }
}

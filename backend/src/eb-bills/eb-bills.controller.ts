import { Controller, Get, Post, Body, Param } from '@nestjs/common';
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
  findAll() {
    return this.ebBillsService.findAll();
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

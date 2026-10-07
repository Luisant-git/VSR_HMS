import { Controller, Get, Post, Body } from '@nestjs/common';
import { MessDeductionService } from './mess-deduction.service';
import { UpdateMessDeductionDto } from './dto/update-mess-deduction.dto';

@Controller('mess-deduction')
export class MessDeductionController {
  constructor(private readonly messDeductionService: MessDeductionService) {}

  @Get()
  getSettings() {
    return this.messDeductionService.getSettings();
  }

  @Post()
  updateSettings(@Body() dto: UpdateMessDeductionDto) {
    return this.messDeductionService.updateSettings(dto);
  }
}

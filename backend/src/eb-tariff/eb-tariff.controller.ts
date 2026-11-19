import { Body, Controller, Get, Post } from '@nestjs/common';
import { EbTariffService } from './eb-tariff.service';
import { UpdateEbTariffDto } from './dto/update-eb-tariff.dto';

@Controller('eb-tariff')
export class EbTariffController {
  constructor(private readonly ebTariffService: EbTariffService) {}

  @Get()
  getSettings() {
    return this.ebTariffService.getSettings();
  }

  @Post()
  updateSettings(@Body() dto: UpdateEbTariffDto) {
    return this.ebTariffService.updateSettings(dto);
  }
}

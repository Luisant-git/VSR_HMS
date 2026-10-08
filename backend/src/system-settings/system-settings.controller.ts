import { Controller, Get, Post, Body } from '@nestjs/common';
import { SystemSettingsService } from './system-settings.service';

@Controller('system-settings')
export class SystemSettingsController {
  constructor(private readonly systemSettingsService: SystemSettingsService) {}

  @Get()
  getSettings() {
    return this.systemSettingsService.getSettings();
  }

  @Post()
  updateSettings(@Body() body: any) {
    return this.systemSettingsService.updateSettings(body);
  }
}

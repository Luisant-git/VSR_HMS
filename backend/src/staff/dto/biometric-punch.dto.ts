import { IsOptional, IsString } from 'class-validator';

export class BiometricPunchDto {
  @IsOptional()
  @IsString()
  staffId?: string;

  @IsOptional()
  @IsString()
  staffCode?: string;

  @IsOptional()
  @IsString()
  dateStr?: string;

  @IsOptional()
  @IsString()
  timeStr?: string;

  @IsOptional()
  @IsString()
  timestamp?: string;

  @IsOptional()
  @IsString()
  type?: 'IN' | 'OUT' | 'AUTO';

  @IsOptional()
  @IsString()
  deviceId?: string;
}

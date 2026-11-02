import { IsString, IsNumber, IsBoolean, IsOptional, Min } from 'class-validator';

export class CreateEbBillDto {
  @IsString()
  roomNo: string;

  @IsString()
  billingCycle: string;

  // Dual-meter support
  @IsBoolean()
  @IsOptional()
  hasAcMeter?: boolean;

  @IsNumber()
  @IsOptional()
  @Min(0)
  acPrevReading?: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  acCurrReading?: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  normalPrevReading?: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  normalCurrReading?: number;

  @IsNumber()
  @Min(0)
  tariffRate: number;

  // Legacy single-meter fields (kept for backward compatibility)
  @IsNumber()
  @IsOptional()
  @Min(0)
  prevReading?: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  currReading?: number;
}

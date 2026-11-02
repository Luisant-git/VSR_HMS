import { IsString, IsNumber, IsBoolean, IsOptional, Min } from 'class-validator';

export class UpdateEbBillDto {
  @IsString()
  @IsOptional()
  billingCycle?: string;

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
  @IsOptional()
  @Min(0)
  prevReading?: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  currReading?: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  tariffRate?: number;
}

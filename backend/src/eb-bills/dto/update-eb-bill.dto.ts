import { IsString, IsNumber, IsOptional, IsBoolean, Min } from 'class-validator';

export class UpdateEbBillDto {
  @IsString()
  @IsOptional()
  billingCycle?: string;

  // Normal meter
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

  // AC meter
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
  acTariffRate?: number;

  // Pass false to remove AC meter data from an existing bill
  @IsBoolean()
  @IsOptional()
  hasAcMeter?: boolean;
}

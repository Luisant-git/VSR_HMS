import { IsString, IsNumber, IsOptional, Min } from 'class-validator';

export class CreateEbBillDto {
  @IsString()
  roomNo: string;

  @IsString()
  billingCycle: string;

  // Normal meter
  @IsNumber()
  @Min(0)
  prevReading: number;

  @IsNumber()
  @Min(0)
  currReading: number;

  @IsNumber()
  @Min(0)
  tariffRate: number;

  // AC meter (optional — omit entirely for single-meter rooms)
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
}

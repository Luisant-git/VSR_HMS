import { IsString, IsNumber, IsOptional, Min } from 'class-validator';

export class UpdateEbBillDto {
  @IsString()
  @IsOptional()
  billingCycle?: string;

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

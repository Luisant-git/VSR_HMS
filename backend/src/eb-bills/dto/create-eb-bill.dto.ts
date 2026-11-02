import { IsString, IsNumber, Min } from 'class-validator';

export class CreateEbBillDto {
  @IsString()
  roomNo: string;

  @IsString()
  billingCycle: string;

  @IsNumber()
  @Min(0)
  prevReading: number;

  @IsNumber()
  @Min(0)
  currReading: number;

  @IsNumber()
  @Min(0)
  tariffRate: number;
}

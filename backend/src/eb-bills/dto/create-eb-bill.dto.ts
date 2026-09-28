import { IsString, IsNumber } from 'class-validator';

export class CreateEbBillDto {
  @IsString()
  roomNo: string;

  @IsString()
  billingCycle: string;

  @IsNumber()
  prevReading: number;

  @IsNumber()
  currReading: number;

  @IsNumber()
  tariffRate: number;
}

import { IsNumber, Min } from 'class-validator';

export class UpdateEbTariffDto {
  @IsNumber()
  @Min(0)
  rate: number;
}

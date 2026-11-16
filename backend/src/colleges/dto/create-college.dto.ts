import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateCollegeDto {
  @ApiProperty({ description: 'Full name of the college' })
  name: string;

  @ApiPropertyOptional({ description: 'Short name or abbreviation of the college' })
  shortName?: string;

  @ApiPropertyOptional({ description: 'Address of the college' })
  address?: string;

  @ApiPropertyOptional({ description: 'Full date (YYYY-MM-DD)' })
  dueDate?: string;

  @ApiPropertyOptional({ description: 'Billing cycle: PREPAID or POSTPAID', default: 'PREPAID', enum: ['PREPAID', 'POSTPAID'] })
  billingCycle?: 'PREPAID' | 'POSTPAID';

  @ApiProperty({ description: 'Fine amount per day for late fee payment', default: 50.0 })
  finePerDay?: number;
}

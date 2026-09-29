import { PartialType } from '@nestjs/swagger';
import { CreateCollegeDto } from './create-college.dto';

export class UpdateCollegeDto extends PartialType(CreateCollegeDto) {}

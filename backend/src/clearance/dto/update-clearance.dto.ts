import { PartialType } from '@nestjs/swagger';
import { CreateClearanceDto } from './create-clearance.dto';

export class UpdateClearanceDto extends PartialType(CreateClearanceDto) {}

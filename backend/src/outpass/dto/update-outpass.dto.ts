import { PartialType } from '@nestjs/swagger';
import { CreateOutpassDto } from './create-outpass.dto';

export class UpdateOutpassDto extends PartialType(CreateOutpassDto) {}

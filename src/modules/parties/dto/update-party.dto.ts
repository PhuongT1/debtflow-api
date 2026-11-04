import { PartialType } from '@nestjs/swagger';
import { CreatePartyDto } from './create-party.dto.js';

export class UpdatePartyDto extends PartialType(CreatePartyDto) {}

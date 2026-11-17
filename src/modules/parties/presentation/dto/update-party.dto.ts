import type { UpdatePartyInput } from '../../application/party.inputs.js';
import { PartialType } from '@nestjs/swagger';
import { CreatePartyDto } from './create-party.dto.js';

export class UpdatePartyDto extends PartialType(CreatePartyDto) implements UpdatePartyInput {}

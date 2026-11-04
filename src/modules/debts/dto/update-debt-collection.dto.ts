import { PickType } from '@nestjs/swagger';
import { IsEnum, ValidateIf } from 'class-validator';
import { CollectionStatus } from '#generated/prisma/client.js';
import { CreateDebtDto } from './create-debt.dto.js';

export class UpdateDebtCollectionDto extends PickType(CreateDebtDto, [
  'assignedToId',
  'nextFollowUpAt',
  'followUpNote',
  'invoiceNo',
  'orderNo',
  'contractNo',
  'poNo',
  'description',
] as const) {
  @ValidateIf((_object, value) => value !== undefined)
  @IsEnum(CollectionStatus)
  collectionStatus?: CollectionStatus;
}

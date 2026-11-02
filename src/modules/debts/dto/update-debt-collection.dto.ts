import { PickType } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { CollectionStatus } from '@generated/prisma';
import { CreateDebtDto } from './create-debt.dto';

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
  @IsOptional()
  @IsEnum(CollectionStatus)
  collectionStatus?: CollectionStatus;
}

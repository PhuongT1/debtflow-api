import { ApiProperty } from '@nestjs/swagger';
import type { Prisma } from '@generated/prisma';
import { UserSummaryDto } from '@modules/users/public/users';

export class AuditLogResponseDto {
  id!: string;
  organizationId!: string;
  actorId!: string | null;
  entityType!: string;
  entityId!: string;
  action!: string;
  @ApiProperty({ type: Object, nullable: true, additionalProperties: true })
  before!: Prisma.JsonValue;
  @ApiProperty({ type: Object, nullable: true, additionalProperties: true })
  after!: Prisma.JsonValue;
  createdAt!: Date;
  actor!: UserSummaryDto | null;
}

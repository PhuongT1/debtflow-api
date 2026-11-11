import type { AuditEntry } from '@common/events/audit-event.js';
import { applyListQuery, type ListQueryResult } from '@common/query/index.js';
import { getPagination, paginate } from '@common/utils/pagination.util.js';
import { PrismaService } from '@database/prisma.service.js';
import { Prisma } from '@generated/prisma/client.js';
import { Injectable } from '@nestjs/common';
import { QueryAuditLogsDto } from '../dto/query-audit-logs.dto.js';
import { AuditLogsRepository } from '../repositories/audit-logs.repository.js';

@Injectable()
export class PrismaAuditLogsRepository extends AuditLogsRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async list(organizationId: string, query: QueryAuditLogsDto, listQuery?: ListQueryResult) {
    const pagination = getPagination(query);
    const baseWhere: Prisma.AuditLogWhereInput = {
      organizationId,
      actorId: query.actorId,
      entityType: query.entityType,
      entityId: query.entityId,
      action: query.action,
    };
    const { where, orderBy } = applyListQuery<
      Prisma.AuditLogWhereInput,
      Prisma.AuditLogOrderByWithRelationInput[]
    >(listQuery, { where: baseWhere, orderBy: [{ createdAt: 'desc' }] });
    const [items, total] = await this.prisma.$transaction([
      this.prisma.auditLog.findMany({
        where,
        orderBy,
        skip: pagination.skip,
        take: pagination.take,
        include: { actor: { select: { id: true, name: true, email: true } } },
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return paginate(items, total, pagination);
  }

  async record(entry: AuditEntry) {
    await this.prisma.auditLog.create({
      data: {
        organizationId: entry.organizationId,
        actorId: entry.actorId ?? null,
        entityType: entry.entityType,
        entityId: entry.entityId,
        action: entry.action,
        before: (entry.before ?? undefined) as Prisma.InputJsonValue | undefined,
        after: (entry.after ?? undefined) as Prisma.InputJsonValue | undefined,
      },
    });
  }
}

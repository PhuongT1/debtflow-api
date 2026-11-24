import type { AuditEntry } from '@common/events/audit-event.js';
import { applyListQuery, compileListQuery } from '@common/query/list-query-builder.js';
import type { ListQueryOptions } from '@common/query/list-query-options.types.js';
import { getPagination, paginate } from '@common/utils/pagination.util.js';
import { PrismaService } from '@database/prisma.service.js';
import { Prisma } from '@generated/prisma/client.js';
import { Injectable } from '@nestjs/common';
import type { AuditLogListInput } from '../application/audit-log-read.types.js';
import { AUDIT_LOG_LIST_QUERY } from '../audit-logs.list-query.js';
import { AuditLogsRepository } from '../application/repositories/audit-logs.repository.js';

@Injectable()
export class PrismaAuditLogsRepository extends AuditLogsRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async list(organizationId: string, query: AuditLogListInput, options?: ListQueryOptions) {
    const pagination = getPagination(query);
    const baseWhere: Prisma.AuditLogWhereInput = {
      organizationId,
      actorId: query.actorId,
      entityType: query.entityType,
      entityId: query.entityId,
      action: query.action,
    };
    const listQuery = options ? compileListQuery(options, AUDIT_LOG_LIST_QUERY) : undefined;
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
        select: {
          id: true,
          organizationId: true,
          actorId: true,
          entityType: true,
          entityId: true,
          action: true,
          before: true,
          after: true,
          createdAt: true,
          actor: { select: { id: true, name: true, email: true } },
        },
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

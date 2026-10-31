import { Injectable } from '@nestjs/common';
import { applyListQuery, type ListQueryResult } from '@common/query';
import { PrismaService } from '@database/prisma.service';
import { Prisma } from '@generated/prisma';
import { getPagination, paginate } from '@common/utils/pagination.util';
import { QueryAuditLogsDto } from './dto/query-audit-logs.dto';

@Injectable()
export class AuditLogsService {
  constructor(private readonly prisma: PrismaService) {}

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
}

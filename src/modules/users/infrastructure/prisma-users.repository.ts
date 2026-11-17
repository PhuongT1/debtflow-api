import type { ListQueryResult } from '@common/query/index.js';
import { getPagination, paginate } from '@common/utils/pagination.util.js';
import { PrismaService } from '@database/prisma.service.js';
import {
  OrganizationMembershipStatus,
  OrganizationStatus,
  UserStatus,
} from '@generated/prisma/client.js';
import { Injectable } from '@nestjs/common';
import type { CreateUserDto } from '../dto/create-user.dto.js';
import type { QueryUsersDto } from '../dto/query-users.dto.js';
import type { UpdateUserDto } from '../dto/update-user.dto.js';
import { MEMBER_INCLUDE } from '../queries/member.select.js';
import { buildUsersQuery } from '../queries/users.query.js';

import { UsersRepository } from '../repositories/users.repository.js';

@Injectable()
export class PrismaUsersRepository extends UsersRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }
  async list(organizationId: string, query: QueryUsersDto, listQuery?: ListQueryResult) {
    const pagination = getPagination(query);
    const { where, orderBy } = buildUsersQuery(organizationId, query, listQuery);
    const [items, total] = await this.prisma.$transaction([
      this.prisma.organizationMembership.findMany({
        where,
        orderBy,
        skip: pagination.skip,
        take: pagination.take,
        include: MEMBER_INCLUDE,
      }),
      this.prisma.organizationMembership.count({ where }),
    ]);

    return paginate(items, total, pagination);
  }

  async options(organizationId: string) {
    const items = await this.prisma.organizationMembership.findMany({
      where: {
        organizationId,
        status: OrganizationMembershipStatus.ACTIVE,
        user: { status: UserStatus.ACTIVE },
      },
      orderBy: { user: { name: 'asc' } },
      select: {
        user: { select: { id: true, name: true, email: true, status: true } },
        role: true,
      },
    });

    return items.map(({ user, role }) => ({ ...user, role }));
  }

  findMembership(organizationId: string, userId: string) {
    return this.prisma.organizationMembership.findFirst({
      where: { organizationId, userId },
      include: MEMBER_INCLUDE,
    });
  }
  countMemberships(userId: string) {
    return this.prisma.organizationMembership.count({ where: { userId } });
  }
  async isActive(organizationId: string, userId: string) {
    return Boolean(
      await this.prisma.organizationMembership.findFirst({
        where: {
          organizationId,
          userId,
          status: OrganizationMembershipStatus.ACTIVE,
          user: { status: UserStatus.ACTIVE },
          organization: { status: OrganizationStatus.ACTIVE },
        },
        select: { id: true },
      }),
    );
  }
  create(organizationId: string, body: CreateUserDto, passwordHash: string) {
    return this.prisma.organizationMembership.create({
      data: {
        organization: { connect: { id: organizationId } },
        role: body.role,
        status: OrganizationMembershipStatus.ACTIVE,
        joinedAt: new Date(),
        user: {
          create: {
            name: body.name,
            email: body.email.toLowerCase(),
            phone: body.phone ?? null,
            passwordHash,
          },
        },
      },
      include: MEMBER_INCLUDE,
    });
  }
  update(organizationId: string, id: string, body: UpdateUserDto, editsProfile: boolean) {
    return this.prisma.organizationMembership.update({
      where: { id, organizationId },
      data: {
        ...(body.role ? { role: body.role } : {}),
        ...(editsProfile
          ? {
              user: {
                update: {
                  ...(body.name !== undefined ? { name: body.name } : {}),
                  ...(body.phone !== undefined ? { phone: body.phone } : {}),
                },
              },
            }
          : {}),
      },
      include: MEMBER_INCLUDE,
    });
  }
  suspend(organizationId: string, id: string) {
    return this.prisma.organizationMembership.update({
      where: { id, organizationId },
      data: { status: OrganizationMembershipStatus.SUSPENDED },
      include: MEMBER_INCLUDE,
    });
  }
  reactivate(organizationId: string, id: string, joinedAt: Date) {
    return this.prisma.organizationMembership.update({
      where: { id, organizationId },
      data: { status: OrganizationMembershipStatus.ACTIVE, joinedAt },
      include: MEMBER_INCLUDE,
    });
  }
}

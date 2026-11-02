import { buildUsersQuery } from '../queries/users.query';
import { MEMBER_INCLUDE } from '../queries/member.select';
import { toMemberDto } from '../mappers/member.mapper';
import type { Actor } from '../types/member.types';
import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import * as bcrypt from 'bcryptjs';
import { notFound } from '@common/errors/app-errors';
import { AuditAction, emitAudit, scalarSnapshot } from '@common/events/audit-event';
import type { ListQueryResult } from '@common/query';
import { getPagination, paginate } from '@common/utils/pagination.util';
import { PrismaService } from '@database/prisma.service';
import { OrganizationMembershipStatus, UserStatus } from '@generated/prisma';
import type { CreateUserDto } from '../dto/create-user.dto';
import type { QueryUsersDto } from '../dto/query-users.dto';
import type { UpdateUserDto } from '../dto/update-user.dto';
import {
  assertCanChangeAccess,
  assertCanEditProfile,
  assertCanGrantRole,
  assertCanReactivate,
  assertCanSuspend,
} from '../rules/users.rules';

const PASSWORD_ROUNDS = 12;

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
  ) {}

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

    return paginate(items.map(toMemberDto), total, pagination);
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

  /** Creates a new account and its ACTIVE membership in the actor's organization. */
  async create(organizationId: string, body: CreateUserDto, actor: Actor) {
    assertCanGrantRole(actor, body.role);

    const passwordHash = await bcrypt.hash(body.password, PASSWORD_ROUNDS);
    const membership = await this.prisma.organizationMembership.create({
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
    const member = toMemberDto(membership);

    emitAudit(this.events, {
      organizationId,
      actorId: actor.userId,
      entityType: 'User',
      entityId: member.id,
      action: AuditAction.MemberCreated,
      after: { name: member.name, email: member.email, phone: member.phone, role: member.role },
    });

    return member;
  }

  async update(organizationId: string, id: string, body: UpdateUserDto, actor: Actor) {
    const membership = await this.findMembership(organizationId, id);

    assertCanChangeAccess(actor, { userId: id, role: membership.role }, { role: body.role });

    const editsProfile = body.name !== undefined || body.phone !== undefined;

    if (editsProfile) {
      const membershipCount = await this.prisma.organizationMembership.count({
        where: { userId: id },
      });
      assertCanEditProfile(actor, id, membershipCount);
    }

    const before = toMemberDto(membership);
    const updated = await this.prisma.organizationMembership.update({
      where: { id: membership.id },
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
    const member = toMemberDto(updated);

    emitAudit(this.events, {
      organizationId,
      actorId: actor.userId,
      entityType: 'User',
      entityId: id,
      action: AuditAction.MemberUpdated,
      before: scalarSnapshot({
        name: before.name,
        phone: before.phone,
        role: before.role,
      }),
      after: scalarSnapshot({ name: member.name, phone: member.phone, role: member.role }),
    });

    return member;
  }

  /** Suspends the membership in this organization. The account itself is untouched. */
  async deactivate(organizationId: string, id: string, actor: Actor) {
    const membership = await this.findMembership(organizationId, id);

    assertCanChangeAccess(actor, { userId: id, role: membership.role }, { suspend: true });
    assertCanSuspend(membership.status);

    const suspended = await this.prisma.organizationMembership.update({
      where: { id: membership.id },
      data: { status: OrganizationMembershipStatus.SUSPENDED },
      include: MEMBER_INCLUDE,
    });

    emitAudit(this.events, {
      organizationId,
      actorId: actor.userId,
      entityType: 'User',
      entityId: id,
      action: AuditAction.MemberSuspended,
      before: { membershipStatus: membership.status },
      after: { membershipStatus: suspended.status },
    });

    return toMemberDto(suspended);
  }

  async reactivate(organizationId: string, id: string, actor: Actor) {
    const membership = await this.findMembership(organizationId, id);

    assertCanChangeAccess(actor, { userId: id, role: membership.role }, {});
    assertCanReactivate(membership.status);

    const active = await this.prisma.organizationMembership.update({
      where: { id: membership.id },
      data: {
        status: OrganizationMembershipStatus.ACTIVE,
        joinedAt: membership.joinedAt ?? new Date(),
      },
      include: MEMBER_INCLUDE,
    });

    emitAudit(this.events, {
      organizationId,
      actorId: actor.userId,
      entityType: 'User',
      entityId: id,
      action: AuditAction.MemberReactivated,
      before: { membershipStatus: membership.status },
      after: { membershipStatus: active.status },
    });

    return toMemberDto(active);
  }

  private async findMembership(organizationId: string, userId: string) {
    const membership = await this.prisma.organizationMembership.findFirst({
      where: { organizationId, userId },
      include: MEMBER_INCLUDE,
    });

    if (!membership) throw notFound('users.MEMBER_NOT_FOUND');

    return membership;
  }
}

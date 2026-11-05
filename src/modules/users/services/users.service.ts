import { requireOrganizationId } from '@common/validation/require-organization-id.js';
import { toMemberDto } from '../member.mapper.js';
import type { Actor } from '../member.types.js';
import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import * as bcrypt from 'bcryptjs';
import { notFound } from '@common/errors/app-errors.js';
import { AuditAction, emitAudit, scalarSnapshot } from '@common/events/audit-event.js';
import type { ListQueryResult } from '@common/query/index.js';
import { UsersRepository } from '../repositories/users.repository.js';
import type { CreateUserDto } from '../dto/create-user.dto.js';
import type { QueryUsersDto } from '../dto/query-users.dto.js';
import type { UpdateUserDto } from '../dto/update-user.dto.js';
import {
  assertCanChangeAccess,
  assertCanEditProfile,
  assertCanGrantRole,
  assertCanReactivate,
  assertCanSuspend,
} from '../users.rules.js';

const PASSWORD_ROUNDS = 12;

@Injectable()
export class UsersService {
  constructor(
    private readonly repository: UsersRepository,
    private readonly events: EventEmitter2,
  ) {}

  async list(organizationId: string, query: QueryUsersDto, listQuery?: ListQueryResult) {
    requireOrganizationId(organizationId);
    const page = await this.repository.list(organizationId, query, listQuery);
    return { ...page, items: page.items.map(toMemberDto) };
  }
  options(organizationId: string) {
    requireOrganizationId(organizationId);
    return this.repository.options(organizationId);
  }

  /** Creates a new account and its ACTIVE membership in the actor's organization. */
  async create(organizationId: string, body: CreateUserDto, actor: Actor) {
    requireOrganizationId(organizationId);
    assertCanGrantRole(actor, body.role);

    const passwordHash = await bcrypt.hash(body.password, PASSWORD_ROUNDS);
    const membership = await this.repository.create(organizationId, body, passwordHash);
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
    requireOrganizationId(organizationId);
    const membership = await this.findMembership(organizationId, id);

    assertCanChangeAccess(actor, { userId: id, role: membership.role }, { role: body.role });

    const editsProfile = body.name !== undefined || body.phone !== undefined;

    if (editsProfile) {
      const membershipCount = await this.repository.countMemberships(id);
      assertCanEditProfile(actor, id, membershipCount);
    }

    const before = toMemberDto(membership);
    const updated = await this.repository.update(organizationId, membership.id, body, editsProfile);
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
    requireOrganizationId(organizationId);
    const membership = await this.findMembership(organizationId, id);

    assertCanChangeAccess(actor, { userId: id, role: membership.role }, { suspend: true });
    assertCanSuspend(membership.status);

    const suspended = await this.repository.suspend(organizationId, membership.id);

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
    requireOrganizationId(organizationId);
    const membership = await this.findMembership(organizationId, id);

    assertCanChangeAccess(actor, { userId: id, role: membership.role }, {});
    assertCanReactivate(membership.status);

    const active = await this.repository.reactivate(
      organizationId,
      membership.id,
      membership.joinedAt ?? new Date(),
    );

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
    const membership = await this.repository.findMembership(organizationId, userId);

    if (!membership) throw notFound('users.MEMBER_NOT_FOUND');

    return membership;
  }
}

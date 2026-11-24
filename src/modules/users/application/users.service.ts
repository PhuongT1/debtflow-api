import { requireOrganizationId } from '@common/validation/require-organization-id.js';
import { toOrganizationMember } from './member.mapper.js';
import type { CreateMemberInput, MemberListInput, UpdateMemberInput } from './member.types.js';
import type { MemberIdentity } from '../domain/member-access.types.js';
import { ApplicationError } from '@common/errors/application-error.js';
import { AuditAction } from '@common/events/audit.types.js';
import type { PublishAudit } from '@common/events/audit-publisher.port.js';
import { scalarSnapshot } from '@common/events/audit-snapshot.js';
import type { ListQueryOptions } from '@common/query/list-query-options.types.js';
import type { UsersRepository } from './repositories/users.repository.js';
import {
  assertCanChangeAccess,
  assertCanEditProfile,
  assertCanGrantRole,
  assertCanReactivate,
  assertCanSuspend,
} from '../domain/users.rules.js';

export class UsersService {
  constructor(
    private readonly repository: UsersRepository,
    private readonly publishAudit: PublishAudit,
    private readonly hashPassword: (password: string) => Promise<string>,
  ) {}

  async list(organizationId: string, query: MemberListInput, listQuery?: ListQueryOptions) {
    requireOrganizationId(organizationId);
    const page = await this.repository.list(organizationId, query, listQuery);
    return { ...page, items: page.items.map(toOrganizationMember) };
  }
  options(organizationId: string) {
    requireOrganizationId(organizationId);
    return this.repository.options(organizationId);
  }

  /** Creates a new account and its ACTIVE membership in the actor's organization. */
  async create(organizationId: string, body: CreateMemberInput, actor: MemberIdentity) {
    requireOrganizationId(organizationId);
    assertCanGrantRole(actor, body.role);

    const passwordHash = await this.hashPassword(body.password);
    const membership = await this.repository.create(organizationId, body, passwordHash);
    const member = toOrganizationMember(membership);

    this.publishAudit({
      organizationId,
      actorId: actor.userId,
      entityType: 'User',
      entityId: member.id,
      action: AuditAction.MemberCreated,
      after: { name: member.name, email: member.email, phone: member.phone, role: member.role },
    });

    return member;
  }

  async update(organizationId: string, id: string, body: UpdateMemberInput, actor: MemberIdentity) {
    requireOrganizationId(organizationId);
    const membership = await this.findMembership(organizationId, id);

    assertCanChangeAccess(actor, { userId: id, role: membership.role }, { role: body.role });

    const editsProfile = body.name !== undefined || body.phone !== undefined;

    if (editsProfile) {
      const membershipCount = await this.repository.countMemberships(id);
      assertCanEditProfile(actor, id, membershipCount);
    }

    const before = toOrganizationMember(membership);
    const updated = await this.repository.update(organizationId, membership.id, body, editsProfile);
    const member = toOrganizationMember(updated);

    this.publishAudit({
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
  async deactivate(organizationId: string, id: string, actor: MemberIdentity) {
    requireOrganizationId(organizationId);
    const membership = await this.findMembership(organizationId, id);

    assertCanChangeAccess(actor, { userId: id, role: membership.role }, { suspend: true });
    assertCanSuspend(membership.status);

    const suspended = await this.repository.suspend(organizationId, membership.id);

    this.publishAudit({
      organizationId,
      actorId: actor.userId,
      entityType: 'User',
      entityId: id,
      action: AuditAction.MemberSuspended,
      before: { membershipStatus: membership.status },
      after: { membershipStatus: suspended.status },
    });

    return toOrganizationMember(suspended);
  }

  async reactivate(organizationId: string, id: string, actor: MemberIdentity) {
    requireOrganizationId(organizationId);
    const membership = await this.findMembership(organizationId, id);

    assertCanChangeAccess(actor, { userId: id, role: membership.role }, {});
    assertCanReactivate(membership.status);

    const active = await this.repository.reactivate(
      organizationId,
      membership.id,
      membership.joinedAt ?? new Date(),
    );

    this.publishAudit({
      organizationId,
      actorId: actor.userId,
      entityType: 'User',
      entityId: id,
      action: AuditAction.MemberReactivated,
      before: { membershipStatus: membership.status },
      after: { membershipStatus: active.status },
    });

    return toOrganizationMember(active);
  }

  private async findMembership(organizationId: string, userId: string) {
    const membership = await this.repository.findMembership(organizationId, userId);

    if (!membership) throw new ApplicationError('not-found', 'users.MEMBER_NOT_FOUND');

    return membership;
  }
}

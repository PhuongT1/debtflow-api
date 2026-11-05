import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { badRequest, notFound } from '@common/errors/app-errors.js';
import { requireOrganizationId } from '@common/validation/require-organization-id.js';
import { AuditAction, emitAudit, scalarSnapshot } from '@common/events/audit-event.js';
import type { ListQueryResult } from '@common/query/index.js';
import { OrganizationMembersService } from '@modules/users/public/users.js';
import { PartiesRepository } from './repositories/parties.repository.js';
import { CreatePartyDto } from './dto/create-party.dto.js';
import { QueryPartiesDto } from './dto/query-parties.dto.js';
import { UpdatePartyDto } from './dto/update-party.dto.js';
import { buildPartyCreateData, buildPartyUpdateData } from './party.mapper.js';

@Injectable()
export class PartiesService {
  constructor(
    private readonly repository: PartiesRepository,
    private readonly events: EventEmitter2,
    private readonly members: OrganizationMembersService,
  ) {}
  async list(organizationId: string, query: QueryPartiesDto, listQuery?: ListQueryResult) {
    requireOrganizationId(organizationId);
    return this.repository.list(organizationId, query, listQuery);
  }
  detail(organizationId: string, id: string) {
    requireOrganizationId(organizationId);
    return this.repository.detail(organizationId, id);
  }
  async assertActive(organizationId: string, id: string) {
    requireOrganizationId(organizationId);
    if (!(await this.repository.isActive(organizationId, id)))
      throw notFound('parties.PARTY_NOT_FOUND');
  }
  async create(organizationId: string, userId: string, input: CreatePartyDto) {
    requireOrganizationId(organizationId);
    const data = buildPartyCreateData(input);
    await this.assertAssignee(organizationId, data.assignedToId);

    const party = await this.repository.create(organizationId, userId, data);

    emitAudit(this.events, {
      organizationId,
      actorId: userId,
      entityType: 'Party',
      entityId: party.id,
      action: AuditAction.PartyCreated,
      after: scalarSnapshot(party),
    });

    return party;
  }

  async update(organizationId: string, id: string, input: UpdatePartyDto, actorId?: string) {
    const before = await this.detail(organizationId, id);
    const data = buildPartyUpdateData(input, before);
    if (data.assignedToId) await this.assertAssignee(organizationId, data.assignedToId);

    const party = await this.repository.update(organizationId, id, data);

    emitAudit(this.events, {
      organizationId,
      actorId,
      entityType: 'Party',
      entityId: id,
      action: AuditAction.PartyUpdated,
      before: scalarSnapshot(before),
      after: scalarSnapshot(party),
    });

    return party;
  }

  async deactivate(organizationId: string, id: string, actorId?: string) {
    const before = await this.detail(organizationId, id);
    const activeDebtCount = await this.repository.countActiveDebts(organizationId, id);

    if (activeDebtCount > 0) {
      throw badRequest('parties.CANNOT_DELETE_ACTIVE_DEBTS');
    }

    const party = await this.repository.deactivate(organizationId, id);

    emitAudit(this.events, {
      organizationId,
      actorId,
      entityType: 'Party',
      entityId: id,
      action: AuditAction.PartyDeactivated,
      before: scalarSnapshot(before),
      after: scalarSnapshot(party),
    });

    return party;
  }

  /** The assignee must be an active member of the same organization (never a user of another tenant). */
  private async assertAssignee(organizationId: string, userId?: string | null) {
    if (!userId) return;

    if (!(await this.members.isActive(organizationId, userId)))
      throw badRequest('parties.ASSIGNEE_NOT_FOUND');
  }
}

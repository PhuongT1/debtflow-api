/** Coordinates Party use cases through ports; independent of Nest, HTTP and Prisma. */
import { canDeactivateParty } from '../domain/party.rules.js';
import { ApplicationError } from '@common/errors/application-error.js';
import { AuditAction } from '@common/events/audit.types.js';
import type { ListQueryOptions } from '@common/query/list-query-options.types.js';
import type { PartiesRepository } from './repositories/parties.repository.js';
import type { PartyAudit, PartyMembers } from './party.ports.js';
import type { CreatePartyInput, UpdatePartyInput, PartyListInput } from './party.inputs.js';
import { buildPartyCreateData, buildPartyUpdateData } from './party-write.mapper.js';

export class PartiesService {
  constructor(
    private readonly repository: PartiesRepository,
    private readonly audit: PartyAudit,
    private readonly members: PartyMembers,
  ) {}
  async list(organizationId: string, query: PartyListInput, listQuery?: ListQueryOptions) {
    assertPartyOrganization(organizationId);
    return this.repository.list(organizationId, query, listQuery);
  }
  detail(organizationId: string, id: string) {
    assertPartyOrganization(organizationId);
    return this.repository.detail(organizationId, id);
  }
  async assertActive(organizationId: string, id: string) {
    assertPartyOrganization(organizationId);
    if (!(await this.repository.isActive(organizationId, id)))
      throw new ApplicationError('not-found', 'parties.PARTY_NOT_FOUND');
  }
  async create(organizationId: string, userId: string, input: CreatePartyInput) {
    assertPartyOrganization(organizationId);
    const data = buildPartyCreateData(input);
    await this.assertAssignee(organizationId, data.assignedToId);

    const party = await this.repository.create(organizationId, userId, data);

    this.audit.record({
      organizationId,
      actorId: userId,
      entityType: 'Party',
      entityId: party.id,
      action: AuditAction.PartyCreated,
      after: party,
    });

    return party;
  }

  async update(organizationId: string, id: string, input: UpdatePartyInput, actorId?: string) {
    assertPartyOrganization(organizationId);
    const { before, party } = await this.repository.inTransaction(async (store) => {
      const before = await store.findRecord(organizationId, id);
      const data = buildPartyUpdateData(input, before);
      if (data.assignedToId && !(await store.hasActiveMember(organizationId, data.assignedToId)))
        throw new ApplicationError('invalid', 'parties.ASSIGNEE_NOT_FOUND');
      const party = await store.update(organizationId, id, data);
      return { before, party };
    });

    this.audit.record({
      organizationId,
      actorId,
      entityType: 'Party',
      entityId: id,
      action: AuditAction.PartyUpdated,
      before,
      after: party,
    });

    return party;
  }

  async deactivate(organizationId: string, id: string, actorId?: string) {
    assertPartyOrganization(organizationId);
    const { before, party } = await this.repository.inTransaction(async (store) => {
      const before = await store.findRecord(organizationId, id);
      const activeDebtCount = await store.countActiveDebts(organizationId, id);
      if (!canDeactivateParty(activeDebtCount))
        throw new ApplicationError('invalid', 'parties.CANNOT_DELETE_ACTIVE_DEBTS');
      const party = await store.deactivate(organizationId, id);
      return { before, party };
    });

    this.audit.record({
      organizationId,
      actorId,
      entityType: 'Party',
      entityId: id,
      action: AuditAction.PartyDeactivated,
      before,
      after: party,
    });

    return party;
  }

  /** The assignee must be an active member of the same organization (never a user of another tenant). */
  private async assertAssignee(organizationId: string, userId?: string | null) {
    if (!userId) return;

    if (!(await this.members.isActive(organizationId, userId)))
      throw new ApplicationError('invalid', 'parties.ASSIGNEE_NOT_FOUND');
  }
}

/** Reject missing trusted tenant context before any repository operation. */
function assertPartyOrganization(organizationId: string): void {
  if (typeof organizationId !== 'string' || !organizationId.trim())
    throw new ApplicationError('forbidden', 'errors.FORBIDDEN');
}

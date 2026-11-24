/** Coordinates Party use cases through ports; independent of Nest, HTTP and Prisma. */
import { canDeactivateParty } from '../domain/party.rules.js';
import { ApplicationError } from '@common/errors/application-error.js';
import { AuditAction } from '@common/events/audit.types.js';
import type { ListQueryOptions } from '@common/query/list-query-options.types.js';
import type { PartiesRepository, PartyWriteStore } from './repositories/parties.repository.js';
import type { PartyAudit } from './party.ports.js';
import type { CreatePartyInput, UpdatePartyInput, PartyListInput } from './party.inputs.js';
import { buildPartyCreateData, buildPartyUpdateData } from './party-write.mapper.js';

export class PartiesService {
  constructor(
    private readonly repository: PartiesRepository,
    private readonly audit: PartyAudit,
  ) {}
  async list(organizationId: string, query: PartyListInput, listQuery?: ListQueryOptions) {
    assertPartyOrganization(organizationId);
    return this.repository.list(organizationId, query, listQuery);
  }
  detail(organizationId: string, id: string) {
    assertPartyOrganization(organizationId);
    return this.repository.detail(organizationId, id);
  }
  async create(organizationId: string, userId: string, input: CreatePartyInput) {
    assertPartyOrganization(organizationId);
    const data = buildPartyCreateData(input);
    const party = await this.repository.inTransaction(async (store) => {
      await assertActiveAssignee(store, organizationId, data.assignedToId);
      return store.create(organizationId, userId, data);
    });

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
      await assertActiveAssignee(store, organizationId, data.assignedToId);
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
      const unsettledDebtCount = await store.countUnsettledDebts(organizationId, id);
      if (!canDeactivateParty(unsettledDebtCount))
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
}

async function assertActiveAssignee(
  store: PartyWriteStore,
  organizationId: string,
  userId?: string | null,
) {
  if (userId && !(await store.hasActiveMember(organizationId, userId)))
    throw new ApplicationError('invalid', 'parties.ASSIGNEE_NOT_FOUND');
}

/** Reject missing trusted tenant context before any repository operation. */
function assertPartyOrganization(organizationId: string): void {
  if (typeof organizationId !== 'string' || !organizationId.trim())
    throw new ApplicationError('forbidden', 'errors.FORBIDDEN');
}

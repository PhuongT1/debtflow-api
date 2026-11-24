import type { MemberListInput, CreateMemberInput, UpdateMemberInput } from '../member.types.js';
import type { ListQueryOptions } from '@common/query/list-query-options.types.js';
import type { PaginatedResult } from '@common/utils/pagination.util.js';
import type { MembershipWithUser, MemberOption } from '../member.types.js';

export abstract class UsersRepository {
  abstract list(
    organizationId: string,
    query: MemberListInput,
    listQuery?: ListQueryOptions,
  ): Promise<PaginatedResult<MembershipWithUser>>;
  abstract options(organizationId: string): Promise<MemberOption[]>;
  abstract findMembership(
    organizationId: string,
    userId: string,
  ): Promise<MembershipWithUser | null>;
  abstract countMemberships(userId: string): Promise<number>;
  abstract isActive(organizationId: string, userId: string): Promise<boolean>;
  abstract create(
    organizationId: string,
    input: CreateMemberInput,
    passwordHash: string,
  ): Promise<MembershipWithUser>;
  abstract update(
    organizationId: string,
    id: string,
    input: UpdateMemberInput,
    editsProfile: boolean,
  ): Promise<MembershipWithUser>;
  abstract suspend(organizationId: string, id: string): Promise<MembershipWithUser>;
  abstract reactivate(
    organizationId: string,
    id: string,
    joinedAt: Date,
  ): Promise<MembershipWithUser>;
}

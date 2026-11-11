import type { ListQueryResult } from '@common/query/index.js';
import type { PaginatedResult } from '@common/utils/pagination.util.js';
import type { QueryUsersDto } from '../dto/query-users.dto.js';
import type { CreateUserDto } from '../dto/create-user.dto.js';
import type { UpdateUserDto } from '../dto/update-user.dto.js';
import type { MembershipWithUser, MemberOption } from '../member.types.js';

export abstract class UsersRepository {
  abstract list(
    organizationId: string,
    query: QueryUsersDto,
    listQuery?: ListQueryResult,
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
    input: CreateUserDto,
    passwordHash: string,
  ): Promise<MembershipWithUser>;
  abstract update(
    organizationId: string,
    id: string,
    input: UpdateUserDto,
    editsProfile: boolean,
  ): Promise<MembershipWithUser>;
  abstract suspend(organizationId: string, id: string): Promise<MembershipWithUser>;
  abstract reactivate(
    organizationId: string,
    id: string,
    joinedAt: Date,
  ): Promise<MembershipWithUser>;
}

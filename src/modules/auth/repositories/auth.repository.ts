import type { AuthUser, MembershipContext } from '../auth.types.js';

export abstract class AuthRepository {
  abstract findForLogin(
    email: string,
  ): Promise<(AuthUser & { passwordHash: string | null }) | null>;
  abstract findUser(id: string): Promise<AuthUser | null>;
  abstract getUser(id: string): Promise<AuthUser>;
  abstract memberships(userId: string): Promise<MembershipContext[]>;
  abstract activeMembership(
    userId: string,
    organizationId?: string,
    membershipId?: string,
  ): Promise<MembershipContext | null>;
}

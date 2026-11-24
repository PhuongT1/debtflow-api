import type { AuthUser, MembershipContext } from './auth.types.js';

export interface AuthCredentials {
  verifyPassword(password: string, hash: string): Promise<boolean>;
  readRefresh(
    token: string,
  ): Promise<{ sub: string; organizationId: string; membershipId: string }>;
  issue(
    user: AuthUser,
    membership: MembershipContext,
  ): Promise<{
    accessToken: string;
    accessTokenExpiresAt: number;
    expiresIn: number;
    refreshToken: string;
    tokenType: string;
  }>;
}

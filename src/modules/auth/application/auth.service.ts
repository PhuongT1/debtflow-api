import { ApplicationError } from '@common/errors/application-error.js';
import type { AuthCredentials } from './auth-credentials.port.js';
import type { AuthRepository } from './repositories/auth.repository.js';
import type { AuthUser, LoginInput, MembershipContext } from './auth.types.js';

export class AuthService {
  constructor(
    private readonly repository: AuthRepository,
    private readonly credentials: AuthCredentials,
  ) {}

  async login(input: LoginInput) {
    const email = input.email.trim().toLowerCase();
    const user = await this.repository.findForLogin(email);
    if (!user?.passwordHash || user.status !== 'ACTIVE') {
      throw new ApplicationError('unauthorized', 'auth.INVALID_CREDENTIALS');
    }
    if (!(await this.credentials.verifyPassword(input.password, user.passwordHash))) {
      throw new ApplicationError('unauthorized', 'auth.INVALID_CREDENTIALS');
    }
    const membership = await this.getMembership(user.id, input.organizationId);
    return this.createTokenResponse(this.toSafeUser(user), membership);
  }

  async refresh(refreshToken: string) {
    const payload = await this.credentials.readRefresh(refreshToken);
    const user = await this.repository.findUser(payload.sub);
    if (!user || user.status !== 'ACTIVE')
      throw new ApplicationError('unauthorized', 'auth.ACCOUNT_NOT_FOUND_OR_LOCKED');
    const membership = await this.getMembership(
      user.id,
      payload.organizationId,
      payload.membershipId,
    );
    return this.createTokenResponse(this.toSafeUser(user), membership);
  }

  async switchOrganization(userId: string, organizationId: string) {
    const user = await this.repository.getUser(userId);
    if (user.status !== 'ACTIVE') throw new ApplicationError('forbidden', 'auth.ACCOUNT_LOCKED');
    return this.createTokenResponse(
      this.toSafeUser(user),
      await this.getMembership(user.id, organizationId),
    );
  }

  async getCurrentUser(userId: string) {
    const user = await this.repository.getUser(userId);
    const organizations = await this.repository.memberships(userId);
    return {
      ...this.toSafeUser(user),
      organizations: organizations.map(({ id, role, organization }) => ({
        membershipId: id,
        role,
        ...organization,
      })),
    };
  }

  private async getMembership(
    userId: string,
    organizationId?: string,
    membershipId?: string,
  ): Promise<MembershipContext> {
    const membership = await this.repository.activeMembership(userId, organizationId, membershipId);
    if (!membership) throw new ApplicationError('forbidden', 'auth.NO_ACTIVE_ORGANIZATION');
    return membership;
  }

  private async createTokenResponse(user: AuthUser, membership: MembershipContext) {
    return {
      ...(await this.credentials.issue(user, membership)),
      user,
      activeOrganization: {
        membershipId: membership.id,
        role: membership.role,
        ...membership.organization,
      },
    };
  }

  private toSafeUser(user: AuthUser): AuthUser {
    const { id, name, email, systemRole, status } = user;

    return { id, name, email, systemRole, status };
  }
}

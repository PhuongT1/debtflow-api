import { describe, expect, it, vi } from 'vitest';
import * as bcrypt from 'bcryptjs';
import { AuthService } from './auth.service.js';
import { AUTH_USER_SELECT } from '../queries/auth.select.js';

function setup() {
  const user = {
    id: 'u1',
    name: 'Example',
    email: 'test@example.com',
    systemRole: 'USER',
    status: 'ACTIVE',
  };
  const membership = {
    id: 'm1',
    organizationId: 'o1',
    role: 'VIEWER',
    organization: {
      id: 'o1',
      name: 'Example',
      slug: 'example',
      kind: 'PERSONAL',
      status: 'ACTIVE',
    },
  };
  const prisma = {
    user: {
      findUnique: vi.fn().mockResolvedValue(user),
      findUniqueOrThrow: vi.fn().mockResolvedValue(user),
    },
    organizationMembership: { findMany: vi.fn().mockResolvedValue([membership]) },
  };
  const jwt = { signAsync: vi.fn().mockResolvedValue('test-placeholder'), verifyAsync: vi.fn() };
  const config = { get: vi.fn() };
  return {
    user,
    membership,
    prisma,
    jwt,
    service: new AuthService(prisma as never, jwt as never, config as never),
  };
}

describe('auth-owned session service', () => {
  it('normalizes login, verifies active tenant membership and excludes credentials from response/tokens', async () => {
    const s = setup();
    const passwordHash = await bcrypt.hash('TestPassword123', 4);
    s.prisma.user.findUnique.mockResolvedValue({ ...s.user, passwordHash });
    const result = await s.service.login({
      email: ' TEST@example.com ',
      password: 'TestPassword123',
      organizationId: 'o1',
    });
    expect(s.prisma.user.findUnique.mock.calls[0][0].where).toEqual({ email: 'test@example.com' });
    expect(s.prisma.organizationMembership.findMany.mock.calls[0][0].where).toMatchObject({
      userId: 'u1',
      organizationId: 'o1',
      status: 'ACTIVE',
      organization: { status: 'ACTIVE' },
    });
    expect(result.user).toEqual(s.user);
    expect(JSON.stringify(result)).not.toContain(passwordHash);
    expect(s.jwt.signAsync.mock.calls[0][0]).toMatchObject({
      organizationId: 'o1',
      membershipId: 'm1',
      role: 'VIEWER',
      type: 'access',
    });
    expect(s.jwt.signAsync.mock.calls[0][0]).not.toHaveProperty('passwordHash');
  });

  it('issues no tokens when switching to a tenant without active membership', async () => {
    const s = setup();
    s.prisma.organizationMembership.findMany.mockResolvedValue([]);
    await expect(s.service.switchOrganization('u1', 'foreign-org')).rejects.toMatchObject({
      status: 403,
    });
    expect(s.prisma.organizationMembership.findMany.mock.calls[0][0].where.organizationId).toBe(
      'foreign-org',
    );
    expect(s.jwt.signAsync).not.toHaveBeenCalled();
  });

  it('rechecks user and membership on refresh, never selecting credentials', async () => {
    const s = setup();
    s.jwt.verifyAsync.mockResolvedValue({
      sub: 'u1',
      organizationId: 'o1',
      membershipId: 'm1',
      type: 'refresh',
    });
    s.prisma.organizationMembership.findMany.mockResolvedValue([]);
    await expect(s.service.refresh('test-placeholder')).rejects.toMatchObject({ status: 403 });
    expect(s.prisma.user.findUnique).toHaveBeenCalledWith({
      where: { id: 'u1' },
      select: AUTH_USER_SELECT,
    });
    expect(s.prisma.organizationMembership.findMany.mock.calls[0][0].where).toMatchObject({
      id: 'm1',
      organizationId: 'o1',
      status: 'ACTIVE',
    });
    expect(s.jwt.signAsync).not.toHaveBeenCalled();
  });

  it('keeps the profile response safe while reusing the typed membership projection', async () => {
    const s = setup();
    const result = await s.service.getCurrentUser('u1');
    expect(result).toEqual({
      ...s.user,
      organizations: [{ membershipId: 'm1', role: 'VIEWER', ...s.membership.organization }],
    });
    expect(result.organizations[0]).not.toHaveProperty('organizationId');
    expect(s.prisma.user.findUniqueOrThrow.mock.calls[0][0].select).not.toHaveProperty(
      'passwordHash',
    );
  });
});

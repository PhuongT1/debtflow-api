import { createAppConfig } from '@config/app.config.js';
import { describe, expect, it, vi } from 'vitest';
import type { ExecutionContext } from '@nestjs/common';
import { JwtAuthGuard } from '../guards/jwt-auth.guard.js';
import type { AuthenticatedRequest } from '@auth/types/auth-context.types.js';

const payload = {
  sub: 'user-1',
  membershipId: 'member-1',
  organizationId: 'org-1',
  role: 'ADMIN',
  type: 'access',
  email: 'old@example.com',
  systemRole: 'USER',
};

function setup() {
  const request = { headers: { authorization: 'Bearer signed-token' } } as AuthenticatedRequest;
  const context = {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
  const verifyAsync = vi.fn().mockResolvedValue(payload);
  const findFirst = vi.fn().mockResolvedValue({
    role: 'VIEWER',
    user: { email: 'current@example.com', systemRole: 'USER' },
  });
  const getAllAndOverride = vi.fn().mockReturnValue(false);
  const guard = new JwtAuthGuard(
    { verifyAsync } as never,
    createAppConfig({
      DATABASE_URL: 'postgresql://fixture:fixture@127.0.0.1:1/not_connected',
      JWT_SECRET: 'fixture-secret-with-at-least-24-characters',
    }),
    { getAllAndOverride } as never,
    { organizationMembership: { findFirst } } as never,
  );
  return { guard, request, context, verifyAsync, findFirst, getAllAndOverride };
}

describe('JwtAuthGuard current authorization', () => {
  it('uses the current role and checks the exact tenant, identity and active states', async () => {
    const s = setup();
    await expect(s.guard.canActivate(s.context)).resolves.toBe(true);
    expect(s.findFirst.mock.calls[0][0].where).toEqual({
      id: 'member-1',
      organizationId: 'org-1',
      userId: 'user-1',
      status: 'ACTIVE',
      user: { status: 'ACTIVE' },
      organization: { status: 'ACTIVE' },
    });
    expect(s.request.user).toMatchObject({ role: 'VIEWER', email: 'current@example.com' });
  });

  it('rejects a previously valid token when the active membership no longer exists', async () => {
    const s = setup();
    s.findFirst.mockResolvedValue(null);
    await expect(s.guard.canActivate(s.context)).rejects.toMatchObject({ status: 401 });
    expect(s.request.user).toBeUndefined();
  });

  it('does not query the database for invalid tokens or token types', async () => {
    const s = setup();
    s.verifyAsync.mockResolvedValue({ ...payload, type: 'refresh' });
    await expect(s.guard.canActivate(s.context)).rejects.toMatchObject({ status: 401 });
    expect(s.findFirst).not.toHaveBeenCalled();
  });

  it('requires the Bearer scheme', async () => {
    const s = setup();
    s.request.headers.authorization = 'Basic signed-token';
    await expect(s.guard.canActivate(s.context)).rejects.toMatchObject({ status: 401 });
    expect(s.verifyAsync).not.toHaveBeenCalled();
  });

  it('keeps public endpoints accessible without a database lookup', async () => {
    const s = setup();
    s.getAllAndOverride.mockReturnValue(true);
    await expect(s.guard.canActivate(s.context)).resolves.toBe(true);
    expect(s.verifyAsync).not.toHaveBeenCalled();
    expect(s.findFirst).not.toHaveBeenCalled();
  });

  it('does not disguise database outages as invalid credentials', async () => {
    const s = setup();
    s.findFirst.mockRejectedValue(new Error('database unavailable'));
    await expect(s.guard.canActivate(s.context)).rejects.toThrow('database unavailable');
  });
});

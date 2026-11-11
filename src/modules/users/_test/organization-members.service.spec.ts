import { describe, expect, it, vi } from 'vitest';
import { OrganizationMembersService } from '../services/organization-members.service.js';
import { PrismaUsersRepository } from '../infrastructure/prisma-users.repository.js';

describe('OrganizationMembersService repository boundary', () => {
  it('uses the owning repository and rejects empty tenants before access', async () => {
    const isActive = vi.fn().mockResolvedValue(true);
    const service = new OrganizationMembersService({ isActive } as never);
    expect(await service.isActive('org-1', 'u1')).toBe(true);
    expect(isActive).toHaveBeenCalledWith('org-1', 'u1');
    expect(() => service.isActive('', 'u1')).toThrow();
    expect(isActive).toHaveBeenCalledTimes(1);
  });
  it('adapter scopes active membership, user and organization together', async () => {
    const findFirst = vi.fn().mockResolvedValue({ id: 'm1' });
    const repository = new PrismaUsersRepository({
      organizationMembership: { findFirst },
    } as never);
    expect(await repository.isActive('org-1', 'u1')).toBe(true);
    expect(findFirst).toHaveBeenCalledWith({
      where: {
        organizationId: 'org-1',
        userId: 'u1',
        status: 'ACTIVE',
        user: { status: 'ACTIVE' },
        organization: { status: 'ACTIVE' },
      },
      select: { id: true },
    });
    findFirst.mockResolvedValue(null);
    expect(await repository.isActive('org-1', 'foreign')).toBe(false);
  });
});

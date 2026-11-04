import { describe, expect, it, vi } from 'vitest';
import { OrganizationMembersService } from './organization-members.service.js';

describe('OrganizationMembersService', () => {
  it('requires matching tenant, active membership, user and organization on the supplied transaction', async () => {
    const root = vi.fn();
    const lookup = vi.fn().mockResolvedValue({ id: 'member-1' });
    const service = new OrganizationMembersService({
      organizationMembership: { findFirst: root },
    } as never);
    const tx = { organizationMembership: { findFirst: lookup } };
    expect(await service.isActive('org-1', 'user-1', tx as never)).toBe(true);
    expect(lookup).toHaveBeenCalledWith({
      where: {
        organizationId: 'org-1',
        userId: 'user-1',
        status: 'ACTIVE',
        user: { status: 'ACTIVE' },
        organization: { status: 'ACTIVE' },
      },
      select: { id: true },
    });
    expect(root).not.toHaveBeenCalled();
    lookup.mockResolvedValue(null);
    expect(await service.isActive('org-1', 'foreign-or-inactive', tx as never)).toBe(false);
  });
});

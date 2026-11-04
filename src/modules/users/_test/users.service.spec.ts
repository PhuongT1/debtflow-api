import { describe, expect, it, vi } from 'vitest';
import { AUDIT_EVENT } from '@common/events/audit-event.js';
import { UsersService } from '../services/users.service.js';

const actor = { userId: 'owner', role: 'OWNER' as const };
const member = {
  id: 'membership',
  userId: 'target',
  organizationId: 'org-1',
  role: 'VIEWER',
  status: 'ACTIVE',
  invitedAt: null,
  joinedAt: new Date('2026-10-01'),
  createdAt: new Date('2026-10-01'),
  user: {
    id: 'target',
    name: 'Member',
    email: 'member@example.com',
    phone: '0901234567',
    status: 'ACTIVE',
    systemRole: 'USER',
  },
};

function setup() {
  const findFirst = vi.fn().mockResolvedValue(member);
  const count = vi.fn().mockResolvedValue(1);
  const update = vi
    .fn()
    .mockImplementation(async ({ data }) => ({ ...member, ...data, user: member.user }));
  const create = vi.fn();
  const emit = vi.fn();
  const service = new UsersService(
    { organizationMembership: { findFirst, count, update, create } } as never,
    { emit } as never,
  );
  return { service, findFirst, count, update, create, emit };
}

describe('UsersService member boundaries', () => {
  it('looks up targets only inside the current organization and rejects missing members', async () => {
    const s = setup();
    s.findFirst.mockResolvedValue(null);
    await expect(
      s.service.update('org-1', 'foreign-user', { role: 'ADMIN' }, actor),
    ).rejects.toMatchObject({ status: 404 });
    expect(s.findFirst.mock.calls[0][0].where).toEqual({
      organizationId: 'org-1',
      userId: 'foreign-user',
    });
    expect(s.update).not.toHaveBeenCalled();
    expect(s.emit).not.toHaveBeenCalled();
  });

  it('prevents an administrator from changing an OWNER account', async () => {
    const s = setup();
    s.findFirst.mockResolvedValue({ ...member, role: 'OWNER' });
    await expect(
      s.service.update('org-1', 'target', { role: 'VIEWER' }, { userId: 'admin', role: 'ADMIN' }),
    ).rejects.toMatchObject({ status: 403 });
    expect(s.update).not.toHaveBeenCalled();
  });

  it('prevents cross-organization profile changes for shared accounts', async () => {
    const s = setup();
    s.count.mockResolvedValue(2);
    await expect(
      s.service.update('org-1', 'target', { name: 'Changed' }, actor),
    ).rejects.toMatchObject({ status: 403 });
    expect(s.update).not.toHaveBeenCalled();
  });

  it('suspends only the membership, returns a safe member and records the actor', async () => {
    const s = setup();
    const result = await s.service.deactivate('org-1', 'target', actor);
    expect(s.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'membership' }, data: { status: 'SUSPENDED' } }),
    );
    expect(result).toMatchObject({
      id: 'target',
      membershipStatus: 'SUSPENDED',
      userStatus: 'ACTIVE',
      status: 'INACTIVE',
    });
    expect(result).not.toHaveProperty('passwordHash');
    expect(s.emit).toHaveBeenCalledWith(
      AUDIT_EVENT,
      expect.objectContaining({
        organizationId: 'org-1',
        actorId: 'owner',
        action: 'member.suspended',
        before: { membershipStatus: 'ACTIVE' },
        after: { membershipStatus: 'SUSPENDED' },
      }),
    );
  });

  it('reactivates the membership without reactivating a globally disabled account', async () => {
    const s = setup();
    s.findFirst.mockResolvedValue({
      ...member,
      status: 'SUSPENDED',
      user: { ...member.user, status: 'INACTIVE' },
    });
    s.update.mockResolvedValue({ ...member, user: { ...member.user, status: 'INACTIVE' } });
    const result = await s.service.reactivate('org-1', 'target', actor);
    expect(result).toMatchObject({
      membershipStatus: 'ACTIVE',
      userStatus: 'INACTIVE',
      status: 'INACTIVE',
    });
    expect(s.emit).toHaveBeenCalledWith(
      AUDIT_EVENT,
      expect.objectContaining({ action: 'member.reactivated' }),
    );
  });

  it('does not publish an audit event when a write fails', async () => {
    const s = setup();
    s.update.mockRejectedValue(new Error('write failed'));
    await expect(s.service.deactivate('org-1', 'target', actor)).rejects.toThrow('write failed');
    expect(s.emit).not.toHaveBeenCalled();
  });
});

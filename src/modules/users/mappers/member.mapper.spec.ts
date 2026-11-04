import { describe, expect, it } from 'vitest';
import { OrganizationMembershipStatus, OrganizationRole, UserStatus } from '#generated/prisma/client.js';
import { toMemberDto } from './member.mapper.js';

describe('toMemberDto', () => {
  const base = {
    id: 'm1',
    role: OrganizationRole.VIEWER,
    status: OrganizationMembershipStatus.ACTIVE,
    invitedAt: null,
    joinedAt: new Date('2026-09-04T00:00:00Z'),
    createdAt: new Date('2026-09-04T00:00:00Z'),
    user: {
      id: 'u1',
      name: 'A',
      email: 'a@x.vn',
      phone: null,
      status: UserStatus.ACTIVE,
      systemRole: 'USER' as const,
    },
  };

  it('uses the user id as id and keeps the membership id separately', () => {
    const dto = toMemberDto(base);
    expect(dto.id).toBe('u1');
    expect(dto.membershipId).toBe('m1');
    expect(dto.status).toBe('ACTIVE');
  });

  it('reports INACTIVE when the membership is suspended or the account is disabled', () => {
    expect(toMemberDto({ ...base, status: 'SUSPENDED' }).status).toBe('INACTIVE');
    expect(toMemberDto({ ...base, status: 'INVITED' }).status).toBe('INACTIVE');
    expect(toMemberDto({ ...base, user: { ...base.user, status: 'INACTIVE' } }).status).toBe(
      'INACTIVE',
    );
    expect(toMemberDto({ ...base, status: 'SUSPENDED' }).membershipStatus).toBe('SUSPENDED');
  });
});

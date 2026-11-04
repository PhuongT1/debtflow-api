import { describe, expect, it } from 'vitest';
import { OrganizationMembershipStatus, OrganizationRole } from '@generated/prisma/client.js';
import {
  assertCanChangeAccess,
  assertCanEditProfile,
  assertCanGrantRole,
  assertCanReactivate,
  assertCanSuspend,
} from '../rules/users.rules.js';

const owner = { userId: 'u-owner', role: OrganizationRole.OWNER };
const admin = { userId: 'u-admin', role: OrganizationRole.ADMIN };
const accountant = { userId: 'u-acc', role: OrganizationRole.ACCOUNTANT };

const codeOf = (fn: () => unknown) => {
  try {
    fn();
  } catch (error) {
    return (error as { getResponse: () => { code: string } }).getResponse().code;
  }
  return undefined;
};

describe('assertCanChangeAccess', () => {
  it('lets an admin change the role of a non-owner', () => {
    expect(
      codeOf(() => assertCanChangeAccess(admin, accountant, { role: 'VIEWER' })),
    ).toBeUndefined();
    expect(
      codeOf(() => assertCanChangeAccess(admin, accountant, { suspend: true })),
    ).toBeUndefined();
  });

  it('never lets anyone change their own role or suspend themselves', () => {
    expect(codeOf(() => assertCanChangeAccess(owner, owner, { role: 'ADMIN' }))).toBe(
      'CANNOT_CHANGE_OWN_ACCESS',
    );
    expect(codeOf(() => assertCanChangeAccess(admin, admin, { suspend: true }))).toBe(
      'CANNOT_CHANGE_OWN_ACCESS',
    );
  });

  it('allows a no-op on yourself (same role)', () => {
    expect(codeOf(() => assertCanChangeAccess(admin, admin, { role: 'ADMIN' }))).toBeUndefined();
  });

  it('reserves OWNER management and grants to owners', () => {
    expect(codeOf(() => assertCanChangeAccess(admin, owner, { suspend: true }))).toBe('OWNER_ONLY');
    expect(codeOf(() => assertCanChangeAccess(admin, accountant, { role: 'OWNER' }))).toBe(
      'OWNER_ONLY',
    );
    expect(
      codeOf(() =>
        assertCanChangeAccess(owner, { userId: 'u2', role: 'OWNER' }, { suspend: true }),
      ),
    ).toBeUndefined();
    expect(
      codeOf(() => assertCanChangeAccess(owner, accountant, { role: 'OWNER' })),
    ).toBeUndefined();
  });
});

describe('assertCanGrantRole', () => {
  it('only owners create owners', () => {
    expect(codeOf(() => assertCanGrantRole(admin, 'OWNER'))).toBe('OWNER_ONLY');
    expect(codeOf(() => assertCanGrantRole(owner, 'OWNER'))).toBeUndefined();
    expect(codeOf(() => assertCanGrantRole(admin, 'VIEWER'))).toBeUndefined();
  });
});

describe('assertCanEditProfile', () => {
  it('allows self-editing and admin edits of single-organization accounts only', () => {
    expect(codeOf(() => assertCanEditProfile(admin, 'u-admin', 3))).toBeUndefined();
    expect(codeOf(() => assertCanEditProfile(admin, 'u-acc', 1))).toBeUndefined();
    expect(codeOf(() => assertCanEditProfile(admin, 'u-acc', 2))).toBe('SHARED_ACCOUNT');
  });
});

describe('status transitions', () => {
  it('rejects redundant suspend and reactivate', () => {
    expect(codeOf(() => assertCanSuspend(OrganizationMembershipStatus.SUSPENDED))).toBe(
      'ALREADY_SUSPENDED',
    );
    expect(codeOf(() => assertCanSuspend(OrganizationMembershipStatus.ACTIVE))).toBeUndefined();
    expect(codeOf(() => assertCanReactivate(OrganizationMembershipStatus.ACTIVE))).toBe(
      'ALREADY_ACTIVE',
    );
    expect(
      codeOf(() => assertCanReactivate(OrganizationMembershipStatus.SUSPENDED)),
    ).toBeUndefined();
  });
});

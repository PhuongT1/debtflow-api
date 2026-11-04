import 'reflect-metadata';
import type { ExecutionContext, Type } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { OrganizationRole } from '#generated/prisma/client.js';
import { describe, expect, it } from 'vitest';
import { Roles } from '../decorators/roles.decorator.js';
import { RolesGuard } from './roles.guard.js';

@Roles(OrganizationRole.ADMIN)
class RestrictedController {
  inheritedPolicy() {}

  @Roles(OrganizationRole.ACCOUNTANT)
  overridePolicy() {}

  @Roles()
  noRoleConstraint() {}
}

class UnrestrictedController {
  noPolicy() {}

  @Roles(OrganizationRole.VIEWER)
  viewerOnly() {}
}

function setup(
  controller: Type<unknown> = RestrictedController,
  handler = RestrictedController.prototype.inheritedPolicy,
  role?: OrganizationRole,
) {
  const request = { user: role ? { role } : undefined, body: {}, query: {} };
  const context = {
    getClass: () => controller,
    getHandler: () => handler,
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
  return { guard: new RolesGuard(new Reflector()), context, request };
}

describe('RolesGuard metadata and current role', () => {
  it.each([
    [OrganizationRole.ADMIN, true],
    [OrganizationRole.OWNER, false],
    [OrganizationRole.ACCOUNTANT, false],
    [OrganizationRole.VIEWER, false],
  ])('enforces the class allow-list exactly for %s', (role, allowed) => {
    const s = setup(RestrictedController, RestrictedController.prototype.inheritedPolicy, role);
    expect(s.guard.canActivate(s.context)).toBe(allowed);
  });

  it.each([
    [OrganizationRole.ACCOUNTANT, true],
    [OrganizationRole.ADMIN, false],
    [OrganizationRole.OWNER, false],
  ])('replaces rather than merges the class policy for method role %s', (role, allowed) => {
    const s = setup(RestrictedController, RestrictedController.prototype.overridePolicy, role);
    expect(s.guard.canActivate(s.context)).toBe(allowed);
  });

  it('enforces a method policy when the class has no role metadata', () => {
    const s = setup(
      UnrestrictedController,
      UnrestrictedController.prototype.viewerOnly,
      OrganizationRole.ADMIN,
    );
    expect(s.guard.canActivate(s.context)).toBe(false);
    s.request.user = { role: OrganizationRole.VIEWER };
    expect(s.guard.canActivate(s.context)).toBe(true);
  });

  it('denies a role-restricted handler without an authenticated user', () => {
    const s = setup();
    expect(s.guard.canActivate(s.context)).toBe(false);
  });

  it('reads the current request role on every call and ignores body/query role claims', () => {
    const s = setup(
      RestrictedController,
      RestrictedController.prototype.inheritedPolicy,
      OrganizationRole.ADMIN,
    );
    expect(s.guard.canActivate(s.context)).toBe(true);
    s.request.user = { role: OrganizationRole.VIEWER };
    s.request.body = { role: OrganizationRole.ADMIN };
    s.request.query = { role: OrganizationRole.ADMIN };
    expect(s.guard.canActivate(s.context)).toBe(false);
  });

  it('inherits class metadata for a subclass using the same handler', () => {
    class ChildController extends RestrictedController {}
    const s = setup(
      ChildController,
      ChildController.prototype.inheritedPolicy,
      OrganizationRole.VIEWER,
    );
    expect(s.guard.canActivate(s.context)).toBe(false);
  });

  it('adds no role constraint when none is declared; JWT authentication is a separate guard', () => {
    const s = setup(UnrestrictedController, UnrestrictedController.prototype.noPolicy);
    expect(s.guard.canActivate(s.context)).toBe(true);
  });

  it('treats an explicit empty method policy as no role constraint, not an inherited class gate', () => {
    // The conventions gate rejects empty @Roles on protected mutations. Do not confuse it with auth.
    const s = setup(
      RestrictedController,
      RestrictedController.prototype.noRoleConstraint,
      OrganizationRole.VIEWER,
    );
    expect(s.guard.canActivate(s.context)).toBe(true);
  });
});

export type OrganizationRole = 'OWNER' | 'ADMIN' | 'ACCOUNTANT' | 'VIEWER';
export type MembershipStatus = 'INVITED' | 'ACTIVE' | 'SUSPENDED';
export type UserStatus = 'ACTIVE' | 'INACTIVE';
export type SystemRole = 'USER' | 'PLATFORM_OWNER' | 'PLATFORM_SUPPORT';

export type MemberIdentity = { userId: string; role: OrganizationRole };
export type AccessChange = { role?: OrganizationRole; suspend?: boolean };

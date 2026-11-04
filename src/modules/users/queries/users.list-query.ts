import { OrganizationMembershipStatus, OrganizationRole, UserStatus } from '#generated/prisma/client.js';
import { defineListQuery } from '#common/query/index.js';

/** Fields clients may filter and sort on for `GET /users`. The list is built from memberships. */
export const USER_LIST_QUERY = defineListQuery({
  model: 'OrganizationMembership',
  fields: {
    name: { type: 'string', path: 'user.name' },
    email: { type: 'string', path: 'user.email' },
    phone: { type: 'string', nullable: true, path: 'user.phone' },
    userStatus: { type: 'enum', values: Object.values(UserStatus), path: 'user.status' },
    role: { type: 'enum', values: Object.values(OrganizationRole) },
    membershipStatus: {
      type: 'enum',
      values: Object.values(OrganizationMembershipStatus),
      path: 'status',
    },
    joinedAt: { type: 'date', nullable: true },
    createdAt: { type: 'date' },
  },
});

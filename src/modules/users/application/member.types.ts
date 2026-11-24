import type { PaginationInput } from '@common/utils/pagination.util.js';
import type {
  MembershipStatus,
  OrganizationRole,
  SystemRole,
  UserStatus,
} from '../domain/member-access.types.js';

export type MemberListInput = PaginationInput & {
  q?: string;
  role?: OrganizationRole;
  status?: UserStatus;
  membershipStatus?: MembershipStatus;
};

export type CreateMemberInput = {
  name: string;
  email: string;
  phone?: string;
  password: string;
  role: OrganizationRole;
};

export type UpdateMemberInput = {
  name?: string;
  phone?: string | null;
  role?: OrganizationRole;
};

export type MembershipWithUser = {
  id: string;
  role: OrganizationRole;
  status: MembershipStatus;
  invitedAt: Date | null;
  joinedAt: Date | null;
  createdAt: Date;
  user: {
    id: string;
    name: string;
    email: string;
    phone: string | null;
    status: UserStatus;
    systemRole: SystemRole;
  };
};

export type MemberOption = Pick<MembershipWithUser['user'], 'id' | 'name' | 'email' | 'status'> &
  Pick<MembershipWithUser, 'role'>;

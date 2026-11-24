export type LoginInput = {
  email: string;
  password: string;
  organizationId?: string;
};

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  systemRole: string;
  status: string;
};

export type MembershipContext = {
  id: string;
  organizationId: string;
  role: string;
  organization: { id: string; name: string; slug: string; kind: string; status: string };
};

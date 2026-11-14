/** Read models returned by Party use cases; no generated database types cross this boundary. */
export type PartyType = 'CUSTOMER' | 'SUPPLIER' | 'BOTH';
export type PartyRecord = {
  id: string;
  organizationId: string;
  type: PartyType;
  name: string;
  code: string | null;
  phone: string | null;
  email: string | null;
  taxCode: string | null;
  address: string | null;
  address2: string | null;
  note: string | null;
  provinceCode: string | null;
  provinceName: string | null;
  imageUrl: string | null;
  searchText: string;
  creditLimit: string | null;
  isActive: boolean;
  createdById: string | null;
  assignedToId: string | null;
  createdAt: Date;
  updatedAt: Date;
};


export type PartyBalance = { receivable: string; payable: string };
export type PartyAssignee = { id: string; name: string; email: string };
export type PartyWithBalance = PartyRecord & {
  assignedTo: PartyAssignee | null;
  _count: { debts: number };
  balance: PartyBalance;
};

/** Existing detail read model; money is decimal text, dates remain Date until HTTP serialization. */
export type PartyDebt = {
  id: string;
  organizationId: string;
  code: string;
  type: 'RECEIVABLE' | 'PAYABLE';
  partyId: string;
  assignedToId: string | null;
  title: string;
  invoiceNo: string | null;
  orderNo: string | null;
  contractNo: string | null;
  poNo: string | null;
  description: string | null;
  originalAmount: string;
  paidAmount: string;
  currency: string;
  salesChannel: 'STORE' | 'ONLINE' | 'WHOLESALE' | null;
  issueDate: Date;
  dueDate: Date;
  status: 'OPEN' | 'PARTIAL' | 'PAID' | 'CANCELLED';
  collectionStatus: 'NEW' | 'CONTACTED' | 'PROMISED' | 'DISPUTED' | 'ESCALATED';
  nextFollowUpAt: Date | null;
  followUpNote: string | null;
  createdById: string | null;
  createdAt: Date;
  updatedAt: Date;
};
export type PartyDetail = PartyRecord & { assignedTo: PartyAssignee | null; debts: PartyDebt[] };

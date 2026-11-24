import type { Prisma } from '@generated/prisma/client.js';
export const DEBT_LIST_INCLUDE = {
  party: true,
  assignedTo: { select: { id: true, name: true, email: true } },
  items: {
    select: {
      id: true,
      productName: true,
      categoryName: true,
      brandName: true,
      quantity: true,
      unit: true,
      lineAmount: true,
    },
  },
  _count: { select: { paymentAllocations: true } },
} satisfies Prisma.DebtInclude;
export const DEBT_DETAIL_INCLUDE = {
  party: true,
  assignedTo: { select: { id: true, name: true, email: true } },
  items: { include: { product: { include: { brand: true, category: true } } } },
  paymentAllocations: {
    orderBy: { payment: { paidAt: 'desc' } },
    include: {
      payment: { include: { createdBy: { select: { id: true, name: true, email: true } } } },
    },
  },
} satisfies Prisma.DebtInclude;

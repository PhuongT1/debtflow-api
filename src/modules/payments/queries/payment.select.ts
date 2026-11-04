import type { Prisma } from '#generated/prisma/client.js';

export const PAYMENT_DETAILS_INCLUDE = {
  party: { select: { id: true, name: true } },
  allocations: {
    include: { debt: { include: { party: true } } },
    orderBy: { debt: { dueDate: 'asc' } },
  },
  createdBy: { select: { id: true, name: true, email: true } },
} satisfies Prisma.PaymentInclude;

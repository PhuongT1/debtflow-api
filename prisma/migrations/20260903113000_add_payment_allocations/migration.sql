-- Preserve every existing one-debt payment as a voucher with one allocation.
ALTER TABLE "Payment" ADD COLUMN "partyId" TEXT;
ALTER TABLE "Payment" ADD COLUMN "type" "DebtType";

UPDATE "Payment" AS payment
SET "partyId" = debt."partyId", "type" = debt."type"
FROM "Debt" AS debt
WHERE payment."debtId" = debt."id";

CREATE TABLE "PaymentAllocation" (
    "id" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "debtId" TEXT NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PaymentAllocation_pkey" PRIMARY KEY ("id")
);

INSERT INTO "PaymentAllocation" ("id", "paymentId", "debtId", "amount", "createdAt")
SELECT payment."id" || '-allocation', payment."id", payment."debtId", payment."amount", payment."createdAt"
FROM "Payment" AS payment;

ALTER TABLE "Payment" ALTER COLUMN "partyId" SET NOT NULL;
ALTER TABLE "Payment" ALTER COLUMN "type" SET NOT NULL;
DROP INDEX "Payment_debtId_idx";
ALTER TABLE "Payment" DROP CONSTRAINT "Payment_debtId_fkey";
ALTER TABLE "Payment" DROP COLUMN "debtId";

CREATE UNIQUE INDEX "PaymentAllocation_paymentId_debtId_key" ON "PaymentAllocation"("paymentId", "debtId");
CREATE INDEX "PaymentAllocation_debtId_idx" ON "PaymentAllocation"("debtId");
CREATE INDEX "Payment_partyId_type_paidAt_idx" ON "Payment"("partyId", "type", "paidAt");

ALTER TABLE "Payment" ADD CONSTRAINT "Payment_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "Party"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PaymentAllocation" ADD CONSTRAINT "PaymentAllocation_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PaymentAllocation" ADD CONSTRAINT "PaymentAllocation_debtId_fkey" FOREIGN KEY ("debtId") REFERENCES "Debt"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

BEGIN;

-- Keep public IDs unchanged while enforcing same-tenant links to Party.
CREATE UNIQUE INDEX "Party_organizationId_id_key" ON "Party" ("organizationId", "id");

ALTER TABLE "Debt"
  ADD CONSTRAINT "Debt_organizationId_partyId_fkey"
  FOREIGN KEY ("organizationId", "partyId") REFERENCES "Party" ("organizationId", "id")
  ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE "Payment"
  ADD CONSTRAINT "Payment_organizationId_partyId_fkey"
  FOREIGN KEY ("organizationId", "partyId") REFERENCES "Party" ("organizationId", "id")
  ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE "Debt" DROP CONSTRAINT "Debt_partyId_fkey";
ALTER TABLE "Payment" DROP CONSTRAINT "Payment_partyId_fkey";

-- NaN compares above finite numeric values in PostgreSQL, so a positive bound alone is insufficient.
ALTER TABLE "Debt"
  ADD CONSTRAINT "Debt_money_valid_check" CHECK (
    "originalAmount" > 0 AND "originalAmount" < 'Infinity'::numeric
    AND "paidAmount" >= 0 AND "paidAmount" <= "originalAmount"
  ),
  ADD CONSTRAINT "Debt_currency_vnd_check" CHECK ("currency" = 'VND'),
  ADD CONSTRAINT "Debt_due_date_valid_check" CHECK ("dueDate" >= "issueDate");

ALTER TABLE "Payment" ADD CONSTRAINT "Payment_amount_valid_check"
  CHECK ("amount" > 0 AND "amount" < 'Infinity'::numeric);

ALTER TABLE "PaymentAllocation" ADD CONSTRAINT "PaymentAllocation_amount_valid_check"
  CHECK ("amount" > 0 AND "amount" < 'Infinity'::numeric);

ALTER TABLE "Party" ADD CONSTRAINT "Party_credit_limit_valid_check"
  CHECK ("creditLimit" >= 0 AND "creditLimit" < 'Infinity'::numeric);

COMMIT;

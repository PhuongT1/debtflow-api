/** A party with unsettled debts must remain active. Application maps a rejection to its error contract. */
export function canDeactivateParty(activeDebtCount: number): boolean {
  return activeDebtCount === 0;
}

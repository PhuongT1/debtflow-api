import { describe, expect, it } from 'vitest';
import { canDeactivateParty } from '../domain/party.rules.js';

describe('Party deactivation rule', () => {
  it('allows deactivation only when there are no unsettled debts', () => {
    expect(canDeactivateParty(0)).toBe(true);
    expect(canDeactivateParty(1)).toBe(false);
    expect(canDeactivateParty(10)).toBe(false);
  });
});

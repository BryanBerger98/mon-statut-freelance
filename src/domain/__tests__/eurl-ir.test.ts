import { describe, expect, it } from 'vitest';
import { makeProfile } from '../__test-utils__/make-profile';
import { computeEurlIr } from '../statuses/eurl-ir';
import { statusResultValidation } from '../validation';

describe('computeEurlIr', () => {
  // Mechanically identical to ei-reel (shared tns-au-reel pipeline); the equivalence itself is
  // asserted in ei-reel.test.ts. Here: an independent happy-path ledger + contract guard.

  it('conserves the ledger: cotisations + impot + net + cfe = revenu brut', () => {
    const profile = makeProfile({ caServiceBIC: 70_000, chargesReelles: 15_000, situationFamiliale: 'marie_pacse', nbParts: 2 });
    const r = computeEurlIr({ profile, status: 'eurl-ir' });
    const revenuBrut = 70_000 - 15_000;
    expect(r.status).toBe('eurl-ir');
    expect(r.cotisations + r.impot + r.netDisponible + (r.cfe ?? 0)).toBeCloseTo(revenuBrut, 0);
  });

  it('returns a result satisfying the Zod output contract', () => {
    const profile = makeProfile({ caServiceBIC: 70_000, chargesReelles: 15_000 });
    const r = computeEurlIr({ profile, status: 'eurl-ir' });
    expect(() => statusResultValidation.parse(r)).not.toThrow();
  });
});

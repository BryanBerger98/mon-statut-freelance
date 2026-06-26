import { describe, expect, it } from 'vitest';
import { makeProfile } from '../__test-utils__/make-profile';
import { computeEurlIs } from '../statuses/eurl-is';
import { statusResultISValidation } from '../validation';

describe('computeEurlIs', () => {
  // Structural / ledger tests, NOT frozen oracle values: the TNS path rides FLAGGED constants
  // (calc.md §1.6). These identities hold rate-independently and catch transcription /
  // PFU-bucketing / 10 %-rule bugs.

  const baseSociete = {
    caServiceBIC: 90_000,
    chargesReelles: 10_000,
    remunerationChoisie: 20_000,
    partDividendes: 1,
    optionBaremeDividendes: false,
    firstYear: false,
    situationFamiliale: 'celibataire' as const,
    nbParts: 1,
  };

  it('conserves the full ledger at partDividendes=1: cotisations + impot + net + cfe = bénéfice', () => {
    const profile = makeProfile({ ...baseSociete, capitalPlusCCA: 1_000 });
    const r = computeEurlIs({ profile, status: 'eurl-is' });
    const benefice = 90_000 - 10_000;
    expect(r.is ?? 0).toBeGreaterThan(0); // baseIS > 0 ⇒ the full-conservation identity applies
    expect(r.cotisations + r.impot + r.netDisponible + (r.cfe ?? 0)).toBeCloseTo(benefice, 0);
  });

  it('keeps dividendes bruts invariant to capitalPlusCCA (the 10 % rule splits PS vs TNS, not the gross)', () => {
    const low = computeEurlIs({ profile: makeProfile({ ...baseSociete, capitalPlusCCA: 1_000 }), status: 'eurl-is' });
    const high = computeEurlIs({ profile: makeProfile({ ...baseSociete, capitalPlusCCA: 200_000 }), status: 'eurl-is' });
    expect(high.dividendes).toBeCloseTo(low.dividendes, 0);
  });

  it('degenerates cleanly at partDividendes=0 (no dividends, no PFU prélèvements)', () => {
    const profile = makeProfile({ ...baseSociete, partDividendes: 0, capitalPlusCCA: 1_000 });
    const r = computeEurlIs({ profile, status: 'eurl-is' });
    expect(r.dividendes).toBe(0);
    expect(r.dividendesNets).toBe(0);
    expect(r.cotisations).toBeGreaterThan(0); // rémunération cotisations remain
  });

  it('respects CONV-5: tauxGlobal = 1 − netDisponible / caTotal', () => {
    const profile = makeProfile({ ...baseSociete, capitalPlusCCA: 1_000 });
    const r = computeEurlIs({ profile, status: 'eurl-is' });
    expect(r.tauxGlobal).toBeCloseTo(1 - r.netDisponible / 90_000, 3);
  });

  it('returns a result satisfying the IS Zod output contract', () => {
    const profile = makeProfile({ ...baseSociete, capitalPlusCCA: 1_000 });
    const r = computeEurlIs({ profile, status: 'eurl-is' });
    expect(() => statusResultISValidation.parse(r)).not.toThrow();
  });
});

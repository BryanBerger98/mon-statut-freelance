import { describe, expect, it } from 'vitest';
import { makeProfile } from '../__test-utils__/make-profile';
import { computeEiReel } from '../statuses/ei-reel';
import { computeEurlIr } from '../statuses/eurl-ir';
import { statusResultValidation } from '../validation';

describe('computeEiReel', () => {
  // Structural / ledger tests, NOT frozen oracle values: the TNS-au-réel path rides FLAGGED
  // constants (TNS_IJ_TAUX_PL, TNS_ASSIETTE_MIN_*, ACRE_REEL_TAUX_EXO) — freezing a hard net
  // would assert an unsourced number (calc.md §1.6). These identities hold rate-independently
  // and catch transcription / bucketing bugs.

  it('conserves the ledger: cotisations + impot + net + cfe = revenu brut', () => {
    const profile = makeProfile({ caServiceBNC: 50_000, chargesReelles: 10_000, activiteSousType: 'regime_general' });
    const r = computeEiReel({ profile, status: 'ei-reel' });
    const revenuBrut = 50_000 - 10_000;
    expect(r.cotisations + r.impot + r.netDisponible + (r.cfe ?? 0)).toBeCloseTo(revenuBrut, 0);
  });

  it('respects CONV-5: tauxGlobal = 1 − netDisponible / caTotal', () => {
    const profile = makeProfile({ caServiceBNC: 50_000, chargesReelles: 10_000 });
    const r = computeEiReel({ profile, status: 'ei-reel' });
    expect(r.tauxGlobal).toBeCloseTo(1 - r.netDisponible / 50_000, 3);
  });

  it('keeps cotisations non-increasing as déductible charges rise (assiette monotonic)', () => {
    const low = computeEiReel({ profile: makeProfile({ caServiceBNC: 60_000, chargesReelles: 5_000 }), status: 'ei-reel' });
    const high = computeEiReel({ profile: makeProfile({ caServiceBNC: 60_000, chargesReelles: 20_000 }), status: 'ei-reel' });
    expect(high.cotisations).toBeLessThanOrEqual(low.cotisations);
  });

  it('is mechanically identical to eurl-ir (only the status label differs)', () => {
    const profile = makeProfile({ caServiceBNC: 50_000, chargesReelles: 12_000, firstYear: true });
    const ei = computeEiReel({ profile, status: 'ei-reel' });
    const eurl = computeEurlIr({ profile, status: 'eurl-ir' });
    expect(ei.status).toBe('ei-reel');
    expect(eurl.status).toBe('eurl-ir');
    expect({ ...ei, status: 'eurl-ir' }).toEqual(eurl);
  });

  it('returns a result satisfying the Zod output contract', () => {
    const profile = makeProfile({ caServiceBNC: 50_000, chargesReelles: 10_000 });
    const r = computeEiReel({ profile, status: 'ei-reel' });
    expect(() => statusResultValidation.parse(r)).not.toThrow();
  });
});

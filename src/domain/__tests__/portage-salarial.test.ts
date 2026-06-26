import { describe, expect, it } from 'vitest';
import { makeProfile } from '../__test-utils__/make-profile';
import { PASS_ANNUEL, PORTAGE_FRAIS_GESTION, PORTAGE_SALAIRE_MIN_REF } from '../constants';
import { computeRegimeGeneral } from '../helpers/regime-general';
import { computePortage } from '../statuses/portage-salarial';
import { statusResultValidation } from '../validation';

describe('computePortage', () => {
  // Structural / ledger tests, NOT frozen oracle values: the régime-général path rides FLAGGED
  // constants (calc.md §1.6). These identities hold rate-independently and catch transcription /
  // envelope-resolution / abattement bugs. SS_AT_MP_TAUX comes from makeProfile.

  it('conserves the ledger: fraisGestion + cotisations + impot + net = caTotal', () => {
    const profile = makeProfile({ caServiceBIC: 90_000 });
    const r = computePortage({ profile, status: 'portage-salarial' });
    expect((r.fraisGestion ?? 0) + r.cotisations + r.impot + r.netDisponible).toBeCloseTo(90_000, 0);
  });

  it('resolves brut so the employer cost closes the chargeable envelope (bisection convergence)', () => {
    const profile = makeProfile({ caServiceBIC: 90_000 });
    const r = computePortage({ profile, status: 'portage-salarial' });
    const brut = r.assietteSociale ?? 0;
    // step-5 patronal (enveloppe − brut, exact) must match the TRUE cascade patronal at that brut.
    const regime = computeRegimeGeneral({ brut, tauxAtMp: profile.tauxAtMp, appliquerRgdu: true, inclureChomageAgs: true });
    expect(Math.abs((r.cotisationsPatronales ?? 0) - regime.cotisationsPatronales)).toBeLessThan(2);
    // envelope identity: brut + patronal = caTotal − fraisGestion.
    expect(brut + (r.cotisationsPatronales ?? 0)).toBeCloseTo(90_000 - (r.fraisGestion ?? 0), 0);
  });

  it('computes frais de gestion per mode: pct (default) vs fixed (capped at caTotal)', () => {
    const pct = computePortage({ profile: makeProfile({ caServiceBIC: 90_000 }), status: 'portage-salarial' });
    expect(pct.fraisGestion).toBeCloseTo(90_000 * PORTAGE_FRAIS_GESTION, 0);
    const fixed = computePortage({
      profile: makeProfile({ caServiceBIC: 90_000, fraisGestionMode: 'fixed', fraisGestionFixe: 6_000 }),
      status: 'portage-salarial',
    });
    expect(fixed.fraisGestion).toBe(6_000);
  });

  it('flags nonViable when CA is too low to reach the salaire-minimum floor, viable otherwise', () => {
    const low = computePortage({ profile: makeProfile({ caServiceBIC: 25_000 }), status: 'portage-salarial' });
    expect(low.nonViable).toBe(true);
    expect(low.assietteSociale ?? 0).toBeLessThan(PORTAGE_SALAIRE_MIN_REF * PASS_ANNUEL);

    const healthy = computePortage({ profile: makeProfile({ caServiceBIC: 90_000 }), status: 'portage-salarial' });
    expect(healthy.nonViable).toBe(false);
    expect(healthy.assietteSociale ?? 0).toBeGreaterThanOrEqual(PORTAGE_SALAIRE_MIN_REF * PASS_ANNUEL);
  });

  it('respects CONV-5: tauxGlobal = 1 − netDisponible / caTotal', () => {
    const profile = makeProfile({ caServiceBIC: 90_000 });
    const r = computePortage({ profile, status: 'portage-salarial' });
    expect(r.tauxGlobal).toBeCloseTo(1 - r.netDisponible / 90_000, 3);
  });

  it('returns a result satisfying the Zod output contract', () => {
    const profile = makeProfile({ caServiceBIC: 90_000 });
    const r = computePortage({ profile, status: 'portage-salarial' });
    expect(() => statusResultValidation.parse(r)).not.toThrow();
  });
});

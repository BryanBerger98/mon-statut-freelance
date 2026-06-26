import { describe, expect, it } from 'vitest';
import { makeProfile } from '../__test-utils__/make-profile';
import { computeSasuIs } from '../statuses/sasu-is';

describe('computeSasuIs', () => {
  // Fixture P09 — SASU-IS, président takes ZERO rémunération, distributes 100 % of
  // post-IS résultat as dividends, célibataire. The flagship computable IS fixture:
  // zero pay ⇒ zero cotisations sociales; IS + PFU split are fully determinate.
  it('freezes P09 (zero pay, all dividends): cotisations / impot / net / taux / is / dividendesNets', () => {
    const profile = makeProfile({
      caServiceBIC: 90_000,
      chargesReelles: 10_000,
      situationFamiliale: 'celibataire',
      nbParts: 1,
      remunerationChoisie: 0,
      capitalPlusCCA: 1_000,
      partDividendes: 1,
      optionBaremeDividendes: false,
      firstYear: false,
      dateDebutActivite: '2021-01-01',
      clienteleB2B: true,
      activiteSousType: 'regime_general',
    });

    const result = computeSasuIs({ profile, status: 'sasu-is' });

    expect(result.status).toBe('sasu-is');
    expect(result.cotisations).toBeCloseTo(11_950.5, 0); // CONV-3: pfuDivPS = 0.186 × 64 250
    expect(result.impot).toBeCloseTo(23_974, 0); // IS 15 750 + pfuDivIR 8 224
    expect(result.netDisponible).toBeCloseTo(44_075.5, 0);
    expect(result.tauxGlobal).toBeCloseTo(0.5103, 3);
    expect(result.is).toBeCloseTo(15_750, 0);
    expect(result.dividendesNets).toBeCloseTo(44_075.5, 0);
    expect(result.remunerationShare).toBeCloseTo(0, 3);
  });
});

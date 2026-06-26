import { describe, expect, it } from 'vitest';
import { makeProfile } from '../__test-utils__/make-profile';
import { computeSasuIr } from '../statuses/sasu-ir';

describe('computeSasuIr', () => {
  // Fixture P13 — SASU ayant opté pour l'IR (transparence, ≤ 5 ans), président ZERO
  // rémunération, célibataire. Fully computable: zero pay ⇒ zero cotisations, the whole
  // bénéfice taxed at the household IR (no dividends path while IR-transparent, D8).
  it('freezes P13 (zero pay): cotisations / impot / net / taux / optionIRValid', () => {
    const profile = makeProfile({
      caServiceBIC: 60_000,
      chargesReelles: 8_000,
      situationFamiliale: 'celibataire',
      nbParts: 1,
      remunerationChoisie: 0,
      capitalPlusCCA: 1_000,
      partDividendes: 0,
      optionBaremeDividendes: false,
      firstYear: false,
      dateDebutActivite: '2023-01-01',
      clienteleB2B: true,
      activiteSousType: 'regime_general',
    });

    const result = computeSasuIr({ profile, status: 'sasu-ir' });

    expect(result.status).toBe('sasu-ir');
    expect(result.cotisations).toBeCloseTo(0, 0);
    expect(result.impot).toBeCloseTo(8_704, 0); // 1977.69 + 0.30 × (52 000 − 29 579) = 8 703.99
    expect(result.netDisponible).toBeCloseTo(43_296, 0);
    expect(result.tauxGlobal).toBeCloseTo(0.2784, 3);
    expect(result.optionIRValid).toBe(true); // 2026 − 2023 = 3 < 5 exercices
  });
});

import { describe, expect, it } from 'vitest';
import {
  applyBaremeIR,
  applyDecote,
  applyQuotientFamilial,
  computeImpotRevenu,
  computeMarginalImpotRevenu,
  householdBaseParts,
} from '../impot-revenu';

describe('applyBaremeIR', () => {
  it('returns 0 below the first taxable bracket', () => {
    expect(applyBaremeIR(11_600)).toBe(0);
  });

  it('taxes only the fraction inside each bracket', () => {
    // 16 500 → (16 500 − 11 600) × 11 % = 539
    expect(applyBaremeIR(16_500)).toBeCloseTo(539, 2);
  });

  it('spans into the 30 % bracket', () => {
    // 46 400 → 17 979 × 11 % + (46 400 − 29 579) × 30 % = 1 977.69 + 5 046.30
    expect(applyBaremeIR(46_400)).toBeCloseTo(7_023.99, 2);
  });
});

describe('householdBaseParts', () => {
  it('returns 1 part for a single person', () => {
    expect(householdBaseParts('celibataire')).toBe(1);
  });

  it('returns 2 parts for a couple', () => {
    expect(householdBaseParts('marie_pacse')).toBe(2);
  });
});

describe('applyQuotientFamilial', () => {
  it('scales the per-part barème back by the number of parts for a couple', () => {
    // 57 500 / 2 = 28 750 → 1 886.5 ; × 2 = 3 773 (no plafonnement at the base parts)
    expect(applyQuotientFamilial({ revenuImposableTotal: 57_500, nbParts: 2, situationFamiliale: 'marie_pacse' })).toBeCloseTo(3_773, 2);
  });

  it('caps the advantage of an extra half-part (QF plafonnement)', () => {
    // Single person, 2.5 parts, total 60 000:
    //   impotFamilial = applyBaremeIR(24 000) × 2.5 = 3 410
    //   impotBase     = applyBaremeIR(60 000)       = 11 103.99
    //   avantage 7 693.99 > avantageMax (3 half-parts × 1 807 = 5 421)
    //   → capped IR = 11 103.99 − 5 421 = 5 682.99
    const withCap = applyQuotientFamilial({ revenuImposableTotal: 60_000, nbParts: 2.5, situationFamiliale: 'celibataire' });
    expect(withCap).toBeCloseTo(5_682.99, 2);
  });
});

describe('applyDecote', () => {
  it('wipes a small IR to 0 for a single person', () => {
    // seuil 897 − 0.4525 × 539 = 653.11 > 539 → décote ≥ IR → 0
    expect(applyDecote({ impot: 539, situationFamiliale: 'celibataire' })).toBe(0);
  });

  it('reduces but does not wipe a mid IR', () => {
    // 924 − (897 − 0.4525 × 924) = 924 − 478.89 = 445.11
    expect(applyDecote({ impot: 924, situationFamiliale: 'celibataire' })).toBeCloseTo(445.11, 2);
  });

  it('leaves a high IR untouched once the décote floors at 0', () => {
    expect(applyDecote({ impot: 7_023.99, situationFamiliale: 'celibataire' })).toBeCloseTo(7_023.99, 2);
  });
});

describe('computeImpotRevenu', () => {
  it('applies barème then décote on the foyer total', () => {
    expect(computeImpotRevenu({ revenuImposable: 16_500, autresRevenusFoyer: 0, nbParts: 1, situationFamiliale: 'celibataire' })).toBe(0);
  });
});

describe('computeMarginalImpotRevenu', () => {
  it('returns IR(rev + autres) − IR(autres) at constant parts', () => {
    const marginal = computeMarginalImpotRevenu({
      revenuImposable: 27_500,
      autresRevenusFoyer: 30_000,
      nbParts: 2,
      situationFamiliale: 'marie_pacse',
    });
    expect(marginal).toBeCloseTo(3_773, 2);
  });
});

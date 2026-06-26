import { describe, expect, it } from 'vitest';
import { RGDU_COEFF_MAX, RGDU_SMIC_PLAFOND_MULTIPLE, SMIC_ANNUEL_BRUT } from '../../constants';
import { reductionGeneraleDegressive } from '../rgdu';

describe('reductionGeneraleDegressive', () => {
  it('returns 0 for a non-positive brut', () => {
    expect(reductionGeneraleDegressive(0)).toBe(0);
    expect(reductionGeneraleDegressive(-1_000)).toBe(0);
  });

  it('reaches the maximum coefficient at 1 SMIC', () => {
    // bracket = 0.5 × (3 − 1) = 1 → coeff = RGDU_COEFF_MAX
    expect(reductionGeneraleDegressive(SMIC_ANNUEL_BRUT)).toBeCloseTo(RGDU_COEFF_MAX * SMIC_ANNUEL_BRUT, 6);
  });

  it('clamps to the maximum coefficient below 1 SMIC', () => {
    // brut = 0.5 SMIC → bracket = 2.5, coeff candidate ≫ max → clamped to RGDU_COEFF_MAX
    const brut = 0.5 * SMIC_ANNUEL_BRUT;
    expect(reductionGeneraleDegressive(brut)).toBeCloseTo(RGDU_COEFF_MAX * brut, 6);
  });

  it('returns 0 at and above 3 SMIC (the plafond)', () => {
    const plafond = RGDU_SMIC_PLAFOND_MULTIPLE * SMIC_ANNUEL_BRUT;
    expect(reductionGeneraleDegressive(plafond)).toBe(0);
    expect(reductionGeneraleDegressive(plafond + 10_000)).toBe(0);
  });

  it('is strictly between 0 and the max in the degressive band', () => {
    // brut = 2 SMIC sits inside (1 SMIC, 3 SMIC)
    const brut = 2 * SMIC_ANNUEL_BRUT;
    const reduction = reductionGeneraleDegressive(brut);
    expect(reduction).toBeGreaterThan(0);
    expect(reduction).toBeLessThan(RGDU_COEFF_MAX * brut);
  });

  it('decreases as the gross salary rises across the band', () => {
    const low = reductionGeneraleDegressive(1.5 * SMIC_ANNUEL_BRUT) / (1.5 * SMIC_ANNUEL_BRUT);
    const high = reductionGeneraleDegressive(2.5 * SMIC_ANNUEL_BRUT) / (2.5 * SMIC_ANNUEL_BRUT);
    expect(high).toBeLessThan(low);
  });
});

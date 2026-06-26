import { describe, expect, it } from 'vitest';
import { PASS_ANNUEL, TNS_ALLOC_FAM_BAREME, TNS_MALADIE_BAREME } from '../../constants';
import { globalRateCurveCotisation, interpolateGlobalRate } from '../global-rate-curve';

describe('interpolateGlobalRate', () => {
  it('returns the first knot rate below the first knot (flat extrapolation)', () => {
    // maladie: < 0.2 PASS → 0
    expect(interpolateGlobalRate({ curve: TNS_MALADIE_BAREME, fractionPass: 0.1 })).toBe(0);
  });

  it('returns the exact rate at a knot', () => {
    // maladie knot [0.4, 0.015]
    expect(interpolateGlobalRate({ curve: TNS_MALADIE_BAREME, fractionPass: 0.4 })).toBeCloseTo(0.015, 6);
  });

  it('linearly interpolates between two knots', () => {
    // maladie between [0.4, 0.015] and [0.6, 0.04] at 0.5 → midpoint 0.0275
    expect(interpolateGlobalRate({ curve: TNS_MALADIE_BAREME, fractionPass: 0.5 })).toBeCloseTo(0.0275, 6);
  });

  it('returns the last knot rate above the last knot (flat extrapolation)', () => {
    // maladie last knot [3.0, 0.085]
    expect(interpolateGlobalRate({ curve: TNS_MALADIE_BAREME, fractionPass: 5 })).toBeCloseTo(0.085, 6);
  });
});

describe('globalRateCurveCotisation', () => {
  it('returns 0 for a non-positive assiette', () => {
    expect(globalRateCurveCotisation({ assiette: 0, curve: TNS_MALADIE_BAREME })).toBe(0);
  });

  it('applies the interpolated global rate below the marginal threshold (maladie)', () => {
    // assiette 0.5 PASS, rate 0.0275, no marginal band
    const assiette = 0.5 * PASS_ANNUEL;
    expect(globalRateCurveCotisation({ assiette, curve: TNS_MALADIE_BAREME })).toBeCloseTo(0.0275 * assiette, 4);
  });

  it('caps the global base at the marginal threshold and adds the marginal rate (maladie > 3 PASS)', () => {
    // assiette 4 PASS: 0.085 × 3 PASS + 0.065 × 1 PASS
    const assiette = 4 * PASS_ANNUEL;
    const expected = 0.085 * 3 * PASS_ANNUEL + 0.065 * PASS_ANNUEL;
    expect(globalRateCurveCotisation({ assiette, curve: TNS_MALADIE_BAREME })).toBeCloseTo(expected, 2);
  });

  it('charges 0 alloc-fam below the lower knot (≤ 1.1 PASS)', () => {
    expect(globalRateCurveCotisation({ assiette: PASS_ANNUEL, curve: TNS_ALLOC_FAM_BAREME })).toBe(0);
  });

  it('applies the full alloc-fam rate over the whole assiette above the upper knot (no marginal band)', () => {
    // assiette 2 PASS, rate plateau 0.031, marginalSeuilPass = +∞ → whole assiette
    const assiette = 2 * PASS_ANNUEL;
    expect(globalRateCurveCotisation({ assiette, curve: TNS_ALLOC_FAM_BAREME })).toBeCloseTo(0.031 * assiette, 4);
  });
});

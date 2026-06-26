import { describe, expect, it } from 'vitest';
import { PASS_ANNUEL } from '../../constants';
import { clampMontant, trancheMontant } from '../pass';

describe('trancheMontant', () => {
  it('returns the full assiette when the band starts at 0 and exceeds it', () => {
    expect(trancheMontant({ assiette: 30_000, lowPass: 0, highPass: 1 })).toBe(30_000);
  });

  it('caps the slice at the upper PASS bound', () => {
    // assiette 100 000, band 0 → 1 PASS → exactly 1 PASS
    expect(trancheMontant({ assiette: 100_000, lowPass: 0, highPass: 1 })).toBeCloseTo(PASS_ANNUEL, 2);
  });

  it('extracts an intermediate band [1 PASS, 4 PASS]', () => {
    // assiette 100 000 → min(100 000, 4 PASS) − 1 PASS
    const expected = Math.min(100_000, 4 * PASS_ANNUEL) - PASS_ANNUEL;
    expect(trancheMontant({ assiette: 100_000, lowPass: 1, highPass: 4 })).toBeCloseTo(expected, 2);
  });

  it('returns 0 when the assiette is below the band floor', () => {
    expect(trancheMontant({ assiette: 20_000, lowPass: 1, highPass: 4 })).toBe(0);
  });

  it('treats an infinite upper bound as uncapped (totalité above the floor)', () => {
    expect(trancheMontant({ assiette: 100_000, lowPass: 1, highPass: Number.POSITIVE_INFINITY })).toBeCloseTo(100_000 - PASS_ANNUEL, 2);
  });
});

describe('clampMontant', () => {
  it('passes a value already inside the bounds through unchanged', () => {
    expect(clampMontant({ value: 5_000, min: 800, max: 60_000 })).toBe(5_000);
  });

  it('raises a value below the plancher', () => {
    expect(clampMontant({ value: 200, min: 845.86, max: 62_478 })).toBe(845.86);
  });

  it('caps a value above the plafond', () => {
    expect(clampMontant({ value: 80_000, min: 845.86, max: 62_478 })).toBe(62_478);
  });
});

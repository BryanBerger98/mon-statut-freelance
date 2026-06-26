import { describe, expect, it } from 'vitest';
import { computeImpotSocietes } from '../is';

describe('computeImpotSocietes', () => {
  it('returns 0 for a non-positive base', () => {
    expect(computeImpotSocietes({ baseIS: 0, caTotal: 50_000 })).toBe(0);
    expect(computeImpotSocietes({ baseIS: -1_000, caTotal: 50_000 })).toBe(0);
  });

  it('applies only the reduced rate below the reduced-bracket plafond', () => {
    // 30 000 × 15 %
    expect(computeImpotSocietes({ baseIS: 30_000, caTotal: 100_000 })).toBeCloseTo(4_500, 2);
  });

  it('splits across the reduced and normal brackets (P09 base 80 000)', () => {
    // 0.15 × 42 500 + 0.25 × 37 500 = 6 375 + 9 375 = 15 750
    expect(computeImpotSocietes({ baseIS: 80_000, caTotal: 90_000 })).toBeCloseTo(15_750, 2);
  });

  it('drops the reduced rate above the PME CA gate (whole base at normal rate)', () => {
    // CA > 10 M€ → 0.25 × 50 000
    expect(computeImpotSocietes({ baseIS: 50_000, caTotal: 12_000_000 })).toBeCloseTo(12_500, 2);
  });
});

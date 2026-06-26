import { describe, expect, it } from 'vitest';
import { computeDividendesTax } from '../pfu';

describe('computeDividendesTax', () => {
  it('splits the PFU into PS (cotisations) and flat IR parts (P09 dividend 64 250)', () => {
    const result = computeDividendesTax({ dividendesCapital: 64_250, optionBaremeDividendes: false });
    expect(result.prelevementsSociaux).toBeCloseTo(11_950.5, 2); // 0.186 × 64 250
    expect(result.flatTaxIR).toBeCloseTo(8_224, 2); // 0.128 × 64 250
    expect(result.baremeImposable).toBe(0);
  });

  it('drops the flat IR part and abates 40 % under the barème option', () => {
    const result = computeDividendesTax({ dividendesCapital: 10_000, optionBaremeDividendes: true });
    expect(result.prelevementsSociaux).toBeCloseTo(1_860, 2); // PS still applies on the gross
    expect(result.flatTaxIR).toBe(0);
    expect(result.baremeImposable).toBeCloseTo(6_000, 2); // 10 000 × (1 − 0.40)
  });

  it('returns zero components for a zero dividend', () => {
    const result = computeDividendesTax({ dividendesCapital: 0, optionBaremeDividendes: false });
    expect(result.prelevementsSociaux).toBe(0);
    expect(result.flatTaxIR).toBe(0);
    expect(result.baremeImposable).toBe(0);
  });
});

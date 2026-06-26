import { describe, expect, it } from 'vitest';
import { roundTaux, roundToEuros } from '../money';

describe('roundToEuros', () => {
  it('rounds to 2 decimals', () => {
    expect(roundToEuros(20_250.005)).toBe(20_250.01);
  });

  it('leaves a 2-decimal amount unchanged', () => {
    expect(roundToEuros(28_954.89)).toBe(28_954.89);
  });
});

describe('roundTaux', () => {
  it('rounds to 4 decimals', () => {
    expect(roundTaux(0.345422)).toBe(0.3454);
  });

  it('leaves a 4-decimal ratio unchanged', () => {
    expect(roundTaux(0.19)).toBe(0.19);
  });
});

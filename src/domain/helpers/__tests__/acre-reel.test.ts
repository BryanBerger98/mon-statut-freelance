import { describe, expect, it } from 'vitest';
import { ACRE_REEL_DEGRESSIVITE_PLAFOND_PASS, ACRE_REEL_PLAFOND_REVENU_PASS, ACRE_REEL_TAUX_EXO, PASS_ANNUEL } from '../../constants';
import { acreReelExoTaux } from '../acre-reel';

describe('acreReelExoTaux', () => {
  it('grants the full exonération rate at and below the plein plafond (0,75 PASS)', () => {
    expect(acreReelExoTaux(0)).toBe(ACRE_REEL_TAUX_EXO);
    expect(acreReelExoTaux(0.5 * PASS_ANNUEL)).toBe(ACRE_REEL_TAUX_EXO);
    expect(acreReelExoTaux(ACRE_REEL_PLAFOND_REVENU_PASS * PASS_ANNUEL)).toBe(ACRE_REEL_TAUX_EXO);
  });

  it('grants no exonération at and above the degressivité plafond (1 PASS)', () => {
    expect(acreReelExoTaux(ACRE_REEL_DEGRESSIVITE_PLAFOND_PASS * PASS_ANNUEL)).toBe(0);
    expect(acreReelExoTaux(2 * PASS_ANNUEL)).toBe(0);
  });

  it('halves the rate at the mid-point of the degressive band (0,875 PASS)', () => {
    // midpoint of [0,75 PASS, 1 PASS] → coeff = 0.5
    const midpoint = 0.5 * (ACRE_REEL_PLAFOND_REVENU_PASS + ACRE_REEL_DEGRESSIVITE_PLAFOND_PASS) * PASS_ANNUEL;
    expect(acreReelExoTaux(midpoint)).toBeCloseTo(ACRE_REEL_TAUX_EXO * 0.5, 10);
  });

  it('decreases monotonically across the degressive band', () => {
    const low = acreReelExoTaux(0.8 * PASS_ANNUEL);
    const high = acreReelExoTaux(0.9 * PASS_ANNUEL);
    expect(high).toBeLessThan(low);
    expect(high).toBeGreaterThan(0);
  });
});

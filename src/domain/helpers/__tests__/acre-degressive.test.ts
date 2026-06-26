import { describe, expect, it } from 'vitest';
import { ACRE_ASSIMILE_TAUX_EXO, ACRE_REEL_DEGRESSIVITE_PLAFOND_PASS, ACRE_REEL_PLAFOND_REVENU_PASS, PASS_ANNUEL } from '../../constants';
import { acreAssimileExoTaux, acreDegressiveExoTaux } from '../acre-degressive';

const plein = ACRE_REEL_PLAFOND_REVENU_PASS * PASS_ANNUEL;
const nul = ACRE_REEL_DEGRESSIVITE_PLAFOND_PASS * PASS_ANNUEL;

describe('acreDegressiveExoTaux', () => {
  const band = {
    tauxExo: ACRE_ASSIMILE_TAUX_EXO,
    plafondPleinPass: ACRE_REEL_PLAFOND_REVENU_PASS,
    plafondNulPass: ACRE_REEL_DEGRESSIVITE_PLAFOND_PASS,
  } as const;

  it('returns the full rate at or below the plein plafond', () => {
    expect(acreDegressiveExoTaux({ ...band, assiette: 0 })).toBe(ACRE_ASSIMILE_TAUX_EXO);
    expect(acreDegressiveExoTaux({ ...band, assiette: plein })).toBe(ACRE_ASSIMILE_TAUX_EXO);
  });

  it('returns nil at or above the nul plafond', () => {
    expect(acreDegressiveExoTaux({ ...band, assiette: nul })).toBe(0);
    expect(acreDegressiveExoTaux({ ...band, assiette: nul + 1 })).toBe(0);
  });

  it('returns the linear midpoint rate halfway through the band', () => {
    const milieu = (plein + nul) / 2;
    expect(acreDegressiveExoTaux({ ...band, assiette: milieu })).toBeCloseTo(ACRE_ASSIMILE_TAUX_EXO * 0.5, 10);
  });
});

describe('acreAssimileExoTaux', () => {
  it('applies the assimilé full rate for a brut below the plein plafond', () => {
    expect(acreAssimileExoTaux(plein - 1)).toBe(ACRE_ASSIMILE_TAUX_EXO);
  });

  it('decreases monotonically across the degressive band and is nil above it', () => {
    const milieu = (plein + nul) / 2;
    expect(acreAssimileExoTaux(milieu)).toBeLessThan(ACRE_ASSIMILE_TAUX_EXO);
    expect(acreAssimileExoTaux(milieu)).toBeGreaterThan(0);
    expect(acreAssimileExoTaux(nul)).toBe(0);
  });
});

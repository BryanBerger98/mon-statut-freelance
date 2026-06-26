import { describe, expect, it } from 'vitest';
import { AGS_PAT, CHOMAGE_PAT, PASS_ANNUEL, SS_AT_MP_TAUX } from '../../constants';
import { computeRegimeGeneral } from '../regime-general';

describe('computeRegimeGeneral', () => {
  it('returns all-zero components for a zero gross salary', () => {
    const result = computeRegimeGeneral({ brut: 0, tauxAtMp: SS_AT_MP_TAUX, appliquerRgdu: false, inclureChomageAgs: false });
    expect(result).toEqual({
      cotisationsSalariales: 0,
      cotisationsPatronales: 0,
      reductionRgdu: 0,
      net: 0,
      coutTotalEmployeur: 0,
      csgCrdsNonDeduct: 0,
      acreExoneration: 0,
    });
  });

  it('computes the full T1-only cascade at brut = 1 PASS (sasu case: no RGDU, no chômage)', () => {
    // brut = 48 060 (= 1 PASS) → T2 = 0, hand-derived from the §B.2 rates.
    const result = computeRegimeGeneral({ brut: PASS_ANNUEL, tauxAtMp: SS_AT_MP_TAUX, appliquerRgdu: false, inclureChomageAgs: false });
    expect(result.cotisationsSalariales).toBeCloseTo(10_094.64, 1);
    expect(result.cotisationsPatronales).toBeCloseTo(18_741.48, 1);
    expect(result.net).toBeCloseTo(37_965.36, 1);
    expect(result.coutTotalEmployeur).toBeCloseTo(66_801.48, 1);
    expect(result.csgCrdsNonDeduct).toBeCloseTo(1_369.35, 1);
    expect(result.reductionRgdu).toBe(0);
  });

  it('keeps the gross = net + salarial-cotisations identity', () => {
    const result = computeRegimeGeneral({ brut: 60_000, tauxAtMp: SS_AT_MP_TAUX, appliquerRgdu: false, inclureChomageAgs: false });
    expect(result.net + result.cotisationsSalariales).toBeCloseTo(60_000, 6);
    expect(result.coutTotalEmployeur).toBeCloseTo(60_000 + result.cotisationsPatronales, 6);
  });

  it('applies the RGDU only when enabled, reducing the patronal block (portage)', () => {
    const base = { brut: 48_060, tauxAtMp: SS_AT_MP_TAUX, inclureChomageAgs: false } as const;
    const sansRgdu = computeRegimeGeneral({ ...base, appliquerRgdu: false });
    const avecRgdu = computeRegimeGeneral({ ...base, appliquerRgdu: true });
    expect(avecRgdu.reductionRgdu).toBeGreaterThan(0);
    expect(avecRgdu.cotisationsPatronales).toBeCloseTo(sansRgdu.cotisationsPatronales - avecRgdu.reductionRgdu, 6);
    expect(avecRgdu.cotisationsSalariales).toBeCloseTo(sansRgdu.cotisationsSalariales, 6);
  });

  it('adds chômage + AGS on the capped base when enabled (portage)', () => {
    const base = { brut: 60_000, tauxAtMp: SS_AT_MP_TAUX, appliquerRgdu: false } as const;
    const sans = computeRegimeGeneral({ ...base, inclureChomageAgs: false });
    const avec = computeRegimeGeneral({ ...base, inclureChomageAgs: true });
    const delta = avec.cotisationsPatronales - sans.cotisationsPatronales;
    // 60 000 < 4 PASS → whole brut bears chômage + AGS
    expect(delta).toBeCloseTo((CHOMAGE_PAT + AGS_PAT) * 60_000, 4);
  });

  it('splits the assimilé ACRE exonération across salariales and patronales (firstYear président)', () => {
    const base = { brut: 30_000, tauxAtMp: SS_AT_MP_TAUX, appliquerRgdu: false, inclureChomageAgs: false } as const;
    const sans = computeRegimeGeneral(base);
    const avec = computeRegimeGeneral({ ...base, acreExoTaux: 0.25 });
    expect(avec.acreExoneration).toBeGreaterThan(0);
    expect(avec.cotisationsSalariales).toBeLessThan(sans.cotisationsSalariales);
    expect(avec.cotisationsPatronales).toBeLessThan(sans.cotisationsPatronales);
    // The exonération equals exactly the drop on both sides combined.
    const deltaSal = sans.cotisationsSalariales - avec.cotisationsSalariales;
    const deltaPat = sans.cotisationsPatronales - avec.cotisationsPatronales;
    expect(deltaSal + deltaPat).toBeCloseTo(avec.acreExoneration, 6);
    // CSG-CRDS is out of ACRE scope → the non-deductible piece is unchanged.
    expect(avec.csgCrdsNonDeduct).toBeCloseTo(sans.csgCrdsNonDeduct, 6);
  });
});

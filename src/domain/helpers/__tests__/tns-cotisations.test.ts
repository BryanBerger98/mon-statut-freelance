import { describe, expect, it } from 'vitest';
import {
  CRDS_TAUX,
  CSG_NON_DEDUCTIBLE_TAUX,
  PASS_ANNUEL,
  TNS_CFP_TAUX_COMMERCANT_PL,
  TNS_IJ_PLAFOND_PASS_ARTISAN_COMMERCANT,
  TNS_IJ_TAUX_ARTISAN_COMMERCANT,
} from '../../constants';
import type { TnsCotisationsDetail } from '../tns-cotisations';
import { computeTnsCotisations, resolveTnsRegime } from '../tns-cotisations';

// Structural / invariant suite. The §A.3 cascade composes several FLAGGED numeric
// leaves (IJ taux PL, the three minimal-assiette floors, all CIPAV rates, the ACRE
// réel rate) still under verification by tax-social-modeler — so these tests assert
// the cascade's STRUCTURE and INVARIANTS (split identity, floors, ACRE scoping,
// régime routing, monotonicity, IJ capping), never a frozen headline euro figure.
// No réel-TNS fixture is frozen until the agent's verdict lands.

const sumDetail = (d: TnsCotisationsDetail): number =>
  d.maladie +
  d.ij +
  d.retraiteBasePlafonnee +
  d.retraiteBaseDeplafonnee +
  d.retraiteComplT1 +
  d.retraiteComplT2 +
  d.invalidite +
  d.allocationsFamiliales +
  d.csgDeductible +
  d.csgCrdsNonDeduct +
  d.cfp;

describe('computeTnsCotisations', () => {
  it('keeps the déductible / non-déductible split summing to the total', () => {
    const r = computeTnsCotisations({ assietteTNS: 50_000, regime: 'artisan_commercant', acreExoTaux: 0 });
    expect(r.cotisationsDeductibles + r.cotisationsNonDeduct).toBeCloseTo(r.cotisationsTotales, 6);
  });

  it('reports exactly the CSG non-déductible + CRDS as the non-déductible share', () => {
    const assietteTNS = 50_000;
    const r = computeTnsCotisations({ assietteTNS, regime: 'artisan_commercant', acreExoTaux: 0 });
    expect(r.cotisationsNonDeduct).toBeCloseTo((CSG_NON_DEDUCTIBLE_TAUX + CRDS_TAUX) * assietteTNS, 6);
  });

  it('sums every detail row back to the total when no ACRE applies', () => {
    const r = computeTnsCotisations({ assietteTNS: 50_000, regime: 'artisan_commercant', acreExoTaux: 0 });
    expect(sumDetail(r.detail)).toBeCloseTo(r.cotisationsTotales, 6);
  });

  it('charges the CFP as a flat forfait independent of the assiette', () => {
    const cfpExpected = TNS_CFP_TAUX_COMMERCANT_PL * PASS_ANNUEL;
    const zero = computeTnsCotisations({ assietteTNS: 0, regime: 'artisan_commercant', acreExoTaux: 0 });
    const high = computeTnsCotisations({ assietteTNS: 200_000, regime: 'artisan_commercant', acreExoTaux: 0 });
    expect(zero.detail.cfp).toBeCloseTo(cfpExpected, 6);
    expect(high.detail.cfp).toBeCloseTo(cfpExpected, 6);
  });

  it('applies the §A.4 floors at a nil assiette (floored rows positive, unfloored rows nil)', () => {
    const r = computeTnsCotisations({ assietteTNS: 0, regime: 'artisan_commercant', acreExoTaux: 0 });
    // floored on their own minimal assiette (IJ, retraite de base, invalidité)
    expect(r.detail.ij).toBeGreaterThan(0);
    expect(r.detail.retraiteBasePlafonnee).toBeGreaterThan(0);
    expect(r.detail.retraiteBaseDeplafonnee).toBeGreaterThan(0);
    expect(r.detail.invalidite).toBeGreaterThan(0);
    // no floor → strictly proportional to the (nil) assiette; the maladie minimum was abolished
    expect(r.detail.maladie).toBe(0);
    expect(r.detail.allocationsFamiliales).toBe(0);
    expect(r.detail.retraiteComplT1).toBe(0);
    expect(r.detail.retraiteComplT2).toBe(0);
    expect(r.detail.csgDeductible).toBe(0);
    expect(r.detail.csgCrdsNonDeduct).toBe(0);
  });

  it('applies ACRE only to the in-scope rows and leaves out-of-scope rows untouched', () => {
    const assietteTNS = 30_000;
    const exoTaux = 0.3; // arbitrary sample rate — tests the cascade mechanism, not the (flagged) ACRE value
    const noExo = computeTnsCotisations({ assietteTNS, regime: 'artisan_commercant', acreExoTaux: 0 });
    const withExo = computeTnsCotisations({ assietteTNS, regime: 'artisan_commercant', acreExoTaux: exoTaux });

    // detail rows are pre-exonération → identical between the two runs
    expect(withExo.detail.maladie).toBeCloseTo(noExo.detail.maladie, 6);
    // out-of-scope rows never reduced
    expect(withExo.detail.ij).toBeCloseTo(noExo.detail.ij, 6);
    expect(withExo.detail.retraiteComplT1).toBeCloseTo(noExo.detail.retraiteComplT1, 6);
    expect(withExo.detail.csgDeductible).toBeCloseTo(noExo.detail.csgDeductible, 6);
    expect(withExo.detail.cfp).toBeCloseTo(noExo.detail.cfp, 6);

    const inScope =
      withExo.detail.maladie +
      withExo.detail.retraiteBasePlafonnee +
      withExo.detail.retraiteBaseDeplafonnee +
      withExo.detail.invalidite +
      withExo.detail.allocationsFamiliales;
    expect(withExo.acreExoneration).toBeCloseTo(exoTaux * inScope, 6);
    expect(noExo.cotisationsTotales - withExo.cotisationsTotales).toBeCloseTo(withExo.acreExoneration, 6);
    expect(noExo.acreExoneration).toBe(0);
  });

  it('distinguishes the CIPAV régime from the SSI régime by its retraite rates', () => {
    const assietteTNS = 2 * PASS_ANNUEL;
    const cipav = computeTnsCotisations({ assietteTNS, regime: 'cipav', acreExoTaux: 0 });
    const ssi = computeTnsCotisations({ assietteTNS, regime: 'artisan_commercant', acreExoTaux: 0 });
    // distinct retraite de base plafonnée rate (CIPAV 8,73 % < SSI 17,87 %)
    expect(cipav.detail.retraiteBasePlafonnee).toBeLessThan(ssi.detail.retraiteBasePlafonnee);
    // distinct complémentaire T1 rate (CIPAV 11 % > SSI 8,10 %)
    expect(cipav.detail.retraiteComplT1).toBeGreaterThan(ssi.detail.retraiteComplT1);
    // both have an "above-T1" base slice above 1 PASS, but on different bands/rates
    expect(cipav.detail.retraiteBaseDeplafonnee).toBeGreaterThan(0);
    expect(ssi.detail.retraiteBaseDeplafonnee).toBeGreaterThan(0);
    expect(cipav.detail.retraiteBaseDeplafonnee).not.toBeCloseTo(ssi.detail.retraiteBaseDeplafonnee, 2);
  });

  it('charges the CIPAV retraite-base T2 only on the 1 → 5 PASS band', () => {
    const below = computeTnsCotisations({ assietteTNS: PASS_ANNUEL, regime: 'cipav', acreExoTaux: 0 });
    const above = computeTnsCotisations({ assietteTNS: 2 * PASS_ANNUEL, regime: 'cipav', acreExoTaux: 0 });
    // at exactly 1 PASS the T2 band [1, 5] is empty → nil
    expect(below.detail.retraiteBaseDeplafonnee).toBe(0);
    // above 1 PASS the T2 slice becomes positive
    expect(above.detail.retraiteBaseDeplafonnee).toBeGreaterThan(0);
  });

  it('treats a profession libérale non réglementée identically to an artisan/commerçant (both SSI)', () => {
    const pl = computeTnsCotisations({ assietteTNS: 70_000, regime: 'profession_liberale', acreExoTaux: 0 });
    const ac = computeTnsCotisations({ assietteTNS: 70_000, regime: 'artisan_commercant', acreExoTaux: 0 });
    expect(pl.cotisationsTotales).toBeCloseTo(ac.cotisationsTotales, 6);
    expect(pl.detail.ij).toBeCloseTo(ac.detail.ij, 6);
  });

  it('increases total cotisations with the assiette above the floors', () => {
    const lo = computeTnsCotisations({ assietteTNS: 50_000, regime: 'artisan_commercant', acreExoTaux: 0 });
    const hi = computeTnsCotisations({ assietteTNS: 100_000, regime: 'artisan_commercant', acreExoTaux: 0 });
    expect(hi.cotisationsTotales).toBeGreaterThan(lo.cotisationsTotales);
  });

  it('caps the IJ contribution at its plafond for a high assiette', () => {
    const r = computeTnsCotisations({ assietteTNS: 10 * PASS_ANNUEL, regime: 'artisan_commercant', acreExoTaux: 0 });
    expect(r.detail.ij).toBeCloseTo(TNS_IJ_TAUX_ARTISAN_COMMERCANT * TNS_IJ_PLAFOND_PASS_ARTISAN_COMMERCANT * PASS_ANNUEL, 6);
  });
});

describe('resolveTnsRegime', () => {
  it('routes any CIPAV activity to the cipav régime regardless of the CA mix', () => {
    expect(resolveTnsRegime({ caVente: 100_000, caServiceBIC: 0, caServiceBNC: 0, activiteSousType: 'cipav' })).toBe('cipav');
  });

  it('routes a BNC-dominant activity to profession_liberale', () => {
    expect(resolveTnsRegime({ caVente: 0, caServiceBIC: 0, caServiceBNC: 50_000, activiteSousType: 'regime_general' })).toBe(
      'profession_liberale',
    );
  });

  it('routes a BIC-dominant activity to artisan_commercant', () => {
    expect(resolveTnsRegime({ caVente: 50_000, caServiceBIC: 10_000, caServiceBNC: 0, activiteSousType: 'regime_general' })).toBe(
      'artisan_commercant',
    );
  });

  it('routes a zero-CA profile to artisan_commercant (BIC ≥ BNC tie-break)', () => {
    expect(resolveTnsRegime({ caVente: 0, caServiceBIC: 0, caServiceBNC: 0, activiteSousType: 'regime_general' })).toBe(
      'artisan_commercant',
    );
  });
});

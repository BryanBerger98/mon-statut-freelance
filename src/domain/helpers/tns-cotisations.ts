/**
 * TNS au réel — closed-form cotisation cascade (spec §A.2–§A.5).
 *
 * Drives the social cost of a travailleur non salarié (gérant EURL, entrepreneur
 * individuel au réel) on the reformed 2026 *assiette sociale unique* (décret
 * 2024-688): the 26 % forfait abattement REPLACES the old cotisation-deduction
 * fixed point, so every cotisation is computed once, no iteration. The caller
 * (status module) supplies the already-abated `assietteTNS`.
 *
 * 8-row barème (§A.3), each row's assiette floored per §A.4 where a minimal
 * assiette applies:
 *   1  maladie-maternité      global-rate curve, RAW assiette (the maladie minimum was abolished)
 *   2  indemnités journalières assiette ≥ 0,40 PASS, capped at the régime IJ plafond
 *   3  retraite base plafonnée ≤ 1 PASS of the assiette ≥ 0,115 PASS
 *   3b retraite base déplafonnée SSI: 0,72 % totalité of that floored assiette;
 *                                CIPAV: a T2 slice (1 → 5 PASS), no SSI déplafonnée
 *   4  retraite compl. T1      ≤ 1 PASS, raw assiette (no floor)
 *   4b retraite compl. T2      1 → 4 PASS, raw assiette
 *   5  invalidité-décès        ≤ 1 PASS of the assiette ≥ 0,115 PASS
 *   6  allocations familiales  global-rate curve, raw assiette (no floor)
 *   7  CSG déductible          assiette unique
 *   7b CSG non-déduct. + CRDS  assiette unique — the ONLY non-deductible row
 *   8  CFP                     flat forfait (taux × PASS), always due
 *
 * Régime branch (§A.3 D4): SSI (artisan/commerçant AND professions libérales non
 * réglementées — identical rates since the 2018 réforme) vs CIPAV (regulated
 * professions). Only CIPAV genuinely diverges: its retraite de base/complémentaire
 * follow a points model and its IJ is the CPAM/regulated rate (TNS_IJ_TAUX_PL,
 * 0,30 %/3 PASS) — every SSI insured uses TNS_IJ_TAUX_ARTISAN_COMMERCANT
 * (0,50 %/5 PASS). The maladie, alloc-fam and CSG-CRDS barèmes are national and
 * shared. CIPAV retraite rates remain FLAGGED in constants.ts (under verification);
 * this module references them by name so it stays correct once they are confirmed.
 *
 * ACRE au réel (§D.5) exonerates only the in-scope rows {maladie, retraite base,
 * invalidité, alloc fam}; the caller passes the resolved rate (acre-reel.ts).
 */
import {
  CRDS_TAUX,
  CSG_DEDUCTIBLE_TAUX,
  CSG_NON_DEDUCTIBLE_TAUX,
  PASS_ANNUEL,
  TNS_ALLOC_FAM_BAREME,
  TNS_ASSIETTE_MIN_IJ_PASS,
  TNS_ASSIETTE_MIN_INVALIDITE_PASS,
  TNS_ASSIETTE_MIN_RETRAITE_BASE_PASS,
  TNS_CFP_TAUX_COMMERCANT_PL,
  TNS_IJ_PLAFOND_PASS_ARTISAN_COMMERCANT,
  TNS_IJ_PLAFOND_PASS_PL,
  TNS_IJ_TAUX_ARTISAN_COMMERCANT,
  TNS_IJ_TAUX_PL,
  TNS_INVALIDITE_DECES_TAUX,
  TNS_MALADIE_BAREME,
  TNS_RETRAITE_BASE_CIPAV_PLAFOND_T2_PASS,
  TNS_RETRAITE_BASE_CIPAV_TAUX_T1,
  TNS_RETRAITE_BASE_CIPAV_TAUX_T2,
  TNS_RETRAITE_BASE_TAUX_DEPLAFONNE,
  TNS_RETRAITE_BASE_TAUX_T1,
  TNS_RETRAITE_COMPL_CIPAV_TAUX_T1,
  TNS_RETRAITE_COMPL_CIPAV_TAUX_T2,
  TNS_RETRAITE_COMPL_PLAFOND_T2_PASS,
  TNS_RETRAITE_COMPL_TAUX_T1,
  TNS_RETRAITE_COMPL_TAUX_T2,
} from '../constants';
import type { ActiviteSousType } from '../validation';
import { globalRateCurveCotisation } from './global-rate-curve';
import { trancheMontant } from './pass';

/** TNS régime branch — selects the IJ / CFP / retraite rates (§A.3 D4). */
export type TnsRegime = 'artisan_commercant' | 'profession_liberale' | 'cipav';

/** Per-row TNS cotisation breakdown (the "why" surfaced by the status result). */
export type TnsCotisationsDetail = {
  maladie: number;
  ij: number;
  retraiteBasePlafonnee: number;
  retraiteBaseDeplafonnee: number;
  retraiteComplT1: number;
  retraiteComplT2: number;
  invalidite: number;
  allocationsFamiliales: number;
  csgDeductible: number;
  csgCrdsNonDeduct: number;
  cfp: number;
};

/** Result of the TNS cascade: totals, the deductible/non-deductible split, the per-row detail. */
export type TnsCotisationsResult = {
  cotisationsTotales: number;
  cotisationsDeductibles: number;
  cotisationsNonDeduct: number;
  acreExoneration: number;
  detail: TnsCotisationsDetail;
};

type TnsRegimeParams = {
  ijTaux: number;
  ijPlafondPass: number;
  cfpTaux: number;
  retraiteBaseT1Taux: number;
  /** Rate of the retraite-de-base "above T1" slice: SSI 0,72 % totalité, CIPAV its T2 rate. */
  retraiteBaseDeplafonneTaux: number;
  /** Lower bound (PASS) of that slice: SSI 0 (totalité), CIPAV 1 PASS. */
  retraiteBaseDeplafonneLowPass: number;
  /** Upper bound (PASS) of that slice: SSI +∞ (totalité), CIPAV 5 PASS. */
  retraiteBaseDeplafonneHighPass: number;
  retraiteComplT1Taux: number;
  retraiteComplT2Taux: number;
};

/**
 * Resolves the rate set for a TNS régime branch (§A.3 D4).
 * Only CIPAV diverges: artisan/commerçant and professions libérales non
 * réglementées share the SSI rate set (identical since the 2018 réforme), so they
 * fall through to the same branch. CFP uses the commerçant/PL rate everywhere —
 * the app's BIC streams model vente/services prestataires, not artisans inscrits
 * au répertoire des métiers. SSI retraite de base is "déplafonnée totalité" at
 * 0,72 % (band [0, +∞)); CIPAV has no SSI déplafonnée but a base T2 slice
 * (1 → 5 PASS) and the CPAM/regulated IJ (TNS_IJ_TAUX_PL).
 */
const resolveTnsRegimeParams = (regime: TnsRegime): TnsRegimeParams => {
  switch (regime) {
    case 'cipav':
      return {
        ijTaux: TNS_IJ_TAUX_PL,
        ijPlafondPass: TNS_IJ_PLAFOND_PASS_PL,
        cfpTaux: TNS_CFP_TAUX_COMMERCANT_PL,
        retraiteBaseT1Taux: TNS_RETRAITE_BASE_CIPAV_TAUX_T1,
        retraiteBaseDeplafonneTaux: TNS_RETRAITE_BASE_CIPAV_TAUX_T2,
        retraiteBaseDeplafonneLowPass: 1,
        retraiteBaseDeplafonneHighPass: TNS_RETRAITE_BASE_CIPAV_PLAFOND_T2_PASS,
        retraiteComplT1Taux: TNS_RETRAITE_COMPL_CIPAV_TAUX_T1,
        retraiteComplT2Taux: TNS_RETRAITE_COMPL_CIPAV_TAUX_T2,
      };
    // Professions libérales non réglementées are SSI-affiliated → same rates as artisan/commerçant.
    case 'profession_liberale':
    case 'artisan_commercant':
      return {
        ijTaux: TNS_IJ_TAUX_ARTISAN_COMMERCANT,
        ijPlafondPass: TNS_IJ_PLAFOND_PASS_ARTISAN_COMMERCANT,
        cfpTaux: TNS_CFP_TAUX_COMMERCANT_PL,
        retraiteBaseT1Taux: TNS_RETRAITE_BASE_TAUX_T1,
        retraiteBaseDeplafonneTaux: TNS_RETRAITE_BASE_TAUX_DEPLAFONNE,
        retraiteBaseDeplafonneLowPass: 0,
        retraiteBaseDeplafonneHighPass: Number.POSITIVE_INFINITY,
        retraiteComplT1Taux: TNS_RETRAITE_COMPL_TAUX_T1,
        retraiteComplT2Taux: TNS_RETRAITE_COMPL_TAUX_T2,
      };
  }
};

type ResolveTnsRegimeInput = {
  caVente: number;
  caServiceBIC: number;
  caServiceBNC: number;
  activiteSousType: ActiviteSousType;
};

/**
 * Resolves the TNS régime branch from the profile's CA streams + activiteSousType.
 * CIPAV wins outright; otherwise a strictly BNC-dominant CA ⇒ profession libérale,
 * else (BIC ≥ BNC, including an all-zero CA) ⇒ artisan/commerçant (§A.3 D4).
 * @param input the three CA streams and the activity sous-type discriminator
 * @returns the resolved TNS régime branch
 */
export const resolveTnsRegime = (input: ResolveTnsRegimeInput): TnsRegime => {
  if (input.activiteSousType === 'cipav') return 'cipav';
  const bic = input.caVente + input.caServiceBIC;
  return input.caServiceBNC > bic ? 'profession_liberale' : 'artisan_commercant';
};

type TnsCotisationsInput = {
  assietteTNS: number;
  regime: TnsRegime;
  /** ACRE-réel exonération rate from acre-reel.ts (0 outside year 1 / not eligible). */
  acreExoTaux: number;
};

/**
 * Computes the full closed-form TNS cotisation cascade on an assiette unique (§A.3–§A.5).
 * @param input the abated assiette, the régime branch, and the ACRE-réel exo rate
 * @returns the cotisation totals, the deductible / non-deductible split, and the per-row detail
 */
export const computeTnsCotisations = (input: TnsCotisationsInput): TnsCotisationsResult => {
  const { regime, acreExoTaux } = input;
  const assietteTNS = Math.max(0, input.assietteTNS);
  const params = resolveTnsRegimeParams(regime);

  // §A.4 — each cotisation floors its OWN assiette to its minimal-assiette plancher.
  // The maladie-maternité minimum was abolished → the 0,40 PASS floor is IJ-only.
  const assietteIj = Math.max(assietteTNS, TNS_ASSIETTE_MIN_IJ_PASS * PASS_ANNUEL);
  const assietteRetraiteBase = Math.max(assietteTNS, TNS_ASSIETTE_MIN_RETRAITE_BASE_PASS * PASS_ANNUEL);
  const assietteInvalidite = Math.max(assietteTNS, TNS_ASSIETTE_MIN_INVALIDITE_PASS * PASS_ANNUEL);

  // Row 1 — maladie-maternité: global-rate curve on the RAW assiette (no minimal assiette).
  const maladie = globalRateCurveCotisation({ assiette: assietteTNS, curve: TNS_MALADIE_BAREME });
  // Row 2 — indemnités journalières: floored assiette, capped at the régime IJ plafond.
  const ij = params.ijTaux * Math.min(assietteIj, params.ijPlafondPass * PASS_ANNUEL);
  // Row 3 — retraite de base plafonnée: ≤ 1 PASS of the floored assiette.
  const retraiteBasePlafonnee = params.retraiteBaseT1Taux * Math.min(assietteRetraiteBase, PASS_ANNUEL);
  // Row 3b — retraite de base "above T1": SSI 0,72 % totalité (band [0, +∞)), CIPAV a T2 slice (1 → 5 PASS).
  const retraiteBaseDeplafonnee =
    params.retraiteBaseDeplafonneTaux *
    trancheMontant({
      assiette: assietteRetraiteBase,
      lowPass: params.retraiteBaseDeplafonneLowPass,
      highPass: params.retraiteBaseDeplafonneHighPass,
    });
  // Row 4 — retraite complémentaire T1: ≤ 1 PASS, raw assiette (no floor).
  const retraiteComplT1 = params.retraiteComplT1Taux * Math.min(assietteTNS, PASS_ANNUEL);
  // Row 4b — retraite complémentaire T2: 1 → TNS_RETRAITE_COMPL_PLAFOND_T2_PASS PASS.
  const retraiteComplT2 =
    params.retraiteComplT2Taux * trancheMontant({ assiette: assietteTNS, lowPass: 1, highPass: TNS_RETRAITE_COMPL_PLAFOND_T2_PASS });
  // Row 5 — invalidité-décès: ≤ 1 PASS of the floored assiette.
  const invalidite = TNS_INVALIDITE_DECES_TAUX * Math.min(assietteInvalidite, PASS_ANNUEL);
  // Row 6 — allocations familiales: global-rate curve, raw assiette (no floor).
  const allocationsFamiliales = globalRateCurveCotisation({ assiette: assietteTNS, curve: TNS_ALLOC_FAM_BAREME });
  // Rows 7 / 7b — CSG-CRDS on the assiette unique; 7b (non-déductible CSG + CRDS) is the only non-deductible row.
  const csgDeductible = CSG_DEDUCTIBLE_TAUX * assietteTNS;
  const csgCrdsNonDeduct = (CSG_NON_DEDUCTIBLE_TAUX + CRDS_TAUX) * assietteTNS;
  // Row 8 — CFP: flat forfait (taux × PASS), always due.
  const cfp = params.cfpTaux * PASS_ANNUEL;

  // §D.5 — ACRE au réel exonerates only the in-scope rows.
  const inScopeBeforeExo = maladie + retraiteBasePlafonnee + retraiteBaseDeplafonnee + invalidite + allocationsFamiliales;
  const acreExoneration = acreExoTaux * inScopeBeforeExo;
  const outOfScope = ij + retraiteComplT1 + retraiteComplT2 + csgDeductible + csgCrdsNonDeduct + cfp;

  const cotisationsTotales = inScopeBeforeExo - acreExoneration + outOfScope;
  // §A.5 — deductible / non-deductible split; ACRE never touches the CSG-CRDS row.
  const cotisationsNonDeduct = csgCrdsNonDeduct;
  const cotisationsDeductibles = cotisationsTotales - cotisationsNonDeduct;

  return {
    cotisationsTotales,
    cotisationsDeductibles,
    cotisationsNonDeduct,
    acreExoneration,
    detail: {
      maladie,
      ij,
      retraiteBasePlafonnee,
      retraiteBaseDeplafonnee,
      retraiteComplT1,
      retraiteComplT2,
      invalidite,
      allocationsFamiliales,
      csgDeductible,
      csgCrdsNonDeduct,
      cfp,
    },
  };
};

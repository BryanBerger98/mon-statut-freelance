/**
 * ACRE au réel — degressive exonération of a fraction of the in-scope TNS
 * cotisations during the first activity year (spec §D.5; this is NOT the micro
 * ACRE — that lives in acre.ts and works on a flat-rate cotisation).
 *
 * Scope (applied by tns-cotisations.ts): maladie-maternité, retraite de base
 * (plafonnée + déplafonnée), invalidité-décès and allocations familiales. OUT of
 * scope: indemnités journalières, retraite complémentaire, CSG-CRDS and CFP.
 *
 * The degressive band shape (full ≤ 0,75 PASS, nil ≥ 1 PASS) is shared with the
 * assimilé-salarié variant — both delegate to acreDegressiveExoTaux. The status
 * module gates the first-year eligibility before calling this.
 *
 * FLAGGED: ACRE_REEL_TAUX_EXO (25 %) is under verification by tax-social-modeler
 * (the classic ACRE is a 100 % exemption below 0,75 PASS). Referencing the
 * constant by name keeps this correct once the value is confirmed/corrected.
 */
import { ACRE_REEL_DEGRESSIVITE_PLAFOND_PASS, ACRE_REEL_PLAFOND_REVENU_PASS, ACRE_REEL_TAUX_EXO } from '../constants';
import { acreDegressiveExoTaux } from './acre-degressive';

/**
 * Degressive ACRE-réel exonération rate to apply to the in-scope TNS cotisations.
 * @param assietteACRE the TNS social assiette used as the ACRE revenu test (euros)
 * @returns the exonération rate in [0, ACRE_REEL_TAUX_EXO] (full at/below 0,75 PASS, 0 at/above 1 PASS)
 */
export const acreReelExoTaux = (assietteACRE: number): number =>
  acreDegressiveExoTaux({
    assiette: assietteACRE,
    tauxExo: ACRE_REEL_TAUX_EXO,
    plafondPleinPass: ACRE_REEL_PLAFOND_REVENU_PASS,
    plafondNulPass: ACRE_REEL_DEGRESSIVITE_PLAFOND_PASS,
  });

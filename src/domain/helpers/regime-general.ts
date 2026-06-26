/**
 * Régime général (assimilé-salarié) cotisation cascade — spec §B.2 / §B.3.
 *
 * Drives the social cost of a gross salary (`brut`) for the cadre-assimilé statuses:
 *   • sasu-is / sasu-ir — président assimilé-salarié, NO chômage/AGS, NO RGDU (D6).
 *   • portage-salarial   — salarié porté, ADDS chômage + AGS, RGDU applies (D6).
 *
 * Per-tranche cascade (T1 = 0→1 PASS, T2 = 1→8 PASS, "totalité" = whole brut). The
 * CSG-CRDS assiette is 98,25 % of brut capped at 4 PASS (§0.2). The reduced-rate
 * bandeaux are abolished (D7): full 13 % / 5,25 % rates, any reduction comes only
 * from the RGDU and only for portage.
 *
 * Returns the salarial / patronal totals plus the pieces the status modules need to
 * build the taxable salary: `net`, `coutTotalEmployeur`, and `csgCrdsNonDeduct` (the
 * non-deductible CSG/CRDS re-added to the salaire imposable, §B.3). The 10 % salarié
 * abattement is applied by the status module (sasu-is / portage only — §B.4), not here.
 */
import {
  AGIRC_ARRCO_PLAFOND_T2_PASS,
  AGIRC_ARRCO_T1_PAT,
  AGIRC_ARRCO_T1_SAL,
  AGIRC_ARRCO_T2_PAT,
  AGIRC_ARRCO_T2_SAL,
  AGS_PAT,
  APEC_PAT,
  APEC_PLAFOND_PASS,
  APEC_SAL,
  CEG_T1_PAT,
  CEG_T1_SAL,
  CEG_T2_PAT,
  CEG_T2_SAL,
  CET_PAT,
  CET_SAL,
  CHOMAGE_PAT,
  CHOMAGE_PLAFOND_PASS,
  CRDS_TAUX,
  CSG_CRDS_ABATTEMENT_SALARIE,
  CSG_CRDS_PLAFOND_SALARIE_PASS,
  CSG_DEDUCTIBLE_TAUX,
  CSG_NON_DEDUCTIBLE_TAUX,
  FORMATION_PRO_PAT,
  PREVOYANCE_CADRE_PAT_T1,
  SS_ALLOC_FAM_PAT_PLEIN,
  SS_CSA_PAT,
  SS_FNAL_PAT,
  SS_MALADIE_PATRONAL_PLEIN,
  SS_VIEILLESSE_DEPLAF_PAT,
  SS_VIEILLESSE_DEPLAF_SAL,
  SS_VIEILLESSE_PLAF_PAT,
  SS_VIEILLESSE_PLAF_SAL,
  TAXE_APPRENTISSAGE_PAT,
} from '../constants';
import { trancheMontant } from './pass';
import { reductionGeneraleDegressive } from './rgdu';

type RegimeGeneralInput = {
  brut: number;
  tauxAtMp: number;
  appliquerRgdu: boolean;
  inclureChomageAgs: boolean;
  /**
   * ACRE exonération rate applied to the in-scope SS rows (maladie patronal, vieillesse base
   * plafonnée + déplafonnée des deux côtés, alloc. fam. patronal) — assimilé président, 1re année.
   * Default 0 ⇒ no exonération (identical to the pre-ACRE behaviour). Out of scope: CSG-CRDS,
   * AGIRC-ARRCO, CEG/CET/APEC, prévoyance, CSA, FNAL, AT/MP, formation, taxe d'apprentissage, chômage/AGS.
   */
  acreExoTaux?: number;
};

type RegimeGeneralResult = {
  cotisationsSalariales: number;
  cotisationsPatronales: number;
  reductionRgdu: number;
  net: number;
  coutTotalEmployeur: number;
  /** Non-deductible CSG + CRDS to re-add to the salaire imposable (§B.3). */
  csgCrdsNonDeduct: number;
  /** Total ACRE exonération applied (salarial + patronal split); 0 when `acreExoTaux` is 0. */
  acreExoneration: number;
};

/**
 * Computes the full régime-général cotisation cascade for an annual gross salary.
 * @param input the gross salary, AT/MP rate, and the RGDU / chômage-AGS toggles per status
 * @returns the salarial / patronal totals, RGDU reduction, net, super-gross, and non-deductible CSG/CRDS
 */
export const computeRegimeGeneral = (input: RegimeGeneralInput): RegimeGeneralResult => {
  const { brut, tauxAtMp, appliquerRgdu, inclureChomageAgs, acreExoTaux = 0 } = input;
  if (brut <= 0) {
    return {
      cotisationsSalariales: 0,
      cotisationsPatronales: 0,
      reductionRgdu: 0,
      net: 0,
      coutTotalEmployeur: 0,
      csgCrdsNonDeduct: 0,
      acreExoneration: 0,
    };
  }

  const trancheT1 = trancheMontant({ assiette: brut, lowPass: 0, highPass: 1 });
  const trancheT2 = trancheMontant({ assiette: brut, lowPass: 1, highPass: AGIRC_ARRCO_PLAFOND_T2_PASS });
  const trancheCet = trancheMontant({ assiette: brut, lowPass: 0, highPass: AGIRC_ARRCO_PLAFOND_T2_PASS });
  const trancheApec = trancheMontant({ assiette: brut, lowPass: 0, highPass: APEC_PLAFOND_PASS });

  // CSG-CRDS: assiette = 98,25 % of brut capped at 4 PASS (§0.2 / §B.3).
  const csgCrdsBase =
    trancheMontant({ assiette: brut, lowPass: 0, highPass: CSG_CRDS_PLAFOND_SALARIE_PASS }) * (1 - CSG_CRDS_ABATTEMENT_SALARIE);
  const csgTotale = csgCrdsBase * (CSG_DEDUCTIBLE_TAUX + CSG_NON_DEDUCTIBLE_TAUX + CRDS_TAUX);
  const csgCrdsNonDeduct = csgCrdsBase * (CSG_NON_DEDUCTIBLE_TAUX + CRDS_TAUX);

  const cotisationsSalarialesBrutes =
    SS_VIEILLESSE_PLAF_SAL * trancheT1 +
    SS_VIEILLESSE_DEPLAF_SAL * brut +
    AGIRC_ARRCO_T1_SAL * trancheT1 +
    AGIRC_ARRCO_T2_SAL * trancheT2 +
    CEG_T1_SAL * trancheT1 +
    CEG_T2_SAL * trancheT2 +
    CET_SAL * trancheCet +
    APEC_SAL * trancheApec +
    csgTotale;

  const patronalRegimeGeneral =
    SS_MALADIE_PATRONAL_PLEIN * brut +
    SS_VIEILLESSE_PLAF_PAT * trancheT1 +
    SS_VIEILLESSE_DEPLAF_PAT * brut +
    SS_ALLOC_FAM_PAT_PLEIN * brut +
    SS_CSA_PAT * brut +
    AGIRC_ARRCO_T1_PAT * trancheT1 +
    AGIRC_ARRCO_T2_PAT * trancheT2 +
    CEG_T1_PAT * trancheT1 +
    CEG_T2_PAT * trancheT2 +
    CET_PAT * trancheCet +
    APEC_PAT * trancheApec +
    PREVOYANCE_CADRE_PAT_T1 * trancheT1 +
    SS_FNAL_PAT * trancheT1 +
    tauxAtMp * brut +
    FORMATION_PRO_PAT * brut +
    TAXE_APPRENTISSAGE_PAT * brut;

  // RGDU reduces only the régime-général patronal block (portage only). Capped at that
  // block: a réduction can never exceed the cotisations it reduces (would be nonsensical
  // negative just under 1 SMIC, a zone below the portage viability floor anyway).
  const reductionRgdu = appliquerRgdu ? Math.min(reductionGeneraleDegressive(brut), patronalRegimeGeneral) : 0;

  // Chômage + AGS: portage only, on min(brut, 4 PASS), NOT reduced by the RGDU.
  const chomageAgs = inclureChomageAgs
    ? (CHOMAGE_PAT + AGS_PAT) * trancheMontant({ assiette: brut, lowPass: 0, highPass: CHOMAGE_PLAFOND_PASS })
    : 0;

  // ACRE assimilé-salarié (1re année) — degressive exonération of the in-scope SS rows only,
  // split across the salarial and patronal sides. Out-of-scope rows (CSG-CRDS, AGIRC-ARRCO,
  // CEG/CET/APEC, prévoyance, CSA, FNAL, AT/MP, formation, taxe d'apprentissage, chômage/AGS)
  // remain fully due. acreExoTaux = 0 ⇒ no change to either total.
  const acreInScopeSalarial = SS_VIEILLESSE_PLAF_SAL * trancheT1 + SS_VIEILLESSE_DEPLAF_SAL * brut;
  const acreInScopePatronal =
    SS_MALADIE_PATRONAL_PLEIN * brut + SS_VIEILLESSE_PLAF_PAT * trancheT1 + SS_VIEILLESSE_DEPLAF_PAT * brut + SS_ALLOC_FAM_PAT_PLEIN * brut;
  const acreExoSalarial = acreExoTaux * acreInScopeSalarial;
  const acreExoPatronal = acreExoTaux * acreInScopePatronal;
  const acreExoneration = acreExoSalarial + acreExoPatronal;

  const cotisationsSalariales = cotisationsSalarialesBrutes - acreExoSalarial;
  const cotisationsPatronales = patronalRegimeGeneral - reductionRgdu + chomageAgs - acreExoPatronal;
  const net = brut - cotisationsSalariales;
  const coutTotalEmployeur = brut + cotisationsPatronales;

  return { cotisationsSalariales, cotisationsPatronales, reductionRgdu, net, coutTotalEmployeur, csgCrdsNonDeduct, acreExoneration };
};

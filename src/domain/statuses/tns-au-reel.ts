/**
 * TNS-au-réel pipeline shared by `ei-reel` and `eurl-ir` — mechanically IDENTICAL
 * (only the status label differs), so the two thin status modules delegate here
 * (typescript.md §2.1: ≥ 2 callers in the same folder ⇒ shared local helper).
 *
 * Pure transcription of `.claude/docs/business/calculation/ei-reel.md` §c
 * (eurl-ir.md is the same pipeline). The gérant EURL-IR / entrepreneur individuel
 * au réel is a TNS taxed at the household IR on the bénéfice:
 *   1. revenuBrut = caTotal − chargesReelles (bénéfice before personal cotisations, D1)
 *   2. assietteTNS = revenuBrut − clamp(26 % abattement, PLANCHER, PLAFOND) (assiette unique 2026)
 *   3. cotisations via the closed-form TNS cascade (ACRE-réel year 1, in-scope rows)
 *   4. revenuImposableStatut = revenuBrut − cotisationsDeductibles
 *   5. impotIR = marginal household IR (barème → QF → décote, CONV-2)
 *   6. CFE (year-1 / CA-floor exempt, CONV-4)
 *   7. netDisponible = revenuBrut − cotisationsTotales − impotIR − cfe
 *
 * Numbers come only from constants.ts (calc.md §1.2); rounding is boundary-only.
 */
import { CFE_CA_SEUIL_EXO, CFE_MONTANT, TNS_ABATTEMENT_ASSIETTE, TNS_ABATTEMENT_PLAFOND, TNS_ABATTEMENT_PLANCHER } from '../constants';
import { acreReelExoTaux } from '../helpers/acre-reel';
import { computeMarginalImpotRevenu } from '../helpers/impot-revenu';
import { roundTaux, roundToEuros } from '../helpers/money';
import { clampMontant } from '../helpers/pass';
import { computeTnsCotisations, resolveTnsRegime } from '../helpers/tns-cotisations';
import type { Profile, ReductionLine, StatusDetail, StatusId, StatusResult } from '../validation';

/** The two statuses that share the TNS-au-réel pipeline (identical body, distinct label). */
type TnsAuReelStatusId = Extract<StatusId, 'ei-reel' | 'eurl-ir'>;

type ComputeTnsAuReelInput = {
  profile: Profile;
  statusId: TnsAuReelStatusId;
};

/**
 * Runs the shared TNS-au-réel pipeline and labels the result with the given status.
 * @param input the engine profile and the concrete status label ('ei-reel' | 'eurl-ir')
 * @returns the base StatusResult (no remuneration/dividendes — not an IS status)
 */
export const computeTnsAuReel = (input: ComputeTnsAuReelInput): StatusResult => {
  const { profile, statusId } = input;
  const caTotal = profile.caVente + profile.caServiceBIC + profile.caServiceBNC;

  // 1. Assiette de départ — bénéfice avant cotisations personnelles (D1).
  const revenuBrut = caTotal - profile.chargesReelles;

  // 2. Assiette sociale unique — abattement 26 % borné [PLANCHER, PLAFOND], closed-form (§A.1).
  const abattement = clampMontant({
    value: TNS_ABATTEMENT_ASSIETTE * revenuBrut,
    min: TNS_ABATTEMENT_PLANCHER,
    max: TNS_ABATTEMENT_PLAFOND,
  });
  const assietteTNS = revenuBrut - abattement;

  // 3. Cotisations sociales — cascade TNS fermée ; ACRE-réel (1re année) sur les lignes in-scope.
  const regime = resolveTnsRegime({
    caVente: profile.caVente,
    caServiceBIC: profile.caServiceBIC,
    caServiceBNC: profile.caServiceBNC,
    activiteSousType: profile.activiteSousType,
  });
  const acreExoTaux = profile.firstYear ? acreReelExoTaux(assietteTNS) : 0;
  const cotis = computeTnsCotisations({ assietteTNS, regime, acreExoTaux });

  // 4. Revenu imposable du statut — bénéfice net des cotisations déductibles (§A.5).
  const revenuImposableStatut = revenuBrut - cotis.cotisationsDeductibles;

  // 5. IR marginal du foyer (barème → QF → décote, CONV-2) — pas de 10 % abattement salarié (TNS).
  const impotIr = computeMarginalImpotRevenu({
    revenuImposable: revenuImposableStatut,
    autresRevenusFoyer: profile.autresRevenusFoyer,
    nbParts: profile.nbParts,
    situationFamiliale: profile.situationFamiliale,
  });

  // 6. CFE — exonérée la 1re année ou sous le seuil de CA (CONV-4).
  const cfe = profile.firstYear || caTotal <= CFE_CA_SEUIL_EXO ? 0 : CFE_MONTANT;

  // 7. Net disponible (cash-conserving) & taux global (CONV-5).
  const netDisponible = revenuBrut - cotis.cotisationsTotales - impotIr - cfe;
  const tauxGlobal = caTotal > 0 ? 1 - netDisponible / caTotal : 0;

  // Full breakdown for the results UI ("afficher TOUT le détail"). The 26 % abattement applies
  // to the SOCIAL assiette; the deductible part of the cotisations lowers the IR base. ACRE (year 1).
  const reductions: ReductionLine[] = [
    {
      code: 'abattement-tns',
      kind: 'abattement',
      taux: roundTaux(revenuBrut > 0 ? abattement / revenuBrut : 0),
      base: roundToEuros(revenuBrut),
      montant: roundToEuros(abattement),
    },
    {
      code: 'cotisations-deductibles',
      kind: 'deduction',
      montant: roundToEuros(cotis.cotisationsDeductibles),
    },
  ];
  if (acreExoTaux > 0) {
    reductions.push({
      code: 'acre',
      kind: 'exoneration',
      taux: roundTaux(acreExoTaux),
      montant: roundToEuros(cotis.acreExoneration),
    });
  }
  const detail: StatusDetail = {
    caTotal: roundToEuros(caTotal),
    charges: roundToEuros(profile.chargesReelles),
    beneficeAvantRemu: roundToEuros(revenuBrut),
    cotisationsTns: roundToEuros(cotis.cotisationsTotales),
    revenuImposable: roundToEuros(revenuImposableStatut),
    impotRevenu: roundToEuros(impotIr),
    cfe: roundToEuros(cfe),
    reductions,
    netDisponible: roundToEuros(netDisponible),
  };

  return {
    status: statusId,
    cotisations: roundToEuros(cotis.cotisationsTotales),
    impot: roundToEuros(impotIr),
    netDisponible: roundToEuros(netDisponible),
    tauxGlobal: roundTaux(tauxGlobal),
    assietteSociale: roundToEuros(Math.max(0, assietteTNS)),
    revenuImposable: roundToEuros(revenuImposableStatut),
    cfe: roundToEuros(cfe),
    acreApplied: acreExoTaux > 0,
    detail,
  };
};

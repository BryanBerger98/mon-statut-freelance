/**
 * SASU-IR calc — SAS ayant opté pour l'IR (transparence, société de personnes art.
 * 239 bis AB, ≤ 5 exercices). Président assimilé-salarié (régime général, NO chômage,
 * NO RGDU per D6). Pure transcription of `.claude/docs/business/calculation/sasu-ir.md`.
 *
 * Pipeline (spec §c): B = caTotal − chargesReelles ; brut = remunerationChoisie.
 *   1. cotisations on brut (régime général, full rates, ACRE assimilé year 1) — restent dues
 *   2. transparence (D8) : la rémunération n'est PAS déductible ; les cotisations le sont
 *      (moins leur CSG/CRDS non déductible) ⇒ resultatImposable = B − cotisationsDeductibles
 *   3. impotIR = IR marginal du foyer sur resultatImposable (barème → QF → décote, CONV-2)
 *      — PAS de 10 % abattement salarié (quote-part société de personnes, §B.4)
 *   4. pas de dividendes (D8)
 *   5. CFE (year-1 / CA-floor exempt)
 *   6. netDisponible = (B − cotisationsTotales) − impotIR − cfe
 *
 * Numbers come only from constants.ts (calc.md §1.2); rounding is boundary-only.
 */
import { CFE_CA_SEUIL_EXO, CFE_MONTANT, REFERENCE_FISCAL_YEAR, SASU_IR_OPTION_MAX_YEARS } from '../constants';
import { acreAssimileExoTaux } from '../helpers/acre-degressive';
import { computeMarginalImpotRevenu } from '../helpers/impot-revenu';
import { roundTaux, roundToEuros } from '../helpers/money';
import { computeRegimeGeneral } from '../helpers/regime-general';
import type { ReductionLine, StatusDetail } from '../validation';
import type { StatusCompute } from './types';

export const computeSasuIr: StatusCompute = (input) => {
  const { profile } = input;
  const caTotal = profile.caVente + profile.caServiceBIC + profile.caServiceBNC;
  const beneficeAvantRemu = caTotal - profile.chargesReelles;
  const brut = profile.remunerationChoisie;

  // 1. Cotisations sur le brut — assimilé-salarié, NO RGDU, NO chômage/AGS (D6).
  // ACRE assimilé (1re année) dégressif sur le brut (§D.5).
  const acreExoTaux = profile.firstYear ? acreAssimileExoTaux(brut) : 0;
  const regime = computeRegimeGeneral({
    brut,
    tauxAtMp: profile.tauxAtMp,
    appliquerRgdu: false,
    inclureChomageAgs: false,
    acreExoTaux,
  });
  const cotisationsTotales = regime.cotisationsSalariales + regime.cotisationsPatronales;

  // 2. Résultat imposable du foyer (transparence D8) : rémunération NON déductible,
  // cotisations déductibles (moins leur CSG/CRDS non déductible re-intégrée).
  const cotisationsDeductibles = cotisationsTotales - regime.csgCrdsNonDeduct;
  const resultatImposable = beneficeAvantRemu - cotisationsDeductibles;

  // 3. IR marginal du foyer (barème → QF → décote, CONV-2) — PAS de 10 % abattement salarié.
  const impotIr = computeMarginalImpotRevenu({
    revenuImposable: resultatImposable,
    autresRevenusFoyer: profile.autresRevenusFoyer,
    nbParts: profile.nbParts,
    situationFamiliale: profile.situationFamiliale,
  });

  // 5. CFE — exonérée la 1re année ou sous le seuil de CA (CONV-4).
  const cfe = profile.firstYear || caTotal <= CFE_CA_SEUIL_EXO ? 0 : CFE_MONTANT;

  // 6. Net disponible (cash-conserving) : tout B net de cotisations et d'IR.
  const netDisponible = beneficeAvantRemu - cotisationsTotales - impotIr - cfe;
  const tauxGlobal = caTotal > 0 ? 1 - netDisponible / caTotal : 0;

  // Éligibilité option IR (≤ 5 exercices) — année-granulaire, sans horloge.
  const anneeDebut = Number(profile.dateDebutActivite.split('-')[0]);
  const optionIRValid = Number.isFinite(anneeDebut) && REFERENCE_FISCAL_YEAR - anneeDebut < SASU_IR_OPTION_MAX_YEARS;

  // Full breakdown for the results UI ("afficher TOUT le détail"). Transparence (D8): the whole
  // bénéfice is taxed at IR (no 10 % abattement salarié), cotisations are the only deduction.
  // `remunerationNetteApresImpot` is intentionally omitted — IR hits the bénéfice, not the salary.
  const reductions: ReductionLine[] = [
    {
      code: 'cotisations-deductibles',
      kind: 'deduction',
      montant: roundToEuros(cotisationsDeductibles),
    },
  ];
  if (acreExoTaux > 0) {
    reductions.push({
      code: 'acre',
      kind: 'exoneration',
      taux: roundTaux(acreExoTaux),
      montant: roundToEuros(regime.acreExoneration),
    });
  }
  const detail: StatusDetail = {
    caTotal: roundToEuros(caTotal),
    charges: roundToEuros(profile.chargesReelles),
    beneficeAvantRemu: roundToEuros(beneficeAvantRemu),
    remunerationBrut: roundToEuros(brut),
    cotisationsSalariales: roundToEuros(regime.cotisationsSalariales),
    cotisationsPatronales: roundToEuros(regime.cotisationsPatronales),
    coutTotalEmployeur: roundToEuros(regime.coutTotalEmployeur),
    remunerationNette: roundToEuros(regime.net),
    revenuImposable: roundToEuros(resultatImposable),
    impotRevenu: roundToEuros(impotIr),
    cfe: roundToEuros(cfe),
    reductions,
    netDisponible: roundToEuros(netDisponible),
  };

  return {
    status: 'sasu-ir',
    cotisations: roundToEuros(cotisationsTotales),
    impot: roundToEuros(impotIr),
    netDisponible: roundToEuros(netDisponible),
    tauxGlobal: roundTaux(tauxGlobal),
    cotisationsSalariales: roundToEuros(regime.cotisationsSalariales),
    cotisationsPatronales: roundToEuros(regime.cotisationsPatronales),
    assietteSociale: roundToEuros(brut),
    revenuImposable: roundToEuros(resultatImposable),
    cfe: roundToEuros(cfe),
    acreApplied: acreExoTaux > 0,
    optionIRValid,
    detail,
  };
};

/**
 * SASU-IS calc — président assimilé-salarié (régime général, NO chômage/AGS, NO RGDU
 * per D6), IS on the company result, rémunération taxed at the household IR (with the
 * 10 % abattement salarié + décote), dividends bearing only the PFU (no social cotis).
 * Pure transcription of `.claude/docs/business/calculation/sasu-is.md`.
 *
 * Pipeline (spec §c): B = caTotal − chargesReelles ; brut = remunerationChoisie.
 *   1. cotisations on brut (régime général, full rates, ACRE assimilé year 1)
 *   2. baseIS = B − coutTotalEmployeur ; IS (two brackets)
 *   3. salaireImposable = net + csgCrdsNonDeduct ; − 10 % abattement salarié (clampé)
 *   4. impotIR_remu = marginal household IR on remunerationImposable (CONV-2)
 *   5. dividendesBruts = partDividendes × (baseIS − IS) ; PFU or option barème (keep the better)
 *   6. CFE (year-1 / CA-floor exempt)
 *   7. cotisations = sal + pat + pfuDivPS (CONV-3) ; impot = IS + impotIR_remu + dividendImpotIR
 *      netDisponible = net − impotIR_remu + dividendesNets − cfe
 *
 * Numbers come only from constants.ts (calc.md §1.2); rounding is boundary-only.
 */
import {
  ABATTEMENT_FORFAITAIRE_SALARIE_MAX,
  ABATTEMENT_FORFAITAIRE_SALARIE_MIN,
  ABATTEMENT_FORFAITAIRE_SALARIE_TAUX,
  CFE_CA_SEUIL_EXO,
  CFE_MONTANT,
} from '../constants';
import { acreAssimileExoTaux } from '../helpers/acre-degressive';
import { computeImpotRevenu, computeMarginalImpotRevenu } from '../helpers/impot-revenu';
import { computeImpotSocietes } from '../helpers/is';
import { roundTaux, roundToEuros } from '../helpers/money';
import { clampMontant } from '../helpers/pass';
import { computeDividendesTax } from '../helpers/pfu';
import { computeRegimeGeneral } from '../helpers/regime-general';
import type { ReductionLine, StatusDetail, StatusResultIS } from '../validation';
import type { StatusComputeIS } from './types';

export const computeSasuIs: StatusComputeIS = (input) => {
  const { profile } = input;
  const caTotal = profile.caVente + profile.caServiceBIC + profile.caServiceBNC;
  const beneficeAvantRemu = caTotal - profile.chargesReelles;
  const brut = profile.remunerationChoisie;

  // 1. Cotisations sur le brut — assimilé-salarié, NO RGDU, NO chômage/AGS (D6).
  // ACRE assimilé (1re année) exonère les lignes SS in-scope, dégressif sur le brut (§D.5).
  const acreExoTaux = profile.firstYear ? acreAssimileExoTaux(brut) : 0;
  const regime = computeRegimeGeneral({
    brut,
    tauxAtMp: profile.tauxAtMp,
    appliquerRgdu: false,
    inclureChomageAgs: false,
    acreExoTaux,
  });

  // 2. Base IS = bénéfice − super-brut (le coût employeur est déductible du résultat).
  const baseIS = beneficeAvantRemu - regime.coutTotalEmployeur;
  const is = computeImpotSocietes({ baseIS, caTotal });

  // 3. Rémunération imposable = net + CSG/CRDS non déductible, moins le 10 % abattement salarié
  // (clampé [MIN, MAX], jamais > salaireImposable ⇒ 0 à pay nul).
  const salaireImposable = regime.net + regime.csgCrdsNonDeduct;
  const abattementSalarie = Math.min(
    salaireImposable,
    clampMontant({
      value: ABATTEMENT_FORFAITAIRE_SALARIE_TAUX * salaireImposable,
      min: ABATTEMENT_FORFAITAIRE_SALARIE_MIN,
      max: ABATTEMENT_FORFAITAIRE_SALARIE_MAX,
    }),
  );
  const remunerationImposable = salaireImposable - abattementSalarie;

  // 4. IR marginal sur la rémunération (barème → QF → décote, CONV-2).
  const impotIrRemu = computeMarginalImpotRevenu({
    revenuImposable: remunerationImposable,
    autresRevenusFoyer: profile.autresRevenusFoyer,
    nbParts: profile.nbParts,
    situationFamiliale: profile.situationFamiliale,
  });

  // 5. Dividendes : part du résultat après IS, taxés PFU (défaut) ou option barème (keep the better).
  // Le résultat distribuable ne peut être négatif (plancher 0).
  const resultatApresIS = Math.max(0, baseIS - is);
  const dividendesBruts = profile.partDividendes * resultatApresIS;
  const divPfu = computeDividendesTax({ dividendesCapital: dividendesBruts, optionBaremeDividendes: false });
  const divBareme = computeDividendesTax({ dividendesCapital: dividendesBruts, optionBaremeDividendes: true });
  const pfuDivPS = divPfu.prelevementsSociaux; // PS identique quelle que soit l'option
  const pfuDivIR = divPfu.flatTaxIR;
  // IR marginal de la fraction dividende ajoutée au barème (après abattement de 40 %).
  const baremeDivIR =
    computeImpotRevenu({
      revenuImposable: remunerationImposable + divBareme.baremeImposable,
      autresRevenusFoyer: profile.autresRevenusFoyer,
      nbParts: profile.nbParts,
      situationFamiliale: profile.situationFamiliale,
    }) -
    computeImpotRevenu({
      revenuImposable: remunerationImposable,
      autresRevenusFoyer: profile.autresRevenusFoyer,
      nbParts: profile.nbParts,
      situationFamiliale: profile.situationFamiliale,
    });
  const dividendImpotIR = profile.optionBaremeDividendes ? Math.min(pfuDivIR, baremeDivIR) : pfuDivIR;
  const dividendesNets = dividendesBruts - pfuDivPS - dividendImpotIR;

  // 6. CFE — exonérée la 1re année ou sous le seuil de CA (CONV-4).
  const cfe = profile.firstYear || caTotal <= CFE_CA_SEUIL_EXO ? 0 : CFE_MONTANT;

  // 7. Agrégats (PFU bucketing CONV-3) & net disponible.
  const cotisations = regime.cotisationsSalariales + regime.cotisationsPatronales + pfuDivPS;
  const impot = is + impotIrRemu + dividendImpotIR;
  const netDisponible = regime.net - impotIrRemu + dividendesNets - cfe;
  const tauxGlobal = caTotal > 0 ? 1 - netDisponible / caTotal : 0;

  const remunerationTotale = brut + dividendesBruts;
  const remunerationShare = remunerationTotale > 0 ? brut / remunerationTotale : 0;

  // Full breakdown for the results UI ("afficher TOUT le détail") — every line: salaire brut →
  // cotisations → net → IR → net après impôt ; base IS → IS ; dividendes bruts → PS → IR → nets.
  // The 10 % abattement salarié is surfaced as its effective rate so the % reconciles with base × montant.
  const reductions: ReductionLine[] = [
    {
      code: 'abattement-salarie',
      kind: 'abattement',
      taux: roundTaux(salaireImposable > 0 ? abattementSalarie / salaireImposable : 0),
      base: roundToEuros(salaireImposable),
      montant: roundToEuros(abattementSalarie),
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
    revenuImposable: roundToEuros(remunerationImposable),
    impotRevenu: roundToEuros(impotIrRemu),
    remunerationNetteApresImpot: roundToEuros(regime.net - impotIrRemu),
    baseIS: roundToEuros(baseIS),
    is: roundToEuros(is),
    dividendesBruts: roundToEuros(dividendesBruts),
    dividendesPrelevementsSociaux: roundToEuros(pfuDivPS),
    dividendesImpot: roundToEuros(dividendImpotIR),
    dividendesNets: roundToEuros(dividendesNets),
    cfe: roundToEuros(cfe),
    reductions,
    netDisponible: roundToEuros(netDisponible),
  };

  const result: StatusResultIS = {
    status: 'sasu-is',
    cotisations: roundToEuros(cotisations),
    impot: roundToEuros(impot),
    netDisponible: roundToEuros(netDisponible),
    tauxGlobal: roundTaux(tauxGlobal),
    remuneration: roundToEuros(brut),
    dividendes: roundToEuros(dividendesBruts),
    remunerationShare: roundTaux(remunerationShare),
    is: roundToEuros(is),
    dividendesNets: roundToEuros(dividendesNets),
    cotisationsSalariales: roundToEuros(regime.cotisationsSalariales),
    cotisationsPatronales: roundToEuros(regime.cotisationsPatronales),
    coutTotalEmployeur: roundToEuros(regime.coutTotalEmployeur),
    assietteSociale: roundToEuros(brut),
    revenuImposable: roundToEuros(remunerationImposable),
    cfe: roundToEuros(cfe),
    acreApplied: acreExoTaux > 0,
    detail,
  };
  return result;
};

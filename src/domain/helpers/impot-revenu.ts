/**
 * Impôt sur le revenu (IR) — shared pure chain (calc.md §2.3).
 *
 * barème par part → plafonnement du quotient familial → décote.
 * Reused by every status whose income flows through the household IR
 * (micro, ei-reel, eurl-ir, sasu-ir, and the rémunération leg of sasu-is).
 *
 * Order of operations is load-bearing (calc.md §1.4, CONV-2 / CONV-6 / CONV-10):
 *   1. applyBaremeIR on the quotient (revenuTotal / nbParts), scaled back × nbParts
 *   2. applyQuotientFamilial caps the extra-half-part advantage (QF_PLAFOND_DEMI_PART)
 *   3. applyDecote, AFTER plafonnement, BEFORE net
 * The taxable amount attributable to one status is the MARGINAL IR:
 *   IR(revenuImposable + autresRevenusFoyer) − IR(autresRevenusFoyer), at constant nbParts.
 */
import {
  BAREME_IR_TRANCHES,
  DECOTE_SEUIL_CELIBATAIRE,
  DECOTE_SEUIL_COUPLE,
  DECOTE_TAUX,
  NB_PARTS_BASE_CELIBATAIRE,
  NB_PARTS_BASE_COUPLE,
  QF_DEMI_PART,
  QF_PLAFOND_DEMI_PART,
} from '../constants';
import type { SituationFamiliale } from '../validation';

/**
 * Applies the progressive IR barème to a single quotient (revenu per part).
 * @param quotientParPart taxable revenue divided by the number of parts
 * @returns gross IR for one part, before quotient-familial scaling and décote
 */
export const applyBaremeIR = (quotientParPart: number): number => {
  let impot = 0;
  for (const tranche of BAREME_IR_TRANCHES) {
    if (quotientParPart <= tranche.min) break;
    const plafondTranche = Math.min(quotientParPart, tranche.max);
    impot += (plafondTranche - tranche.min) * tranche.taux;
  }
  return impot;
};

/**
 * Resolves the base parts de quotient familial (1 single / 2 couple), art. 194 CGI.
 * @param situationFamiliale household situation
 * @returns the structural base parts before dependent half-parts
 */
export const householdBaseParts = (situationFamiliale: SituationFamiliale): number =>
  situationFamiliale === 'marie_pacse' ? NB_PARTS_BASE_COUPLE : NB_PARTS_BASE_CELIBATAIRE;

type ApplyQuotientFamilialInput = {
  revenuImposableTotal: number;
  nbParts: number;
  situationFamiliale: SituationFamiliale;
};

/**
 * Computes IR with the quotient familial, capping the extra-half-part advantage.
 * No plafonnement when nbParts equals the household base (CONV-6).
 * @param input total taxable revenue, declared parts, and household situation
 * @returns IR after quotient-familial plafonnement, before décote
 */
export const applyQuotientFamilial = (input: ApplyQuotientFamilialInput): number => {
  const { revenuImposableTotal, nbParts, situationFamiliale } = input;
  const nbPartsBase = householdBaseParts(situationFamiliale);
  const impotFamilial = applyBaremeIR(revenuImposableTotal / nbParts) * nbParts;
  if (nbParts <= nbPartsBase) return impotFamilial;
  const impotBase = applyBaremeIR(revenuImposableTotal / nbPartsBase) * nbPartsBase;
  const avantage = impotBase - impotFamilial;
  const nbDemiPartsExtra = (nbParts - nbPartsBase) / QF_DEMI_PART;
  const avantageMax = nbDemiPartsExtra * QF_PLAFOND_DEMI_PART;
  if (avantage <= avantageMax) return impotFamilial;
  return impotBase - avantageMax;
};

type ApplyDecoteInput = {
  impot: number;
  situationFamiliale: SituationFamiliale;
};

/**
 * Applies the IR décote (art. 197-4 CGI), after quotient-familial plafonnement.
 * @param input gross IR after plafonnement and the household situation
 * @returns IR net of décote, floored at 0
 */
export const applyDecote = (input: ApplyDecoteInput): number => {
  const { impot, situationFamiliale } = input;
  const seuil = situationFamiliale === 'marie_pacse' ? DECOTE_SEUIL_COUPLE : DECOTE_SEUIL_CELIBATAIRE;
  const decote = Math.max(0, seuil - DECOTE_TAUX * impot);
  return Math.max(0, impot - decote);
};

type ComputeImpotRevenuInput = {
  revenuImposable: number;
  autresRevenusFoyer: number;
  nbParts: number;
  situationFamiliale: SituationFamiliale;
};

/**
 * Full household IR chain on a taxable base added to the foyer's other income.
 * @param input status taxable revenue, foyer other income, parts, situation
 * @returns household IR (barème → plafonnement QF → décote), floored at 0
 */
export const computeImpotRevenu = (input: ComputeImpotRevenuInput): number => {
  const { revenuImposable, autresRevenusFoyer, nbParts, situationFamiliale } = input;
  const impotApresPlaf = applyQuotientFamilial({
    revenuImposableTotal: revenuImposable + autresRevenusFoyer,
    nbParts,
    situationFamiliale,
  });
  return applyDecote({ impot: impotApresPlaf, situationFamiliale });
};

/**
 * Marginal IR attributable to a status: IR(rev + autres) − IR(autres), constant nbParts (CONV-2).
 * @param input status taxable revenue, foyer other income, parts, situation
 * @returns the incremental household IR caused by this status' taxable revenue
 */
export const computeMarginalImpotRevenu = (input: ComputeImpotRevenuInput): number =>
  computeImpotRevenu(input) - computeImpotRevenu({ ...input, revenuImposable: 0 });

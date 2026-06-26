/**
 * Impôt sur les sociétés (IS) — two-bracket computation (spec §D.2).
 *
 * IS = IS_TAUX_REDUIT × min(baseIS, IS_PLAFOND_TAUX_REDUIT)
 *    + IS_TAUX_NORMAL × max(0, baseIS − IS_PLAFOND_TAUX_REDUIT)
 *
 * The reduced rate is a PME advantage gated on CA HT ≤ IS_CA_PLAFOND_PME_TAUX_REDUIT
 * (and capital conditions assumed met for a single-owner EURL/SASU). Above the CA
 * gate the whole base takes the normal rate. Reused by eurl-is and sasu-is.
 */
import { IS_CA_PLAFOND_PME_TAUX_REDUIT, IS_PLAFOND_TAUX_REDUIT, IS_TAUX_NORMAL, IS_TAUX_REDUIT } from '../constants';

type ComputeImpotSocietesInput = {
  baseIS: number;
  caTotal: number;
};

/**
 * Computes corporate income tax on a taxable base, applying the PME reduced bracket.
 * @param input the IS taxable base and the company CA HT (PME reduced-rate gate)
 * @returns IS due in euros (0 when the base is non-positive)
 */
export const computeImpotSocietes = (input: ComputeImpotSocietesInput): number => {
  const { baseIS, caTotal } = input;
  if (baseIS <= 0) return 0;
  const reducedEligible = caTotal <= IS_CA_PLAFOND_PME_TAUX_REDUIT;
  if (!reducedEligible) return IS_TAUX_NORMAL * baseIS;
  const fractionReduite = Math.min(baseIS, IS_PLAFOND_TAUX_REDUIT);
  const fractionNormale = Math.max(0, baseIS - IS_PLAFOND_TAUX_REDUIT);
  return IS_TAUX_REDUIT * fractionReduite + IS_TAUX_NORMAL * fractionNormale;
};

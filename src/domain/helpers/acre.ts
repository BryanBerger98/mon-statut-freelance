/**
 * ACRE — exonération de début d'activité (micro variant, CONV-7).
 *
 * Micro ACRE reduces ONLY the cotisations sociales (not CFP, not CFE) by an
 * exonération rate that is date-conditioned (registry §10): 50 % when the
 * activity starts before ACRE_MICRO_DATE_BASCULE, 25 % on/after it.
 * The start date is a CONSTANT Profile input — never the system clock (calc.md §2.2).
 */
import { ACRE_MICRO_DATE_BASCULE, ACRE_TAUX_EXO_AVANT_20260701, ACRE_TAUX_EXO_DES_20260701 } from '../constants';

type MicroAcreExoTauxInput = {
  firstYear: boolean;
  dateDebutActivite: string;
};

/**
 * Resolves the micro ACRE exonération rate applied to cotisations sociales.
 * @param input year-1 flag and the ISO activity start date (constant input)
 * @returns 0 when not year 1, else the date-split exonération ratio
 */
export const microAcreExoTaux = (input: MicroAcreExoTauxInput): number => {
  const { firstYear, dateDebutActivite } = input;
  if (!firstYear) return 0;
  // ISO 'YYYY-MM-DD' strings compare lexicographically as dates — deterministic, no clock.
  return dateDebutActivite < ACRE_MICRO_DATE_BASCULE ? ACRE_TAUX_EXO_AVANT_20260701 : ACRE_TAUX_EXO_DES_20260701;
};

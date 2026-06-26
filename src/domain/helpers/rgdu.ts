/**
 * RGDU — réduction générale dégressive unique (spec §B.2bis).
 *
 * The single degressive reduction on EMPLOYER cotisations that, from 2026-01-01,
 * replaces the abolished 2,5 / 3,5 SMIC reduced-rate bandeaux (décret n° 2026-509,
 * art. L.241-13 CSS). It is degressive from RGDU_COEFF_MAX at 1 SMIC to 0 at
 * RGDU_SMIC_PLAFOND_MULTIPLE SMIC (3 SMIC), then nil above.
 *
 * Scope (D6 LOCKED): applies to a salarié WITH a contrat de travail — i.e. the
 * salarié porté (`portage-salarial`) only. A dirigeant assimilé-salarié (SASU
 * président) has no contrat de travail and is NEVER eligible; callers pass the
 * already-resolved eligibility, this helper only owns the formula.
 *
 * Uses the FROZEN 2026-01-01 SMIC (SMIC_ANNUEL_BRUT), never the in-force SMIC.
 */
import {
  RGDU_COEFF_MAX,
  RGDU_PARAM_EXPOSANT_P,
  RGDU_PARAM_TDELTA,
  RGDU_PARAM_TMIN,
  RGDU_SMIC_PLAFOND_MULTIPLE,
  SMIC_ANNUEL_BRUT,
} from '../constants';

/**
 * Computes the RGDU employer-cotisation reduction for an annual gross salary.
 * @param brut the annual gross salary (brut) the reduction is computed on
 * @returns the reducible patronal amount in euros (0 below/at a non-positive brut or at/above 3 SMIC)
 */
export const reductionGeneraleDegressive = (brut: number): number => {
  if (brut <= 0) return 0;
  const plafond = RGDU_SMIC_PLAFOND_MULTIPLE * SMIC_ANNUEL_BRUT;
  if (brut >= plafond) return 0;
  const bracket = 0.5 * (plafond / brut - 1);
  const coeff = Math.min(RGDU_COEFF_MAX, RGDU_PARAM_TMIN + RGDU_PARAM_TDELTA * bracket ** RGDU_PARAM_EXPOSANT_P);
  return coeff * brut;
};

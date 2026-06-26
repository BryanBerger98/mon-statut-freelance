/**
 * Taxation des dividendes — prélèvement forfaitaire unique (PFU) ou option barème
 * (spec §D.3, CONV-3).
 *
 * Capital-treated dividends are taxed two ways:
 *   • PFU (default): a flat IR part (PFU_PART_IR, booked under `impot`) + the
 *     prélèvements sociaux (PFU_PART_PS, booked under `cotisations`, CONV-3).
 *   • Option barème IR: the IR flat part is dropped; instead the gross dividend
 *     minus the 40 % abattement (DIVIDENDES_ABATTEMENT_BAREME) joins the household
 *     IR barème (returned as `baremeImposable` for the status module to fold into
 *     its marginal IR). The prélèvements sociaux still apply on the gross.
 *
 * `dividendesCapital` is the portion taxed as CAPITAL income:
 *   • sasu-is — the whole gross dividend (président = assimilé-salarié, never TNS).
 *   • eurl-is — only the fraction ≤ 10 % of capital+CCA; the excess bears TNS in the
 *     cotisations cascade and is NOT passed here.
 */
import { DIVIDENDES_ABATTEMENT_BAREME, PFU_PART_IR, PFU_PART_PS } from '../constants';

type DividendesTaxInput = {
  dividendesCapital: number;
  optionBaremeDividendes: boolean;
};

type DividendesTaxResult = {
  /** Prélèvements sociaux on the capital dividend — booked under `cotisations` (CONV-3). */
  prelevementsSociaux: number;
  /** Flat IR part (PFU path only) — booked under `impot`. */
  flatTaxIR: number;
  /** Abated dividend to add to the household IR barème (option path only). */
  baremeImposable: number;
};

/**
 * Splits dividend taxation into its PS / flat-IR / barème-imposable components.
 * @param input the capital-treated gross dividend and the barème-option flag
 * @returns the prélèvements sociaux, flat IR part, and barème-imposable amount
 */
export const computeDividendesTax = (input: DividendesTaxInput): DividendesTaxResult => {
  const { dividendesCapital, optionBaremeDividendes } = input;
  const base = Math.max(0, dividendesCapital);
  return {
    prelevementsSociaux: PFU_PART_PS * base,
    flatTaxIR: optionBaremeDividendes ? 0 : PFU_PART_IR * base,
    baremeImposable: optionBaremeDividendes ? base * (1 - DIVIDENDES_ABATTEMENT_BAREME) : 0,
  };
};

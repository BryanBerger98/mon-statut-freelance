/**
 * PASS-banded assiette helpers — shared by every réel/régime-général cotisation
 * whose rate applies to a tranche of the assiette expressed in PASS multiples
 * (calc.md §1.2; spec §0.1).
 *
 * The PASS (plafond annuel de la sécurité sociale) is the unit of nearly every
 * social tranche bound; `trancheMontant` extracts the euro slice of an assiette
 * lying between two PASS multiples, and `clampMontant` applies the plancher /
 * plafond bounds of the §A.1 forfaitaire abattement.
 */
import { PASS_ANNUEL } from '../constants';

type TrancheMontantInput = {
  assiette: number;
  lowPass: number;
  highPass: number;
};

/**
 * Euro amount of an assiette inside the [lowPass × PASS, highPass × PASS] band.
 * @param input assiette in euros and the band bounds as PASS multiples
 * @returns max(0, min(assiette, highPass × PASS) − lowPass × PASS)
 */
export const trancheMontant = (input: TrancheMontantInput): number => {
  const { assiette, lowPass, highPass } = input;
  const high = highPass === Number.POSITIVE_INFINITY ? assiette : highPass * PASS_ANNUEL;
  return Math.max(0, Math.min(assiette, high) - lowPass * PASS_ANNUEL);
};

type ClampMontantInput = {
  value: number;
  min: number;
  max: number;
};

/**
 * Clamps a value to a closed [min, max] interval (used by the 26 % abattement bounds).
 * @param input the raw value and its inclusive lower/upper bounds
 * @returns value constrained to [min, max]
 */
export const clampMontant = (input: ClampMontantInput): number => {
  const { value, min, max } = input;
  return Math.min(max, Math.max(min, value));
};

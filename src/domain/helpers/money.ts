/**
 * Rounding helpers — applied ONLY at the result boundary (calc.md §2.1).
 * Never round mid-pipeline.
 */

/**
 * Rounds a monetary amount to the nearest euro cent (2 decimals).
 * @param amount raw computed amount in euros
 * @returns amount rounded to 2 decimal places
 */
export const roundToEuros = (amount: number): number => Math.round(amount * 100) / 100;

/**
 * Rounds an effective-rate ratio to 4 decimals (taux global contract).
 * @param taux raw ratio in [0, 1]
 * @returns taux rounded to 4 decimal places
 */
export const roundTaux = (taux: number): number => Math.round(taux * 10000) / 10000;

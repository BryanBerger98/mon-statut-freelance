/**
 * French (fr-FR) display formatters for the simulator UI.
 *
 * Presentation only — NO business logic, NO numbers (rates/seuils live in
 * `src/domain/constants.ts`). `Intl.NumberFormat` is a deterministic built-in
 * (not the clock / random), so it is allowed here even though `src/domain/`
 * forbids side effects (calc.md §2.2 only bans Date/Math.random).
 */

/** Euros, no cents, French grouping (e.g. `12 345 €`). */
const eurosFormatter = new Intl.NumberFormat('fr-FR', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 0,
});

/** Signed euros, no cents (e.g. `+1 234 €`, `-1 234 €`). */
const signedEurosFormatter = new Intl.NumberFormat('fr-FR', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 0,
  signDisplay: 'exceptZero',
});

/** Percentage from a 0–1 ratio, one decimal (e.g. `21,2 %`). */
const percentFormatter = new Intl.NumberFormat('fr-FR', {
  style: 'percent',
  maximumFractionDigits: 1,
});

/**
 * Formats an amount as whole euros in French style.
 * @param value amount in euros
 * @returns localized euro string (e.g. `12 345 €`)
 */
export const formatEuros = (value: number): string => eurosFormatter.format(Math.round(value));

/**
 * Formats a yearly amount as a monthly euro figure (value / 12).
 * @param value yearly amount in euros
 * @returns localized monthly euro string (e.g. `1 029 €/mois`)
 */
export const formatEurosPerMonth = (value: number): string => `${eurosFormatter.format(Math.round(value / 12))}/mois`;

/**
 * Formats a signed delta in whole euros (zero rendered without a sign).
 * @param value signed amount in euros
 * @returns localized signed euro string (e.g. `+1 234 €`)
 */
export const formatSignedEuros = (value: number): string => signedEurosFormatter.format(Math.round(value));

/**
 * Formats a signed yearly delta as a signed monthly euro figure (value / 12).
 * @param value signed yearly amount in euros
 * @returns localized signed monthly euro string (e.g. `+1 029 €/mois`)
 */
export const formatSignedEurosPerMonth = (value: number): string => `${signedEurosFormatter.format(Math.round(value / 12))}/mois`;

/**
 * Formats a 0–1 ratio as a French percentage.
 * @param ratio share in [0, 1]
 * @returns localized percentage string (e.g. `21,2 %`)
 */
export const formatPercent = (ratio: number): string => percentFormatter.format(ratio);

/**
 * Formats a 0–100 composite score as a rounded integer.
 * @param score composite score in [0, 100]
 * @returns the score rounded to the nearest integer, as a string
 */
export const formatScore = (score: number): string => String(Math.round(score));

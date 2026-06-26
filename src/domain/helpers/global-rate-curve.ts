/**
 * Piecewise-linear GLOBAL-rate cotisation helper (spec §A.3 D3′).
 *
 * Several TNS cotisations (maladie-maternité, allocations familiales) are not a
 * flat rate: the URSSAF publishes a *taux global* that varies with the assiette
 * expressed as a fraction of the PASS, then — for maladie — a flat MARGINAL rate
 * applies to the slice above a threshold (3 PASS). A `GlobalRateCurve`
 * (constants.ts) holds the ascending `[fractionOfPASS, globalRate]` knots plus the
 * marginal band; this helper resolves the cotisation montant from an assiette.
 *
 * CRITICAL (spec §A.3 maladie formula): the interpolated global rate applies only
 * to the assiette CAPPED at `marginalSeuilPass × PASS`; the marginal rate applies
 * to the excess. For a curve with no marginal band (`marginalSeuilPass = +∞`) the
 * whole assiette takes the global rate and the marginal term is 0.
 */

import type { GlobalRateCurve } from '../constants';
import { PASS_ANNUEL } from '../constants';

type InterpolateGlobalRateInput = {
  curve: GlobalRateCurve;
  fractionPass: number;
};

/**
 * Linearly interpolates the global rate of a curve at an assiette fraction of PASS.
 * Flat-extrapolated below the first knot and above the last (spec §A.3 D3′).
 * @param input the rate curve and the assiette expressed as a fraction of the PASS
 * @returns the interpolated global rate (ratio)
 */
export const interpolateGlobalRate = (input: InterpolateGlobalRateInput): number => {
  const { curve, fractionPass } = input;
  const { knots } = curve;
  const first = knots[0];
  if (!first) return 0;
  if (fractionPass <= first[0]) return first[1];
  for (let i = 1; i < knots.length; i++) {
    const prev = knots[i - 1];
    const next = knots[i];
    if (!prev || !next) break;
    if (fractionPass <= next[0]) {
      const [prevFraction, prevRate] = prev;
      const [nextFraction, nextRate] = next;
      const span = nextFraction - prevFraction;
      if (span <= 0) return nextRate;
      const ratio = (fractionPass - prevFraction) / span;
      return prevRate + ratio * (nextRate - prevRate);
    }
  }
  const last = knots[knots.length - 1];
  return last ? last[1] : 0;
};

type GlobalRateCurveCotisationInput = {
  assiette: number;
  curve: GlobalRateCurve;
};

/**
 * Cotisation montant for a global-rate curve: global rate on the capped assiette
 * plus the marginal rate on the slice above `marginalSeuilPass × PASS` (spec §A.3).
 * @param input the assiette in euros and the cotisation's global-rate curve
 * @returns the cotisation amount in euros (0 when assiette ≤ 0)
 */
export const globalRateCurveCotisation = (input: GlobalRateCurveCotisationInput): number => {
  const { assiette, curve } = input;
  if (assiette <= 0) return 0;
  const globalRate = interpolateGlobalRate({ curve, fractionPass: assiette / PASS_ANNUEL });
  const marginalSeuil = curve.marginalSeuilPass === Number.POSITIVE_INFINITY ? assiette : curve.marginalSeuilPass * PASS_ANNUEL;
  const globalBase = Math.min(assiette, marginalSeuil);
  const marginalBase = Math.max(0, assiette - marginalSeuil);
  return globalRate * globalBase + curve.marginalTaux * marginalBase;
};

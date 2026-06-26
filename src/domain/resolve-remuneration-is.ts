/**
 * IS rémunération sweep — derives the salaire/dividende split for the two
 * IS statuses (eurl-is, sasu-is) from a high-level user preference (A10).
 *
 * The status modules take `remunerationChoisie` / `partDividendes` as *inputs*;
 * this orchestrator chooses them. It sits ABOVE the status modules (like
 * `scoring.ts`): it clones the Profile and calls the unchanged
 * `computeEurlIs` / `computeSasuIs`, so it never touches a formula and the calc
 * fixtures stay green.
 *
 * Two preferences (tax-social-modeler spec + product-owner ruling):
 *  - `immediate`     — maximise net disponible (cash en poche). netDisponible is
 *                      piecewise-linear in the rémunération R, so the optimum sits
 *                      at a breakpoint; we find it with a bounded coarse→fine grid
 *                      search over the affordable range [0, Rmax], partDividendes=1.
 *  - `capitalisation`— minimal salary (R=0) and distribute the after-IS remainder
 *                      as dividends (partDividendes=1). Product-owner decision
 *                      (encoding "a"): the profit is NOT retained in the company —
 *                      netDisponible stays "cash en poche" and comparable to the
 *                      no-lever statuses, and C-CAP (a fixed per-status ladder) is
 *                      left untouched. User-facing copy must therefore NOT claim the
 *                      profit "stays in the company".
 *
 * `optionBaremeDividendes` is forced `true` on every candidate so the engine keeps
 * the better of PFU vs barème for the dividend taxation.
 *
 * Pure & deterministic (calc.md §1.1 / §2.2): fixed iteration counts, no clock,
 * no random. Search-resolution constants below are algorithm tuning, not barèmes.
 */

import { computeEurlIs } from './statuses/eurl-is';
import { computeSasuIs } from './statuses/sasu-is';
import type { StatusComputeIS } from './statuses/types';
import type { Profile, StatusId, StatusResultIS } from './validation';

/** The two statuses whose split this module derives. */
export type IsStatusId = 'eurl-is' | 'sasu-is';

/** High-level rémunération preference (product-spec A10). */
export type RemunerationPreference = 'immediate' | 'capitalisation';

/** Input to the rémunération sweep. */
export type ResolveRemunerationInput = {
  profile: Profile;
  status: IsStatusId;
  preference: RemunerationPreference;
};

/** The chosen split plus the full engine result it produces. */
export type ResolvedRemuneration = {
  /** Chosen cotised rémunération (gross), in euros. */
  remunerationChoisie: number;
  /** Chosen share of after-IS profit distributed as dividends (0–1). */
  partDividendes: number;
  /** Always true — engine keeps the better of PFU vs barème. */
  optionBaremeDividendes: boolean;
  /** The winning candidate's full StatusResultIS. */
  result: StatusResultIS;
};

const IS_COMPUTE: Record<IsStatusId, StatusComputeIS> = {
  'eurl-is': computeEurlIs,
  'sasu-is': computeSasuIs,
};

/**
 * Search resolution — NOT barèmes. The optimum of a piecewise-linear function
 * over [0, Rmax] is at a kink; the coarse grid brackets it, the fine grid (one
 * coarse step either side of the coarse winner) pins it to ~1 € of the breakpoint.
 */
const SWEEP_COARSE_STEPS = 256;
const SWEEP_FINE_STEPS = 256;
/** Bisection steps for the affordability ceiling Rmax (≈ 2^-64 of the range). */
const RMAX_BISECTION_STEPS = 64;
/** Bisection steps for the override salary solver (≈ 2^-64 of the range). */
const OVERRIDE_BISECTION_STEPS = 64;
/** Calendar identity — mensualised target × 12 = annual target. Not a barème. */
const MONTHS_PER_YEAR = 12;

/** Clones the profile with a given split; forces barème/PFU optimisation on. */
const withSplit = (input: { profile: Profile; remuneration: number; partDividendes: number }): Profile => ({
  ...input.profile,
  remunerationChoisie: input.remuneration,
  partDividendes: input.partDividendes,
  optionBaremeDividendes: true,
});

/** Runs one engine evaluation for a candidate split. */
const evaluate = (input: {
  compute: StatusComputeIS;
  profile: Profile;
  status: IsStatusId;
  remuneration: number;
  partDividendes: number;
}): StatusResultIS =>
  input.compute({
    profile: withSplit({ profile: input.profile, remuneration: input.remuneration, partDividendes: input.partDividendes }),
    status: input.status,
  });

/**
 * Affordability ceiling: the largest rémunération R for which the company still
 * has a positive IS base. The engine does not expose baseIS, but `is > 0 ⟺
 * baseIS > 0` (computeImpotSocietes returns 0 iff baseIS ≤ 0), and baseIS is
 * monotone-decreasing in R — so we bisect on the predicate `result.is > 0`.
 * Above Rmax the engine reports a fictitious salary-only net (the company paying
 * a salary it cannot fund), which the sweep must never pick.
 */
const findRmax = (input: { compute: StatusComputeIS; profile: Profile; status: IsStatusId; benefice: number }): number => {
  if (input.benefice <= 0) return 0;
  const isAffordable = (remuneration: number): boolean =>
    (evaluate({ compute: input.compute, profile: input.profile, status: input.status, remuneration, partDividendes: 1 }).is ?? 0) > 0;
  // Not even R=0 leaves a positive base (bénéfice below the minimum cotisations) → no room.
  if (!isAffordable(0)) return 0;
  let lo = 0;
  let hi = input.benefice; // baseIS(benefice) = bénéfice − R − cotis < 0, so hi is unaffordable.
  for (let step = 0; step < RMAX_BISECTION_STEPS; step += 1) {
    const mid = (lo + hi) / 2;
    if (isAffordable(mid)) lo = mid;
    else hi = mid;
  }
  return lo;
};

/**
 * Net-maximising sweep over [0, Rmax] with partDividendes=1. Coarse grid then a
 * fine grid one coarse step either side of the coarse winner. Tie-break: on an
 * equal (cent-quantised) net, prefer the larger R — more cotised income, higher
 * social protection. `>=` keeps the last (largest-R) maximiser since R ascends.
 */
const sweepImmediate = (input: { compute: StatusComputeIS; profile: Profile; status: IsStatusId; rmax: number }): StatusResultIS => {
  const evalAt = (remuneration: number): StatusResultIS =>
    evaluate({ compute: input.compute, profile: input.profile, status: input.status, remuneration, partDividendes: 1 });
  if (input.rmax <= 0) return evalAt(0);

  let best = evalAt(0);
  let bestR = 0;
  const coarseStep = input.rmax / SWEEP_COARSE_STEPS;
  for (let i = 0; i <= SWEEP_COARSE_STEPS; i += 1) {
    const remuneration = i * coarseStep;
    const candidate = evalAt(remuneration);
    if (candidate.netDisponible >= best.netDisponible) {
      best = candidate;
      bestR = remuneration;
    }
  }

  const fineLo = Math.max(0, bestR - coarseStep);
  const fineHi = Math.min(input.rmax, bestR + coarseStep);
  const fineStep = (fineHi - fineLo) / SWEEP_FINE_STEPS;
  for (let j = 0; j <= SWEEP_FINE_STEPS; j += 1) {
    const remuneration = fineLo + j * fineStep;
    const candidate = evalAt(remuneration);
    if (candidate.netDisponible >= best.netDisponible) {
      best = candidate;
      bestR = remuneration;
    }
  }
  return best;
};

/**
 * Resolves the split from the user's EXPLICIT targets (cibleSalaireNetMensuel /
 * cibleDividendesBruts) instead of auto-optimising. Salary: bisect the gross R whose
 * net-after-tax salary hits `cibleSalaireNetMensuel × 12`, bounded by the
 * affordability ceiling Rmax; if the target exceeds what the company can fund, take
 * Rmax. Dividends: distribute the chosen gross target as a fraction of the after-IS
 * résultat at that R (clamped to [0, 1]). The net-after-tax salary probe is
 * `netDisponible(partDividendes = 0) + CFE` — monotone-increasing in R, so bisection
 * converges. Pure & deterministic (fixed step count, no clock/random).
 * @param input the compute fn, base profile, IS status, and the affordability ceiling
 * @returns the resolved gross rémunération and dividend share
 */
const solveOverrideSplit = (input: {
  compute: StatusComputeIS;
  profile: Profile;
  status: IsStatusId;
  rmax: number;
}): { remuneration: number; partDividendes: number } => {
  const netAfterTaxSalary = (remuneration: number): number => {
    const result = evaluate({ compute: input.compute, profile: input.profile, status: input.status, remuneration, partDividendes: 0 });
    return result.netDisponible + (result.cfe ?? 0);
  };

  const targetNetAnnual = input.profile.cibleSalaireNetMensuel * MONTHS_PER_YEAR;
  let remuneration = 0;
  if (targetNetAnnual > 0 && input.rmax > 0) {
    if (netAfterTaxSalary(input.rmax) <= targetNetAnnual) {
      // Target unreachable within the affordable range — take the most the company can fund.
      remuneration = input.rmax;
    } else {
      let lo = 0;
      let hi = input.rmax;
      for (let step = 0; step < OVERRIDE_BISECTION_STEPS; step += 1) {
        const mid = (lo + hi) / 2;
        if (netAfterTaxSalary(mid) < targetNetAnnual) lo = mid;
        else hi = mid;
      }
      remuneration = (lo + hi) / 2;
    }
  }

  // Gross dividends available if the WHOLE after-IS résultat were distributed at this R.
  const resultatApresIS = evaluate({
    compute: input.compute,
    profile: input.profile,
    status: input.status,
    remuneration,
    partDividendes: 1,
  }).dividendes;
  const cibleDiv = input.profile.cibleDividendesBruts;
  const partDividendes = cibleDiv > 0 && resultatApresIS > 0 ? Math.min(1, Math.max(0, cibleDiv / resultatApresIS)) : 0;

  return { remuneration, partDividendes };
};

/**
 * Derives the rémunération/dividende split for an IS status from the user's
 * A10 preference, returning the chosen inputs plus the engine result they yield.
 * @param input the base profile, the IS status, and the preference
 * @returns the resolved split and its full StatusResultIS
 */
export const resolveRemunerationIs = (input: ResolveRemunerationInput): ResolvedRemuneration => {
  const compute = IS_COMPUTE[input.status];
  const caTotal = input.profile.caVente + input.profile.caServiceBIC + input.profile.caServiceBNC;
  const benefice = caTotal - input.profile.chargesReelles;

  if (input.preference === 'capitalisation') {
    const result = evaluate({ compute, profile: input.profile, status: input.status, remuneration: 0, partDividendes: 1 });
    return { remunerationChoisie: 0, partDividendes: 1, optionBaremeDividendes: true, result };
  }

  const rmax = findRmax({ compute, profile: input.profile, status: input.status, benefice });
  const result = sweepImmediate({ compute, profile: input.profile, status: input.status, rmax });
  return { remunerationChoisie: result.remuneration, partDividendes: 1, optionBaremeDividendes: true, result };
};

/**
 * Builds the per-status profile for the ranking pipeline: for the two IS statuses
 * it runs the sweep and bakes the resolved split into a profile clone; for the
 * other five statuses it returns the profile unchanged. Pass this to
 * `rankStatuses`' `profileFor` so each status is computed with its own split.
 * @param input the base profile, the target status, and the IS preference
 * @returns the profile to feed the status' compute function
 */
export const optimizedProfileFor = (input: { profile: Profile; status: StatusId; preference: RemunerationPreference }): Profile => {
  if (input.status !== 'eurl-is' && input.status !== 'sasu-is') return input.profile;

  // Explicit override (eurl-is/sasu-is only): when the user fixed a target salary
  // and/or dividends, solve the split to those targets instead of auto-optimising.
  const overrideActive = input.profile.cibleSalaireNetMensuel > 0 || input.profile.cibleDividendesBruts > 0;
  if (overrideActive) {
    const compute = IS_COMPUTE[input.status];
    const caTotal = input.profile.caVente + input.profile.caServiceBIC + input.profile.caServiceBNC;
    const benefice = caTotal - input.profile.chargesReelles;
    const rmax = findRmax({ compute, profile: input.profile, status: input.status, benefice });
    const split = solveOverrideSplit({ compute, profile: input.profile, status: input.status, rmax });
    return withSplit({ profile: input.profile, remuneration: split.remuneration, partDividendes: split.partDividendes });
  }

  const resolved = resolveRemunerationIs({ profile: input.profile, status: input.status, preference: input.preference });
  return withSplit({ profile: input.profile, remuneration: resolved.remunerationChoisie, partDividendes: resolved.partDividendes });
};

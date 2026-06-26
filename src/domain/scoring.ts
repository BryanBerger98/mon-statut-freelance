/**
 * Scoring & ranking engine — turns the 7 computed `StatusResult`s for one profile
 * into a ranked, explained recommendation. Pure transcription of
 * `.claude/docs/business/product/scoring-model.md` (v2.0, user-driven weighting).
 *
 * Separation of concerns (scoring-model.md §0/§8): the 0–100 ordinal anchors,
 * `RANK_POINTS`, `protFloor`/`protFull`, `evolStruct` and `ε` are **product
 * constants owned here** — judgments derived from the status fiches, NOT regulatory
 * rates. Only the regulatory plafonds (`MICRO_PLAFOND_*`) are imported from
 * `constants.ts` by name. This file never recomputes a euro figure — it consumes
 * the engine's `netDisponible` / `remunerationShare` (calc.md §1.1: the engine
 * imports cleanly into this layer).
 *
 * Pipeline (§§1–4): per-criterion 0–100 scores → rank→weights transform →
 * weighted aggregation → eligibility flags → tie-broken ranking → recommendation
 * slot (top non-flagged). Deterministic: same input → byte-identical output
 * (AC-S1.2), no clock/randomness.
 */
import { MICRO_PLAFOND_SERVICE_BNC, MICRO_PLAFOND_VENTE } from './constants';
import { roundToEuros } from './helpers/money';
import { statusRegistry } from './statuses';
import { type Profile, type StatusId, type StatusResult, statusIdValidation, statusResultISValidation } from './validation';

// ---------------------------------------------------------------------------
// Criteria
// ---------------------------------------------------------------------------

/** The 5 rankable comparison criteria (scoring-model.md §1, §3 — C-PLAF merged into C-EVOL). */
export type CriterionCode = 'C-NET' | 'C-PROT' | 'C-SIMP' | 'C-CAP' | 'C-EVOL';

/** Canonical criterion order — also the default seed ranking (§2 "seed order"). */
export const CRITERION_CODES: readonly CriterionCode[] = ['C-NET', 'C-PROT', 'C-SIMP', 'C-CAP', 'C-EVOL'];

/** A 0–100 score (or a contribution / weight) per criterion. */
export type CriterionScores = Record<CriterionCode, number>;

/**
 * A ranking is an ordered list of buckets, most → least important. A bucket holds
 * one criterion (strict order) or several marked "équivalents" (§2 ties). The
 * buckets must form a permutation of `CRITERION_CODES`.
 */
export type Ranking = readonly (readonly CriterionCode[])[];

/** Seed ranking (strict `[C-NET, C-PROT, C-SIMP, C-CAP, C-EVOL]`) — the first result with minimal input (§2). */
export const SEED_RANKING: Ranking = CRITERION_CODES.map((code) => [code]);

// ---------------------------------------------------------------------------
// Scoring configuration — PRODUCT constants (scoring-model.md §1 consolidated table)
// ---------------------------------------------------------------------------

/** Product-owned scoring constants — NOT regulatory (see file header / §8). */
type ScoringConfig = {
  /** Fully-salaried protection anchor per status (all income cotised). */
  protFull: Record<StatusId, number>;
  /** Zero-rémunération protection anchor — only IS statuses can collapse rights. */
  protFloor: Partial<Record<StatusId, number>>;
  /** Fixed simplicité administrative ladder (higher = simpler). */
  cSimp: Record<StatusId, number>;
  /** Fixed capitalisation & optimisation ladder. */
  cCap: Record<StatusId, number>;
  /** Fixed structural évolutivité (the non-headroom half of C-EVOL). */
  evolStruct: Record<StatusId, number>;
  /** Linear rank points for positions 1..5; weight = 100 × points / Σ. */
  rankPoints: readonly number[];
  /** Tie-break band on the composite score, in points. */
  epsilon: number;
};

/** The frozen scoring configuration (scoring-model.md §1 "Consolidated fixed anchors" + §2 + §4). */
export const SCORING_CONFIG: ScoringConfig = {
  protFull: {
    'micro-entreprise': 40,
    'ei-reel': 44,
    'eurl-ir': 44,
    'eurl-is': 44,
    'sasu-ir': 63,
    'sasu-is': 63,
    'portage-salarial': 89,
  },
  protFloor: {
    'eurl-is': 12,
    'sasu-is': 10,
  },
  cSimp: {
    'micro-entreprise': 100,
    'portage-salarial': 85,
    'ei-reel': 65,
    'eurl-ir': 45,
    'eurl-is': 40,
    'sasu-ir': 25,
    'sasu-is': 20,
  },
  cCap: {
    'sasu-is': 90,
    'eurl-is': 82,
    'sasu-ir': 35,
    'eurl-ir': 35,
    'ei-reel': 25,
    'micro-entreprise': 15,
    'portage-salarial': 10,
  },
  evolStruct: {
    'sasu-ir': 100,
    'sasu-is': 100,
    'eurl-ir': 80,
    'eurl-is': 80,
    'ei-reel': 50,
    'micro-entreprise': 30,
    'portage-salarial': 30,
  },
  rankPoints: [5, 4, 3, 2, 1],
  epsilon: 0.05,
};

/** Canonical status order — the final tie-break (scoring-model.md §4 step 5). */
const CANONICAL_ORDER: readonly StatusId[] = statusIdValidation.options;

// ---------------------------------------------------------------------------
// Output shape
// ---------------------------------------------------------------------------

/** Why a status is barred from the recommendation slot (still ranked). */
export type FlagReason = 'plafond-overrun' | 'non-viable';

/** One scored, ranked status — carries the breakdown so the UI shows "the why" without recomputing. */
export type ScoredStatus = {
  status: StatusId;
  /** The raw engine output (netDisponible, cotisations, impot, flags…). */
  result: StatusResult;
  /** 0–100 score per criterion. */
  criterionScores: CriterionScores;
  /** w_c × score_c / 100 per criterion (stacks to `score`). */
  contributions: CriterionScores;
  /** Composite 0–100 score. */
  score: number;
  /** 1-based position after tie-broken sort. */
  rank: number;
  /** Ranked but barred from the recommendation slot (micro overrun / non-viable). */
  flagged: boolean;
  /** Why it is flagged, or null. */
  flagReason: FlagReason | null;
  /** True for the single recommended status (top non-flagged). */
  recommended: boolean;
  /** € that this status' netDisponible trails the best net in the run (≥ 0; 0 for the leader). */
  netDelta: number;
};

/** The full ranking outcome for one profile. */
export type RankingResult = {
  /** Statuses sorted best → worst (tie-broken). */
  ranked: ScoredStatus[];
  /** Weight per criterion (0–100, summing to 100), for the "pourquoi ces poids" copy. */
  weights: CriterionScores;
  /** Top non-flagged status, or null if every status is flagged. */
  recommendation: StatusId | null;
  /** True when no status reaches a positive net (net_max ≤ 0) — profile non viable (§1 guard). */
  nonViable: boolean;
};

/** Input to the top-level ranking pipeline. */
export type RankStatusesInput = {
  profile: Profile;
  /** Criteria ranking; defaults to `SEED_RANKING` when the user has not ranked yet. */
  ranking?: Ranking;
  /**
   * Optional per-status profile override. Lets the caller feed each status its own
   * profile — used by the simulator to apply the IS rémunération sweep
   * (`optimizedProfileFor`) so eurl-is / sasu-is are computed at their resolved
   * salaire/dividende split. Defaults to the identity (every status gets `profile`),
   * keeping the scoring fixtures' behaviour unchanged.
   */
  profileFor?: (status: StatusId) => Profile;
};

// ---------------------------------------------------------------------------
// Small pure helpers
// ---------------------------------------------------------------------------

/** Clamps a ratio to [0, 1]. */
const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

/** Rounds a 0–100 score to 2 decimals at the output boundary (determinism, AC-S1.2). */
const roundScore = (value: number): number => Math.round(value * 100) / 100;

/** Sums an array of numbers. */
const sum = (values: readonly number[]): number => values.reduce((total, value) => total + value, 0);

// ---------------------------------------------------------------------------
// Rank → weights transform (scoring-model.md §2)
// ---------------------------------------------------------------------------

/**
 * Turns a criteria ranking into a weight vector summing to 100. Tied criteria in a
 * bucket share the average of the rank points for the positions they occupy
 * (fractional ranking), so the total stays Σ rankPoints (§2 "Ties").
 * @param ranking ordered buckets — must be a permutation of `CRITERION_CODES`
 * @returns weight per criterion (0–100), summing to 100
 */
export const weightsFromRanking = (ranking: Ranking): CriterionScores => {
  assertPermutation(ranking);
  const totalPoints = sum(SCORING_CONFIG.rankPoints);
  const weights: Partial<CriterionScores> = {};
  let position = 0;
  for (const bucket of ranking) {
    const slice = SCORING_CONFIG.rankPoints.slice(position, position + bucket.length);
    const averagePoints = sum(slice) / bucket.length;
    for (const code of bucket) {
      weights[code] = (100 * averagePoints) / totalPoints;
    }
    position += bucket.length;
  }
  // assertPermutation guarantees all 5 criteria are present.
  return weights as CriterionScores;
};

/**
 * Fails loudly if the ranking is not a permutation of the 5 criteria (§2 validation,
 * calc.md §2.6: fail with the violated constraint).
 * @param ranking the buckets to check
 */
const assertPermutation = (ranking: Ranking): void => {
  const seen = ranking.flat();
  if (seen.length !== CRITERION_CODES.length || new Set(seen).size !== CRITERION_CODES.length) {
    throw new Error(`invalid criteria ranking: expected a permutation of ${CRITERION_CODES.join(', ')}, got ${seen.join(', ')}`);
  }
};

// ---------------------------------------------------------------------------
// Per-criterion scores (scoring-model.md §1)
// ---------------------------------------------------------------------------

/**
 * Realised remShare of a status. IS statuses expose `remunerationShare` (read at the
 * validated boundary); every other status draws all income as cotised rémunération
 * → remShare = 1 (§1 C-PROT).
 * @param result one engine output
 * @returns rémunération share in [0, 1]
 */
const remShareOf = (result: StatusResult): number => {
  const parsed = statusResultISValidation.safeParse(result);
  return parsed.success ? parsed.data.remunerationShare : 1;
};

/**
 * C-PROT — realised protection: `protFloor + remShare × (protFull − protFloor)`.
 * Non-IS statuses collapse to `protFull` (remShare = 1); only eurl-is/sasu-is move
 * with the dividend strategy (§1, AC-S5.1). No fixed penalty constant.
 * @param result one engine output
 * @returns 0–100 protection score
 */
const scoreProt = (result: StatusResult): number => {
  const protFull = SCORING_CONFIG.protFull[result.status];
  const protFloor = SCORING_CONFIG.protFloor[result.status] ?? 0;
  return protFloor + remShareOf(result) * (protFull - protFloor);
};

/**
 * Micro CA headroom against the binding plafond (§1 C-EVOL). Generalised to mixed
 * activity: the tightest of the vente, services+BNC and global constraints (CA over
 * a plafond → 0). Non-micro statuses have no hard plafond → 100.
 * @param profile the questionnaire profile (CA streams)
 * @returns 0–100 headroom
 */
const microHeadroom = (profile: Profile): number => {
  const caServices = profile.caServiceBIC + profile.caServiceBNC;
  const caTotal = profile.caVente + caServices;
  const venteRoom = clamp01((MICRO_PLAFOND_VENTE - profile.caVente) / MICRO_PLAFOND_VENTE);
  const serviceRoom = clamp01((MICRO_PLAFOND_SERVICE_BNC - caServices) / MICRO_PLAFOND_SERVICE_BNC);
  const globalRoom = clamp01((MICRO_PLAFOND_VENTE - caTotal) / MICRO_PLAFOND_VENTE);
  return Math.min(venteRoom, serviceRoom, globalRoom) * 100;
};

/**
 * C-EVOL — `0.5 · headroom + 0.5 · evolStruct` (§1 C-EVOL).
 * @param input the status id and the profile (headroom is micro-only)
 * @returns 0–100 évolutivité score
 */
const scoreEvol = (input: { status: StatusId; profile: Profile }): number => {
  const headroom = input.status === 'micro-entreprise' ? microHeadroom(input.profile) : 100;
  return 0.5 * headroom + 0.5 * SCORING_CONFIG.evolStruct[input.status];
};

/**
 * C-NET — min-max over the scored set: `100 × (net − net_min) / (net_max − net_min)`,
 * clamped to [0, 100] (§1 C-NET). Guards: net_max = net_min → 100; net_max ≤ 0 → 0.
 * @param input one status' net and the run-wide net_min / net_max
 * @returns 0–100 net score
 */
const scoreNet = (input: { net: number; netMin: number; netMax: number }): number => {
  if (input.netMax <= 0) return 0;
  if (input.netMax === input.netMin) return 100;
  // "net clamped to net_min if negative" — defensive; netMin is already the run minimum.
  const net = Math.max(input.net, input.netMin);
  return clamp01((net - input.netMin) / (input.netMax - input.netMin)) * 100;
};

// ---------------------------------------------------------------------------
// Eligibility flags (scoring-model.md §4 step 3)
// ---------------------------------------------------------------------------

/**
 * Resolves the recommendation-barring flag for a status. Micro over its plafond and
 * a non-viable portage stay ranked but cannot hold the recommendation slot (§4).
 * @param result one engine output
 * @returns the flag reason or null
 */
const flagOf = (result: StatusResult): FlagReason | null => {
  if (result.plafondOverrun === true) return 'plafond-overrun';
  if (result.nonViable === true) return 'non-viable';
  return null;
};

// ---------------------------------------------------------------------------
// Tie-broken comparator (scoring-model.md §4 step 5)
// ---------------------------------------------------------------------------

/**
 * Orders two scored statuses best → first. Above the ε band, the composite score
 * decides; within ε, the tie-break chain applies: net € → C-PROT → C-SIMP →
 * canonical order (§4). Deterministic for a fixed input set (AC-S1.2/AC-S1.3).
 * @param a left status
 * @param b right status
 * @returns negative if `a` ranks ahead of `b`
 */
const compareScored = (a: ScoredStatus, b: ScoredStatus): number => {
  if (Math.abs(a.score - b.score) > SCORING_CONFIG.epsilon) return b.score - a.score;
  if (a.result.netDisponible !== b.result.netDisponible) return b.result.netDisponible - a.result.netDisponible;
  if (a.criterionScores['C-PROT'] !== b.criterionScores['C-PROT']) return b.criterionScores['C-PROT'] - a.criterionScores['C-PROT'];
  if (a.criterionScores['C-SIMP'] !== b.criterionScores['C-SIMP']) return b.criterionScores['C-SIMP'] - a.criterionScores['C-SIMP'];
  return CANONICAL_ORDER.indexOf(a.status) - CANONICAL_ORDER.indexOf(b.status);
};

// ---------------------------------------------------------------------------
// Top-level pipeline
// ---------------------------------------------------------------------------

/**
 * Computes, scores and ranks the 7 statuses for one profile (scoring-model.md §4).
 * Computes every status via `statusRegistry`, scores the 5 criteria, applies the
 * rank→weights transform, aggregates, flags ineligible statuses, tie-breaks, and
 * resolves the recommendation slot (top non-flagged).
 * @param input the profile and the optional criteria ranking (defaults to seed)
 * @returns the ranked statuses, the weights, the recommendation and the non-viable guard
 */
export const rankStatuses = (input: RankStatusesInput): RankingResult => {
  const ranking = input.ranking ?? SEED_RANKING;
  const weights = weightsFromRanking(ranking);

  // 1. Compute every status (the registry enforces exhaustiveness).
  //    profileFor lets the simulator feed each status its own profile (IS sweep);
  //    it defaults to the base profile so the scoring fixtures are unaffected.
  const profileFor = input.profileFor ?? (() => input.profile);
  const results = CANONICAL_ORDER.map((status) => statusRegistry[status]({ profile: profileFor(status), status }));

  // 2. Run-wide net bounds for the min-max C-NET (all 7 included — no hard exclude, §1).
  const nets = results.map((result) => result.netDisponible);
  const netMin = Math.min(...nets);
  const netMax = Math.max(...nets);
  const nonViable = netMax <= 0;

  // 3. Per-status criterion scores → contributions → composite.
  const scored: ScoredStatus[] = results.map((result) => {
    const criterionScores: CriterionScores = {
      'C-NET': scoreNet({ net: result.netDisponible, netMin, netMax }),
      'C-PROT': scoreProt(result),
      'C-SIMP': SCORING_CONFIG.cSimp[result.status],
      'C-CAP': SCORING_CONFIG.cCap[result.status],
      'C-EVOL': scoreEvol({ status: result.status, profile: input.profile }),
    };
    const contributions = mapCriteria((code) => (weights[code] * criterionScores[code]) / 100);
    const score = sum(CRITERION_CODES.map((code) => contributions[code]));
    const flagReason = flagOf(result);
    return {
      status: result.status,
      result,
      criterionScores: mapCriteria((code) => roundScore(criterionScores[code])),
      contributions: mapCriteria((code) => roundScore(contributions[code])),
      score: roundScore(score),
      rank: 0,
      flagged: flagReason !== null,
      flagReason,
      recommended: false,
      netDelta: roundToEuros(netMax - result.netDisponible),
    };
  });

  // 4. Tie-broken sort, 1-based ranks, recommendation = first non-flagged.
  scored.sort(compareScored);
  scored.forEach((entry, index) => {
    entry.rank = index + 1;
  });
  const recommended = scored.find((entry) => !entry.flagged);
  if (recommended) recommended.recommended = true;

  return {
    ranked: scored,
    weights: mapCriteria((code) => Math.round(weights[code] * 10) / 10),
    recommendation: recommended?.status ?? null,
    nonViable,
  };
};

/**
 * Builds a `CriterionScores` by evaluating `fn` for each criterion in canonical order.
 * @param fn maps a criterion code to its number
 * @returns the fully-keyed criterion record
 */
const mapCriteria = (fn: (code: CriterionCode) => number): CriterionScores => ({
  'C-NET': fn('C-NET'),
  'C-PROT': fn('C-PROT'),
  'C-SIMP': fn('C-SIMP'),
  'C-CAP': fn('C-CAP'),
  'C-EVOL': fn('C-EVOL'),
});

/**
 * Simulator ↔ engine glue: turns a UI `Draft` into a ranked `RankingResult`, and
 * derives the presentation-level "why" (reason chips, argued recommendation) from
 * the engine output WITHOUT recomputing any euro figure (calc.md §1.1 — the engine
 * already exposes the breakdown).
 *
 * `rankFromDraft` is the one place the IS rémunération sweep is wired in: each
 * status is computed at its own resolved salaire/dividende split via
 * `optimizedProfileFor` (product-spec A10).
 */
import { optimizedProfileFor } from '@/domain/resolve-remuneration-is';
import { CRITERION_CODES, type CriterionCode, type RankingResult, rankStatuses, type ScoredStatus } from '@/domain/scoring';
import type { StatusId, StatusResult } from '@/domain/validation';
import { CRITERIA_META } from './criteria-meta';
import type { Draft } from './draft';
import { draftToProfile } from './draft-to-profile';

/**
 * Ranks the 7 statuses for a questionnaire draft, applying the IS rémunération
 * sweep per status. The user's priority order becomes the criteria ranking.
 * @param draft the questionnaire draft
 * @returns the full ranking outcome (ranked statuses, weights, recommendation, viability)
 */
export const rankFromDraft = (draft: Draft): RankingResult => {
  const profile = draftToProfile(draft);
  const ranking = draft.prioritesCriteres.map((code) => [code] as const);
  return rankStatuses({
    profile,
    ranking,
    profileFor: (status) => optimizedProfileFor({ profile, status, preference: draft.preferenceRemuneration }),
  });
};

/** A single reason chip for a ranking card (product-spec §C.1, scoring-model §6). */
export type ReasonChip = {
  /** The criterion the chip speaks to. */
  code: CriterionCode;
  /** FR chip text (positive or negative phrasing from the phrase bank). */
  text: string;
  /** Whether this is a strength (true) or a weakness (false). */
  positive: boolean;
};

/** Score at/above which a criterion is phrased as a strength rather than a weakness. */
const POSITIVE_SCORE_THRESHOLD = 50;

/**
 * Picks a status' top reason chips — the criteria with the highest weighted
 * contribution — phrased positive/negative by their absolute 0–100 score.
 * @param input the scored status and how many chips to return
 * @returns the chips, most-impactful first
 */
export const reasonChipsFor = (input: { scored: ScoredStatus; count: number }): ReasonChip[] =>
  CRITERION_CODES.map((code) => ({ code, contribution: input.scored.contributions[code], score: input.scored.criterionScores[code] }))
    .sort((a, b) => b.contribution - a.contribution)
    .slice(0, input.count)
    .map(({ code, score }) => {
      const positive = score >= POSITIVE_SCORE_THRESHOLD;
      return { code, positive, text: positive ? CRITERIA_META[code].positive : CRITERIA_META[code].negative };
    });

/** Structured pieces for the argued-recommendation copy (product-spec §C.2). */
export type RecommendationView = {
  /** The recommended status id. */
  status: StatusId;
  /** Its full engine result (net, cotisations, impôt…). */
  result: StatusResult;
  /** Net disponible per year, in euros. */
  netAnnual: number;
  /** The two criteria that most set it apart from the runner-up (FR phrases). */
  strengths: string[];
  /** Its single balancing weakness (FR phrase = lowest absolute criterion). */
  weakness: string;
  /** FR label of the user's #1 priority criterion. */
  topPriorityLabel: string;
};

/**
 * Builds the argued-recommendation view from a ranking: the 2 criteria with the
 * largest weighted gap over the runner-up, the recommended status' weakest
 * criterion, and the user's top stated priority (scoring-model §5).
 * @param input the ranking outcome and the originating draft
 * @returns the recommendation view, or null when every status is flagged
 */
export const buildRecommendationView = (input: { ranking: RankingResult; draft: Draft }): RecommendationView | null => {
  const recommended = input.ranking.ranked.find((entry) => entry.recommended);
  if (!recommended) return null;
  const runnerUp = input.ranking.ranked.find((entry) => entry.status !== recommended.status);

  const strengthCodes = pickStrengthCodes({ recommended, runnerUp });
  const weaknessCode = lowestCriterion(recommended);
  const topCode = input.draft.prioritesCriteres[0] ?? 'C-NET';

  return {
    status: recommended.status,
    result: recommended.result,
    netAnnual: recommended.result.netDisponible,
    strengths: strengthCodes.map((code) => CRITERIA_META[code].positive),
    weakness: CRITERIA_META[weaknessCode].negative,
    topPriorityLabel: CRITERIA_META[topCode].label,
  };
};

/**
 * The 2 criteria that most distinguish the recommended status from the runner-up,
 * by weighted gap `w_c × (score_c(R) − score_c(Q)) / 100`. Falls back to the
 * recommended status' own highest contributions when there are fewer than 2 positive gaps.
 * @param input the recommended status and the runner-up (if any)
 * @returns up to 2 criterion codes
 */
const pickStrengthCodes = (input: { recommended: ScoredStatus; runnerUp: ScoredStatus | undefined }): CriterionCode[] => {
  const { recommended, runnerUp } = input;
  const byContribution = [...CRITERION_CODES].sort((a, b) => recommended.contributions[b] - recommended.contributions[a]);
  if (!runnerUp) return byContribution.slice(0, 2);

  const positiveGaps = CRITERION_CODES.map((code) => ({
    code,
    gap: recommended.criterionScores[code] - runnerUp.criterionScores[code],
  }))
    .filter((entry) => entry.gap > 0)
    .sort((a, b) => b.gap - a.gap)
    .map((entry) => entry.code);

  // Top up to 2 with the highest-contribution criteria not already chosen.
  const chosen = [...positiveGaps];
  for (const code of byContribution) {
    if (chosen.length >= 2) break;
    if (!chosen.includes(code)) chosen.push(code);
  }
  return chosen.slice(0, 2);
};

/**
 * The criterion on which a status scores lowest (its balancing weakness).
 * @param scored one scored status
 * @returns the weakest criterion code
 */
const lowestCriterion = (scored: ScoredStatus): CriterionCode =>
  [...CRITERION_CODES].sort((a, b) => scored.criterionScores[a] - scored.criterionScores[b])[0] ?? 'C-NET';

/**
 * Scoring engine tests — lock the rank→weights transform, the realised C-PROT,
 * the tie-broken ranking, micro-overrun barring and the recommendation slot
 * (scoring-model.md §§1–4, US-S1/S3/S5/S6). Values are product constants owned by
 * scoring.ts, not regulatory figures — asserted directly.
 */
import { describe, expect, it } from 'vitest';
import { makeProfile } from '../__test-utils__/make-profile';
import { CRITERION_CODES, type Ranking, rankStatuses, SCORING_CONFIG, SEED_RANKING, weightsFromRanking } from '../scoring';

describe('weightsFromRanking', () => {
  it('maps the seed order to the linear 33.3/26.7/20/13.3/6.7 split', () => {
    const weights = weightsFromRanking(SEED_RANKING);
    expect(weights['C-NET']).toBeCloseTo(33.333, 2);
    expect(weights['C-PROT']).toBeCloseTo(26.667, 2);
    expect(weights['C-SIMP']).toBeCloseTo(20, 2);
    expect(weights['C-CAP']).toBeCloseTo(13.333, 2);
    expect(weights['C-EVOL']).toBeCloseTo(6.667, 2);
  });

  it('always sums to 100', () => {
    const total = CRITERION_CODES.reduce((acc, code) => acc + weightsFromRanking(SEED_RANKING)[code], 0);
    expect(total).toBeCloseTo(100, 6);
  });

  it('shares average points across a tied bucket (équivalents)', () => {
    // net & protection tied for 1st–2nd → (5+4)/2 = 4.5 each → weight 30.
    const ranking: Ranking = [['C-NET', 'C-PROT'], ['C-SIMP'], ['C-CAP'], ['C-EVOL']];
    const weights = weightsFromRanking(ranking);
    expect(weights['C-NET']).toBeCloseTo(30, 4);
    expect(weights['C-PROT']).toBeCloseTo(30, 4);
    expect(weights['C-SIMP']).toBeCloseTo(20, 4);
    expect(weights['C-CAP']).toBeCloseTo(13.333, 2);
    expect(weights['C-EVOL']).toBeCloseTo(6.667, 2);
    const total = CRITERION_CODES.reduce((acc, code) => acc + weights[code], 0);
    expect(total).toBeCloseTo(100, 6);
  });

  it('throws when the ranking is not a permutation of the 5 criteria', () => {
    expect(() => weightsFromRanking([['C-NET'], ['C-NET'], ['C-SIMP'], ['C-CAP'], ['C-EVOL']])).toThrow(/permutation/);
    expect(() => weightsFromRanking([['C-NET'], ['C-PROT'], ['C-SIMP']])).toThrow(/permutation/);
  });
});

describe('rankStatuses', () => {
  const baseline = makeProfile({ caServiceBNC: 50_000 });

  it('ranks all 7 statuses exactly once with 1-based contiguous ranks', () => {
    const { ranked } = rankStatuses({ profile: baseline });
    expect(ranked).toHaveLength(7);
    expect(new Set(ranked.map((entry) => entry.status)).size).toBe(7);
    expect(ranked.map((entry) => entry.rank)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it('orders by composite score descending (best first)', () => {
    const scores = rankStatuses({ profile: baseline }).ranked.map((entry) => entry.score);
    const sorted = [...scores].sort((a, b) => b - a);
    expect(scores).toEqual(sorted);
  });

  it('exposes the seed weights rounded to one decimal', () => {
    expect(rankStatuses({ profile: baseline }).weights).toEqual({
      'C-NET': 33.3,
      'C-PROT': 26.7,
      'C-SIMP': 20,
      'C-CAP': 13.3,
      'C-EVOL': 6.7,
    });
  });

  it('is deterministic — identical input yields identical output', () => {
    expect(rankStatuses({ profile: baseline })).toEqual(rankStatuses({ profile: baseline }));
  });

  it('sets netDelta to 0 for the highest-net status and ≥ 0 elsewhere', () => {
    const { ranked } = rankStatuses({ profile: baseline });
    const leader = [...ranked].sort((a, b) => b.result.netDisponible - a.result.netDisponible)[0];
    expect(leader?.netDelta).toBe(0);
    for (const entry of ranked) expect(entry.netDelta).toBeGreaterThanOrEqual(0);
  });

  it('scores non-IS protection at protFull (remShare = 1)', () => {
    const portage = rankStatuses({ profile: baseline }).ranked.find((entry) => entry.status === 'portage-salarial');
    expect(portage?.criterionScores['C-PROT']).toBe(SCORING_CONFIG.protFull['portage-salarial']);
  });

  it('flags micro over its plafond and bars it from the recommendation', () => {
    const overrun = makeProfile({ caServiceBNC: 200_000 });
    const { ranked, recommendation } = rankStatuses({ profile: overrun });
    const micro = ranked.find((entry) => entry.status === 'micro-entreprise');
    expect(micro?.flagged).toBe(true);
    expect(micro?.flagReason).toBe('plafond-overrun');
    expect(recommendation).not.toBe('micro-entreprise');
  });

  it('recommends the top non-flagged status', () => {
    const { ranked, recommendation } = rankStatuses({ profile: baseline });
    const recommended = ranked.find((entry) => entry.recommended);
    expect(recommended?.status).toBe(recommendation);
    expect(recommended?.flagged).toBe(false);
    // No non-flagged status outranks the recommended one.
    const firstNonFlagged = ranked.find((entry) => !entry.flagged);
    expect(firstNonFlagged?.status).toBe(recommendation);
  });

  it('lowers IS protection when the strategy is dividend-heavy', () => {
    // A SASU-IS with a low rémunération and full dividend distribution → low remShare → C-PROT near protFloor.
    const dividendHeavy = makeProfile({ caServiceBNC: 120_000, remunerationChoisie: 5_000, partDividendes: 1, capitalPlusCCA: 1_000 });
    const sasuIs = rankStatuses({ profile: dividendHeavy }).ranked.find((entry) => entry.status === 'sasu-is');
    const protFull = SCORING_CONFIG.protFull['sasu-is'];
    expect(sasuIs?.criterionScores['C-PROT']).toBeLessThan(protFull);
  });
});

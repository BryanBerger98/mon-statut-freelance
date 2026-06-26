import { describe, expect, it } from 'vitest';
import { makeProfile } from '../__test-utils__/make-profile';
import type { IsStatusId } from '../resolve-remuneration-is';
import { optimizedProfileFor, resolveRemunerationIs } from '../resolve-remuneration-is';
import { rankStatuses } from '../scoring';
import { computeEurlIs } from '../statuses/eurl-is';
import { computeSasuIs } from '../statuses/sasu-is';
import type { Profile } from '../validation';

/** A comfortably profitable IS profile: bénéfice = 100 000 €. */
const profitable = makeProfile({
  caServiceBNC: 120_000,
  chargesReelles: 20_000,
  capitalPlusCCA: 10_000,
});

const IS_COMPUTE = { 'eurl-is': computeEurlIs, 'sasu-is': computeSasuIs } as const;

/**
 * Independent brute-force argmax over the AFFORDABLE range (is > 0) with
 * partDividendes=1 — the reference the resolver must match or beat.
 */
const bruteForceAffordableMaxNet = (input: { profile: Profile; status: IsStatusId; benefice: number }): number => {
  const compute = IS_COMPUTE[input.status];
  const steps = 50;
  let max = Number.NEGATIVE_INFINITY;
  for (let i = 0; i <= steps; i += 1) {
    const remuneration = (i / steps) * input.benefice;
    const result = compute({
      profile: { ...input.profile, remunerationChoisie: remuneration, partDividendes: 1, optionBaremeDividendes: true },
      status: input.status,
    });
    if ((result.is ?? 0) > 0 && result.netDisponible > max) max = result.netDisponible;
  }
  return max;
};

describe('resolveRemunerationIs', () => {
  for (const status of ['eurl-is', 'sasu-is'] as const) {
    it(`finds a net at least as high as an independent affordable scan for ${status}`, () => {
      const resolved = resolveRemunerationIs({ profile: profitable, status, preference: 'immediate' });
      const bruteMax = bruteForceAffordableMaxNet({ profile: profitable, status, benefice: 100_000 });
      // 256+256 grid is finer than the 50-point reference → never worse (1 € tolerance for grid offset).
      expect(resolved.result.netDisponible).toBeGreaterThanOrEqual(bruteMax - 1);
    });

    it(`stays in the affordable region (positive IS base) for ${status}`, () => {
      const resolved = resolveRemunerationIs({ profile: profitable, status, preference: 'immediate' });
      // A real optimum on a 100 k bénéfice is interior → positive base, never the fictitious over-Rmax net.
      expect(resolved.result.is ?? 0).toBeGreaterThan(0);
      expect(resolved.remunerationChoisie).toBeGreaterThan(0);
      expect(resolved.remunerationChoisie).toBeLessThanOrEqual(100_000);
    });

    it(`immediate never nets below capitalisation for ${status}`, () => {
      const immediate = resolveRemunerationIs({ profile: profitable, status, preference: 'immediate' });
      const capitalisation = resolveRemunerationIs({ profile: profitable, status, preference: 'capitalisation' });
      expect(immediate.result.netDisponible).toBeGreaterThanOrEqual(capitalisation.result.netDisponible);
    });

    it(`capitalisation pays zero rémunération and distributes dividends for ${status}`, () => {
      const resolved = resolveRemunerationIs({ profile: profitable, status, preference: 'capitalisation' });
      expect(resolved.remunerationChoisie).toBe(0);
      expect(resolved.partDividendes).toBe(1);
      expect(resolved.result.remuneration).toBe(0);
    });

    it(`is deterministic for ${status}`, () => {
      const a = resolveRemunerationIs({ profile: profitable, status, preference: 'immediate' });
      const b = resolveRemunerationIs({ profile: profitable, status, preference: 'immediate' });
      expect(a.remunerationChoisie).toBe(b.remunerationChoisie);
      expect(a.result.netDisponible).toBe(b.result.netDisponible);
    });

    it(`forces optionBaremeDividendes on every candidate for ${status}`, () => {
      const resolved = resolveRemunerationIs({ profile: profitable, status, preference: 'immediate' });
      expect(resolved.optionBaremeDividendes).toBe(true);
    });
  }

  it('keeps EURL minimum TNS cotisations even at zero rémunération', () => {
    const resolved = resolveRemunerationIs({ profile: profitable, status: 'eurl-is', preference: 'capitalisation' });
    // Gérant TNS owes the cotisations minimales on a zero assiette — never literally zero.
    expect(resolved.result.cotisations).toBeGreaterThan(0);
  });

  it('falls back to zero rémunération when the bénéfice is non-positive', () => {
    const loss = makeProfile({ caServiceBNC: 10_000, chargesReelles: 20_000 });
    const resolved = resolveRemunerationIs({ profile: loss, status: 'sasu-is', preference: 'immediate' });
    expect(resolved.remunerationChoisie).toBe(0);
  });
});

describe('optimizedProfileFor', () => {
  it('returns the profile unchanged for a non-IS status', () => {
    const profile = makeProfile({ caServiceBNC: 50_000, remunerationChoisie: 12_345, optionBaremeDividendes: false });
    const result = optimizedProfileFor({ profile, status: 'micro-entreprise', preference: 'immediate' });
    expect(result).toBe(profile);
  });

  it('bakes the resolved split into the profile for an IS status', () => {
    const resolved = resolveRemunerationIs({ profile: profitable, status: 'eurl-is', preference: 'immediate' });
    const result = optimizedProfileFor({ profile: profitable, status: 'eurl-is', preference: 'immediate' });
    expect(result.remunerationChoisie).toBe(resolved.remunerationChoisie);
    expect(result.partDividendes).toBe(1);
    expect(result.optionBaremeDividendes).toBe(true);
  });

  it('lifts the IS net via rankStatuses profileFor versus the bare base profile', () => {
    const base = rankStatuses({ profile: profitable });
    const swept = rankStatuses({
      profile: profitable,
      profileFor: (status) => optimizedProfileFor({ profile: profitable, status, preference: 'immediate' }),
    });
    const netOf = (run: ReturnType<typeof rankStatuses>, status: IsStatusId): number => {
      const entry = run.ranked.find((scored) => scored.status === status);
      if (!entry) throw new Error(`missing status in ranking: ${status}`);
      return entry.result.netDisponible;
    };
    // The base profile leaves remunerationChoisie=0/partDividendes=0 (everything retained, nothing distributed);
    // the immediate sweep can only raise the cash-in-pocket net.
    expect(netOf(swept, 'eurl-is')).toBeGreaterThanOrEqual(netOf(base, 'eurl-is'));
    expect(netOf(swept, 'sasu-is')).toBeGreaterThanOrEqual(netOf(base, 'sasu-is'));
  });
});

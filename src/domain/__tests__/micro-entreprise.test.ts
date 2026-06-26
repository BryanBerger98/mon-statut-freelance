import { describe, expect, it } from 'vitest';
import { makeProfile } from '../__test-utils__/make-profile';
import { computeMicro } from '../statuses/micro-entreprise';

/**
 * Fixtures-driven golden masters for computeMicro.
 *
 * Expected values come from `.claude/docs/business/fixtures/fixtures.json`
 * (the test-fixtures skill output). Tolerance absorbs only boundary rounding:
 * money within ±0.5 € (closeTo precision 0), tauxGlobal within ±0.0005 (precision 3).
 * NEVER edit an expected value to make a test pass (calc.md §1.5).
 */
describe('computeMicro', () => {
  it('computes net for a BNC profile with ACRE 50% and décote-wiped IR (P01)', () => {
    const result = computeMicro({
      status: 'micro-entreprise',
      profile: makeProfile({
        caServiceBNC: 25_000,
        chargesReelles: 1_500,
        firstYear: true,
        dateDebutActivite: '2026-03-01',
      }),
    });
    expect(result).toMatchObject({
      cotisations: expect.closeTo(3_250, 0),
      impot: expect.closeTo(0, 0),
      netDisponible: expect.closeTo(20_250, 0),
      tauxGlobal: expect.closeTo(0.19, 3),
      acreApplied: true,
      vlApplied: false,
      plafondOverrun: false,
      eligible: true,
    });
  });

  it('computes net for a CIPAV BNC profile, no ACRE (P02)', () => {
    const result = computeMicro({
      status: 'micro-entreprise',
      profile: makeProfile({
        caServiceBNC: 45_000,
        chargesReelles: 3_000,
        activiteSousType: 'cipav',
      }),
    });
    expect(result).toMatchObject({
      cotisations: expect.closeTo(10_530, 0),
      impot: expect.closeTo(2_014, 0),
      netDisponible: expect.closeTo(29_456, 0),
      tauxGlobal: expect.closeTo(0.3454, 3),
      acreApplied: false,
      eligible: true,
    });
  });

  it('applies marginal IR over autres revenus for a couple (P03)', () => {
    const result = computeMicro({
      status: 'micro-entreprise',
      profile: makeProfile({
        caServiceBIC: 55_000,
        chargesReelles: 8_000,
        situationFamiliale: 'marie_pacse',
        nbParts: 2,
        autresRevenusFoyer: 30_000,
      }),
    });
    expect(result).toMatchObject({
      cotisations: expect.closeTo(11_825, 0),
      impot: expect.closeTo(3_773, 0),
      netDisponible: expect.closeTo(31_402, 0),
      tauxGlobal: expect.closeTo(0.4291, 3),
      eligible: true,
    });
  });

  it('keeps the barème when it beats the elected versement libératoire (P04)', () => {
    const result = computeMicro({
      status: 'micro-entreprise',
      profile: makeProfile({
        caServiceBIC: 40_000,
        chargesReelles: 2_000,
        versementLiberatoire: true,
        rfrNMoins2: 18_000,
      }),
    });
    expect(result).toMatchObject({
      cotisations: expect.closeTo(8_600, 0),
      impot: expect.closeTo(445.11, 0),
      netDisponible: expect.closeTo(28_954.89, 0),
      tauxGlobal: expect.closeTo(0.2761, 3),
      vlApplied: false,
      eligible: true,
    });
  });

  it('flags plafond overrun and bars eligibility above the BNC ceiling (P05)', () => {
    const result = computeMicro({
      status: 'micro-entreprise',
      profile: makeProfile({
        caServiceBNC: 90_000,
        chargesReelles: 5_000,
      }),
    });
    expect(result).toMatchObject({
      plafondOverrun: true,
      eligible: false,
    });
  });

  it('computes net for a high-CA vente profile (P06)', () => {
    const result = computeMicro({
      status: 'micro-entreprise',
      profile: makeProfile({
        caVente: 160_000,
        chargesReelles: 95_000,
      }),
    });
    expect(result).toMatchObject({
      cotisations: expect.closeTo(19_840, 0),
      impot: expect.closeTo(7_024, 0),
      netDisponible: expect.closeTo(38_136, 0),
      tauxGlobal: expect.closeTo(0.7617, 3),
      eligible: true,
    });
  });

  it('applies ACRE 25% for an activity starting on/after the mid-year split (P11)', () => {
    const result = computeMicro({
      status: 'micro-entreprise',
      profile: makeProfile({
        caVente: 50_000,
        chargesReelles: 4_000,
        firstYear: true,
        dateDebutActivite: '2026-09-01',
      }),
    });
    expect(result).toMatchObject({
      cotisations: expect.closeTo(4_662.5, 0),
      impot: expect.closeTo(0, 0),
      netDisponible: expect.closeTo(41_337.5, 0),
      tauxGlobal: expect.closeTo(0.1733, 3),
      acreApplied: true,
      eligible: true,
    });
  });

  it('computes net for a BNC profile just under the services ceiling (P14)', () => {
    const result = computeMicro({
      status: 'micro-entreprise',
      profile: makeProfile({
        caServiceBNC: 75_000,
        chargesReelles: 12_000,
      }),
    });
    expect(result).toMatchObject({
      cotisations: expect.closeTo(19_350, 0),
      impot: expect.closeTo(7_954, 0),
      netDisponible: expect.closeTo(35_696, 0),
      tauxGlobal: expect.closeTo(0.5241, 3),
      eligible: true,
    });
  });
});

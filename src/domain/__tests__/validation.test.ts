import { describe, expect, it } from 'vitest';
import { profileValidation } from '../validation';

/**
 * Smoke test — validates that profileValidation.parse() accepts a valid Profile
 * and rejects an invalid one.
 *
 * This is the green smoke gate for pnpm test before the domain engine is implemented.
 * Full fixture-driven tests come with the test-fixtures skill (domain-transcription phase).
 */

const validProfile = {
  caVente: 0,
  caServiceBIC: 50_000,
  caServiceBNC: 0,
  chargesReelles: 5_000,
  situationFamiliale: 'celibataire' as const,
  nbParts: 1,
  nombrePersonnesACharge: 0,
  autresRevenusFoyer: 0,
  activiteSousType: 'regime_general' as const,
  firstYear: false,
  dateDebutActivite: '2024-01-01',
  rfrNMoins2: 40_000,
  versementLiberatoire: false,
  clienteleB2B: true,
  capitalPlusCCA: 0,
  remunerationChoisie: 0,
  partDividendes: 0,
  optionBaremeDividendes: false,
  fraisGestionMode: 'pct' as const,
  fraisGestionFixe: 0,
  tauxAtMp: 0.007,
  cibleSalaireNetMensuel: 0,
  cibleDividendesBruts: 0,
  prioritesCriteres: ['net', 'simplicite'],
};

describe('profileValidation', () => {
  it('accepts a valid Profile', () => {
    const result = profileValidation.parse(validProfile);
    expect(result.caServiceBIC).toBe(50_000);
    expect(result.situationFamiliale).toBe('celibataire');
    expect(result.activiteSousType).toBe('regime_general');
  });

  it('rejects a Profile with an invalid situationFamiliale', () => {
    expect(() => profileValidation.parse({ ...validProfile, situationFamiliale: 'divorce' })).toThrow();
  });

  it('rejects a Profile with a negative caVente', () => {
    expect(() => profileValidation.parse({ ...validProfile, caVente: -1 })).toThrow();
  });

  it('rejects a Profile with partDividendes > 1', () => {
    expect(() => profileValidation.parse({ ...validProfile, partDividendes: 1.5 })).toThrow();
  });

  it('accepts an optional statutActuel field', () => {
    const result = profileValidation.parse({ ...validProfile, statutActuel: 'micro-entreprise' });
    expect(result.statutActuel).toBe('micro-entreprise');
  });

  it('accepts Profile without statutActuel (it is optional)', () => {
    const result = profileValidation.parse(validProfile);
    expect(result.statutActuel).toBeUndefined();
  });
});

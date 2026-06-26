import { describe, expect, it } from 'vitest';
import { microAcreExoTaux } from '../acre';

describe('microAcreExoTaux', () => {
  it('returns 0 when it is not the first year', () => {
    expect(microAcreExoTaux({ firstYear: false, dateDebutActivite: '2026-03-01' })).toBe(0);
  });

  it('returns the 50% exonération when the activity starts before the mid-year split', () => {
    expect(microAcreExoTaux({ firstYear: true, dateDebutActivite: '2026-03-01' })).toBe(0.5);
  });

  it('returns the 25% exonération when the activity starts on/after the mid-year split', () => {
    expect(microAcreExoTaux({ firstYear: true, dateDebutActivite: '2026-09-01' })).toBe(0.25);
  });

  it('treats the bascule date itself as on/after (25%)', () => {
    expect(microAcreExoTaux({ firstYear: true, dateDebutActivite: '2026-07-01' })).toBe(0.25);
  });
});

/**
 * Test-only Profile factory — neutral, all-zero defaults overridable per persona.
 * Lives in __test-utils__ (excluded from the Vitest runner by naming, tests.md §3).
 */
import { SS_AT_MP_TAUX } from '../constants';
import type { Profile } from '../validation';

const baseProfile: Profile = {
  caVente: 0,
  caServiceBIC: 0,
  caServiceBNC: 0,
  chargesReelles: 0,
  situationFamiliale: 'celibataire',
  nbParts: 1,
  nombrePersonnesACharge: 0,
  autresRevenusFoyer: 0,
  activiteSousType: 'regime_general',
  firstYear: false,
  dateDebutActivite: '2024-01-01',
  rfrNMoins2: 0,
  versementLiberatoire: false,
  clienteleB2B: false,
  capitalPlusCCA: 0,
  remunerationChoisie: 0,
  partDividendes: 0,
  optionBaremeDividendes: false,
  cibleSalaireNetMensuel: 0,
  cibleDividendesBruts: 0,
  fraisGestionMode: 'pct',
  fraisGestionFixe: 0,
  tauxAtMp: SS_AT_MP_TAUX,
  prioritesCriteres: [],
};

/**
 * Builds a complete Profile from a partial override, filling neutral defaults.
 * @param partial subset of Profile fields to override
 * @returns a fully-populated Profile ready for an engine compute call
 */
export const makeProfile = (partial: Partial<Profile> = {}): Profile => ({ ...baseProfile, ...partial });

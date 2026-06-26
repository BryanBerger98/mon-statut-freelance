/**
 * Maps the UI questionnaire `Draft` to the calc-engine `Profile`.
 *
 * This is the single boundary where UI granularity becomes engine input:
 *  - nbParts is DERIVED from situation + dependents (quotient familial rule);
 *  - the 3-label household situation collapses to the engine's 2 buckets;
 *  - CIPAV only applies when there is BNC turnover (product-spec A4);
 *  - the société levers the questionnaire never asks (capital, rémunération split,
 *    dividend option) take their documented defaults — the IS rémunération sweep
 *    (`optimizedProfileFor`) overrides the split per-status downstream.
 *
 * No numbers are invented here: `EURL_IS_CAPITAL_DEFAULT` and `QF_DEMI_PART` are
 * imported by name from `constants.ts` (calc.md §1.2 / §1.6).
 */
import { EURL_IS_CAPITAL_DEFAULT, QF_DEMI_PART } from '@/domain/constants';
import type { Profile, SituationFamiliale } from '@/domain/validation';
import type { Draft, SituationUi } from './draft';

/** Number of dependents beyond which each extra one grants a full part (not a half). */
const FULL_PART_DEPENDENT_THRESHOLD = 2;

/** Household situations that the engine treats as a single-part (separate) household. */
const SINGLE_PART_SITUATIONS: readonly SituationUi[] = ['celibataire', 'union_libre'];

/**
 * Collapses the 3 UI household labels to the engine's 2 buckets: only a married/PACS
 * couple is a joint 2-part household; `union_libre` is taxed separately like a single.
 * @param situation the UI household label
 * @returns the engine household value
 */
const toSituationFamiliale = (situation: SituationUi): SituationFamiliale => (situation === 'marie_pacse' ? 'marie_pacse' : 'celibataire');

/**
 * Derives the quotient-familial parts from the household and the number of dependents.
 * Base = 2 (couple) or 1 (single); each of the first two dependents adds a half-part,
 * each further dependent adds a full part. Parent isolé is intentionally excluded
 * (product-spec resolved scope).
 * @param input household situation and the count of dependents
 * @returns total parts de quotient familial (> 0)
 */
export const deriveNbParts = (input: { situation: SituationUi; nombrePersonnesACharge: number }): number => {
  const base = SINGLE_PART_SITUATIONS.includes(input.situation) ? 1 : 2;
  const n = input.nombrePersonnesACharge;
  const halfParts = Math.min(n, FULL_PART_DEPENDENT_THRESHOLD) * QF_DEMI_PART;
  const fullParts = Math.max(n - FULL_PART_DEPENDENT_THRESHOLD, 0) * (2 * QF_DEMI_PART);
  return base + halfParts + fullParts;
};

/**
 * Builds the engine `Profile` from the UI draft (product-spec §B variable map).
 * @param draft the questionnaire draft
 * @returns the calc-engine profile (ready for `rankStatuses` / `optimizedProfileFor`)
 */
export const draftToProfile = (draft: Draft): Profile => ({
  caVente: draft.caVente,
  caServiceBIC: draft.caServiceBIC,
  caServiceBNC: draft.caServiceBNC,
  chargesReelles: draft.chargesReelles,
  situationFamiliale: toSituationFamiliale(draft.situationFamiliale),
  nbParts: deriveNbParts({ situation: draft.situationFamiliale, nombrePersonnesACharge: draft.nombrePersonnesACharge }),
  nombrePersonnesACharge: draft.nombrePersonnesACharge,
  autresRevenusFoyer: draft.autresRevenusFoyer,
  // CIPAV only bears on liberal BNC turnover; otherwise the régime général barème.
  activiteSousType: draft.caServiceBNC > 0 ? draft.activiteSousType : 'regime_general',
  firstYear: draft.firstYear,
  dateDebutActivite: draft.dateDebutActivite,
  rfrNMoins2: draft.rfrNMoins2,
  versementLiberatoire: draft.versementLiberatoire,
  clienteleB2B: draft.clienteleB2B,
  // Société levers not asked in the questionnaire — documented defaults. The IS
  // rémunération sweep (optimizedProfileFor) overrides the split for eurl-is/sasu-is.
  capitalPlusCCA: EURL_IS_CAPITAL_DEFAULT,
  remunerationChoisie: 0,
  partDividendes: 0,
  optionBaremeDividendes: false,
  // Optional rémunération override (eurl-is/sasu-is) — when > 0, optimizedProfileFor
  // resolves the split to hit these targets instead of auto-optimising.
  cibleSalaireNetMensuel: draft.cibleSalaireNetMensuel,
  cibleDividendesBruts: draft.cibleDividendesBruts,
  fraisGestionMode: draft.fraisGestionMode,
  fraisGestionFixe: draft.fraisGestionFixe,
  tauxAtMp: draft.tauxAtMp,
  prioritesCriteres: [...draft.prioritesCriteres],
  // exactOptionalPropertyTypes: omit the key entirely when there is no current status.
  ...(draft.statutActuel !== 'aucun' ? { statutActuel: draft.statutActuel } : {}),
});

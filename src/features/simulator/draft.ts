/**
 * Simulator questionnaire DRAFT — the UI-level input model (product-spec §B,
 * variables A1–A18). It is intentionally distinct from the calc-engine `Profile`:
 * the draft carries only what the user types/picks; `draft-to-profile.ts` derives
 * the engine `Profile` from it (nbParts derivation, label→value mappings, the
 * non-questionnaire société defaults).
 *
 * The whole draft is mirrored to a single URL search param (base64-encoded JSON)
 * so a simulation is shareable and refresh-safe (components.md §1.4). Validated
 * with Zod at the URL boundary (typescript.md §1.6): a malformed/old URL throws on
 * parse and `useUrlParam` falls back to `DEFAULT_DRAFT`.
 */

import { z } from 'zod';
import { SS_AT_MP_TAUX } from '@/domain/constants';
import { CRITERION_CODES, type CriterionCode } from '@/domain/scoring';
import { activiteSousTypeValidation, fraisGestionModeValidation } from '@/domain/validation';
import type { UrlParamCodec } from '@/lib/use-url-param';

/**
 * Household situation, UI granularity (product-spec A6): three labels collapsing to
 * the engine's two parts buckets (`union_libre` is taxed as a separate household →
 * `celibataire`). The mapping lives in `draft-to-profile.ts`.
 */
export const situationUiValidation = z.enum(['celibataire', 'marie_pacse', 'union_libre']);
export type SituationUi = z.infer<typeof situationUiValidation>;

/** Rémunération preference for the two IS statuses (product-spec A10). */
export const remunerationPreferenceValidation = z.enum(['immediate', 'capitalisation']);

/** Current status, including the `aucun` sentinel (product-spec A15). */
export const statutActuelChoiceValidation = z.enum([
  'aucun',
  'micro-entreprise',
  'ei-reel',
  'eurl-ir',
  'eurl-is',
  'sasu-ir',
  'sasu-is',
  'portage-salarial',
]);
export type StatutActuelChoice = z.infer<typeof statutActuelChoiceValidation>;

/** One comparison-criterion code (matches the scoring engine). */
const criterionCodeValidation = z.enum(['C-NET', 'C-PROT', 'C-SIMP', 'C-CAP', 'C-EVOL']);

/**
 * Ordered priority list — exactly the 5 criterion codes, each once (a permutation).
 * `rankStatuses` throws on a non-permutation, so the boundary guarantees it here.
 */
const prioritesCriteresValidation = z
  .array(criterionCodeValidation)
  .length(CRITERION_CODES.length)
  .refine((codes) => new Set(codes).size === CRITERION_CODES.length, {
    message: 'prioritesCriteres must be a permutation of the 5 criterion codes',
  });

/** The full questionnaire draft (product-spec A1–A18). */
export const draftValidation = z.object({
  // --- CA, by activity stream (A1–A3) ---
  caVente: z.number().nonnegative(),
  caServiceBIC: z.number().nonnegative(),
  caServiceBNC: z.number().nonnegative(),
  // --- Activity sub-type (A4) — CIPAV only meaningful with BNC ---
  activiteSousType: activiteSousTypeValidation,
  // --- Charges & foyer (A5–A9) ---
  chargesReelles: z.number().nonnegative(),
  situationFamiliale: situationUiValidation,
  nombrePersonnesACharge: z.number().int().nonnegative(),
  autresRevenusFoyer: z.number().nonnegative(),
  // --- IS rémunération preference (A10) ---
  preferenceRemuneration: remunerationPreferenceValidation,
  // --- IS rémunération override (optional lever; eurl-is / sasu-is only) ---
  /** Target monthly net salary after tax. 0 ⇒ auto-optimisation. */
  cibleSalaireNetMensuel: z.number().nonnegative(),
  /** Target annual gross dividends to distribute. 0 ⇒ auto-optimisation. */
  cibleDividendesBruts: z.number().nonnegative(),
  // --- ACRE timing (A11–A12) ---
  firstYear: z.boolean(),
  dateDebutActivite: z.string(),
  // --- micro versement libératoire (A13) ---
  rfrNMoins2: z.number().nonnegative(),
  versementLiberatoire: z.boolean(),
  // --- TVA neutrality (A14) ---
  clienteleB2B: z.boolean(),
  // --- Current status, for the switch view (A15) ---
  statutActuel: statutActuelChoiceValidation,
  // --- Priorities (A16) ---
  prioritesCriteres: prioritesCriteresValidation,
  // --- Portage frais de gestion (A17) ---
  fraisGestionMode: fraisGestionModeValidation,
  fraisGestionFixe: z.number().nonnegative(),
  // --- AT/MP override (A18) ---
  tauxAtMp: z.number().nonnegative(),
});

export type Draft = z.infer<typeof draftValidation>;

/** Seed priority order = canonical criterion order (scoring-model §2 "seed order"). */
const SEED_PRIORITIES: CriterionCode[] = [...CRITERION_CODES];

/**
 * The starting draft (product-spec §B smart defaults): empty figures, the seed
 * priority order, B2B clientele, percentage frais de gestion, default AT/MP rate.
 * A ranking only requires at least one CA field > 0.
 */
export const DEFAULT_DRAFT: Draft = {
  caVente: 0,
  caServiceBIC: 0,
  caServiceBNC: 0,
  activiteSousType: 'regime_general',
  chargesReelles: 0,
  situationFamiliale: 'celibataire',
  nombrePersonnesACharge: 0,
  autresRevenusFoyer: 0,
  preferenceRemuneration: 'immediate',
  cibleSalaireNetMensuel: 0,
  cibleDividendesBruts: 0,
  firstYear: false,
  dateDebutActivite: '2026-01-01',
  rfrNMoins2: 0,
  versementLiberatoire: true,
  clienteleB2B: true,
  statutActuel: 'aucun',
  prioritesCriteres: SEED_PRIORITIES,
  fraisGestionMode: 'pct',
  fraisGestionFixe: 0,
  tauxAtMp: SS_AT_MP_TAUX,
};

/** UTF-8-safe base64 (the draft is ASCII, but guard against locale surprises). */
const encodeBase64 = (json: string): string =>
  btoa(Array.from(new TextEncoder().encode(json), (byte) => String.fromCharCode(byte)).join(''));
const decodeBase64 = (raw: string): string => new TextDecoder().decode(Uint8Array.from(atob(raw), (char) => char.charCodeAt(0)));

/**
 * URL codec for the draft: base64-encoded JSON, validated on the way in. A
 * malformed or stale payload throws (caught by `useUrlParam`, which falls back to
 * `DEFAULT_DRAFT`).
 */
export const draftCodec: UrlParamCodec<Draft> = {
  parse: (raw) => draftValidation.parse(JSON.parse(decodeBase64(raw))),
  serialize: (value) => encodeBase64(JSON.stringify(value)),
};

/** The single URL search-param key holding the whole draft. */
export const DRAFT_PARAM_KEY = 'p';

/**
 * Whether the draft has enough input to produce a ranking (product-spec §B: at
 * least one CA stream > 0).
 * @param draft the questionnaire draft
 * @returns true when any CA field is strictly positive
 */
export const hasRankableInput = (draft: Draft): boolean => draft.caVente + draft.caServiceBIC + draft.caServiceBNC > 0;

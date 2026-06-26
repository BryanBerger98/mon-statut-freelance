/**
 * FR label ↔ value option lists for the questionnaire and evolution selects.
 * Shared by `questionnaire-form.tsx` and `evolution-panel.tsx` (typescript.md §2.1:
 * ≥2 callers in the same folder → a local module). Labels are user-facing French;
 * values are the engine/UI enum literals.
 */
import type { ActiviteSousType, FraisGestionMode } from '@/domain/validation';
import type { Draft, StatutActuelChoice } from './draft';

/** A single labelled select option. */
export type Option<TValue extends string> = {
  /** The underlying enum value. */
  value: TValue;
  /** The user-facing French label. */
  label: string;
};

/** Household-situation options (UI granularity, product-spec A6). */
export const SITUATION_OPTIONS: Option<Draft['situationFamiliale']>[] = [
  { value: 'celibataire', label: 'Célibataire' },
  { value: 'marie_pacse', label: 'Marié·e / pacsé·e' },
  { value: 'union_libre', label: 'Union libre' },
];

/** IS rémunération-preference options (product-spec A10). */
export const PREFERENCE_OPTIONS: Option<Draft['preferenceRemuneration']>[] = [
  { value: 'immediate', label: 'Revenu immédiat (maximiser le net)' },
  { value: 'capitalisation', label: 'Capitalisation (minimiser la rémunération)' },
];

/** Activity sub-type options — CIPAV only meaningful for BNC (product-spec A4). */
export const ACTIVITE_OPTIONS: Option<ActiviteSousType>[] = [
  { value: 'regime_general', label: 'Régime général (SSI)' },
  { value: 'cipav', label: 'CIPAV (professions libérales réglementées)' },
];

/** Portage frais-de-gestion mode options (product-spec A17). */
export const FRAIS_GESTION_OPTIONS: Option<FraisGestionMode>[] = [
  { value: 'pct', label: 'Pourcentage standard du CA' },
  { value: 'fixed', label: 'Montant fixe annuel' },
];

/** Current-status options, including the `aucun` sentinel (product-spec A15). */
export const STATUT_ACTUEL_OPTIONS: Option<StatutActuelChoice>[] = [
  { value: 'aucun', label: 'Aucun / pas encore lancé' },
  { value: 'micro-entreprise', label: 'Micro-entreprise' },
  { value: 'ei-reel', label: 'Entreprise individuelle au réel' },
  { value: 'eurl-ir', label: 'EURL à l’IR' },
  { value: 'eurl-is', label: 'EURL à l’IS' },
  { value: 'sasu-ir', label: 'SASU à l’IR' },
  { value: 'sasu-is', label: 'SASU à l’IS' },
  { value: 'portage-salarial', label: 'Portage salarial' },
];

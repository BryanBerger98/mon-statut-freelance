import type { CriterionCode } from '@/domain/scoring';

/**
 * User-facing French copy for one comparison criterion — the questionnaire
 * priority label (product-spec A16 / scoring-model §9) and the reason-chip
 * phrase bank (scoring-model §6, positive vs negative wording).
 *
 * Presentation copy only: no numbers, no scoring logic. The scoring weights and
 * the per-status 0–100 anchors live in `src/domain/scoring.ts`; this module just
 * names the criteria for the questionnaire ordering UI and labels the reason
 * chips on the ranking cards (product-spec §C.1).
 */
export type CriterionMeta = {
  /** Canonical criterion code (matches the scoring engine). */
  code: CriterionCode;
  /** FR label shown in the priority-ordering question (A16). */
  label: string;
  /** Short FR phrase when the status scores HIGH on this criterion (reason chip). */
  positive: string;
  /** Short FR phrase when the status scores LOW on this criterion (reason chip). */
  negative: string;
};

/**
 * Per-criterion FR display copy, keyed by `CriterionCode`. Full (non-Partial)
 * record so TS enforces all 5 criteria are present.
 */
export const CRITERIA_META: Record<CriterionCode, CriterionMeta> = {
  'C-NET': {
    code: 'C-NET',
    label: 'Mon revenu net',
    positive: 'Revenu net élevé',
    negative: 'Revenu net plus faible',
  },
  'C-PROT': {
    code: 'C-PROT',
    label: 'Ma protection sociale (santé, retraite, chômage)',
    positive: 'Protection sociale complète',
    negative: 'Protection sociale limitée',
  },
  'C-SIMP': {
    code: 'C-SIMP',
    label: 'La simplicité administrative',
    positive: 'Démarches simples',
    negative: 'Gestion administrative lourde',
  },
  'C-CAP': {
    code: 'C-CAP',
    label: 'Pouvoir capitaliser / optimiser',
    positive: 'Permet de capitaliser / optimiser',
    negative: "Peu d'optimisation possible",
  },
  'C-EVOL': {
    code: 'C-EVOL',
    label: 'Pouvoir évoluer sans changer de statut',
    positive: 'Évolue avec votre activité',
    negative: 'Plafond / faible marge de croissance',
  },
};

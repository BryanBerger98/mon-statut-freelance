/**
 * Canonical calc-engine TS contract — shapes only, NO numbers.
 *
 * Single source of truth: .claude/docs/business/calculation/schema.md
 * Reference fiscal year: 2026
 * Field names: camelCase (schema.md §(c) reconciliation)
 *
 * Validation uses Zod. Inferred types are the engine's public contract.
 * All 7 status compute functions share the uniform signature:
 *   (input: StatusComputeInput) => StatusResult
 */
import { z } from 'zod';

// ---------------------------------------------------------------------------
// Status identifiers
// ---------------------------------------------------------------------------

/** All 7 supported single-owner (unipersonnel) French freelance statuses. */
export const statusIdValidation = z.enum(['micro-entreprise', 'ei-reel', 'eurl-ir', 'eurl-is', 'sasu-ir', 'sasu-is', 'portage-salarial']);

export type StatusId = z.infer<typeof statusIdValidation>;

// ---------------------------------------------------------------------------
// Sub-type enums
// ---------------------------------------------------------------------------

/**
 * Household situation — drives the DECOTE thresholds and quotient familial base parts.
 * 1 part (single) or 2 parts (couple) before adding dependent half-parts.
 */
export const situationFamilialeValidation = z.enum(['celibataire', 'marie_pacse']);
export type SituationFamiliale = z.infer<typeof situationFamilialeValidation>;

/**
 * Activity sub-type — ONLY distinguishes CIPAV-regulated liberal professions.
 * The artisan / commerçant / libéral split is derived from which CA stream is
 * non-zero (caServiceBIC → BIC ; caServiceBNC → BNC), not from this field.
 * (schema.md AST note)
 */
export const activiteSousTypeValidation = z.enum(['regime_general', 'cipav']);
export type ActiviteSousType = z.infer<typeof activiteSousTypeValidation>;

/**
 * Frais de gestion mode for portage salarial.
 * 'pct' = caTotal × PORTAGE_FRAIS_GESTION rate (default).
 * 'fixed' = fraisGestionFixe euros (capped variant).
 */
export const fraisGestionModeValidation = z.enum(['pct', 'fixed']);
export type FraisGestionMode = z.infer<typeof fraisGestionModeValidation>;

// ---------------------------------------------------------------------------
// Profile — engine input (schema.md §(a))
// ---------------------------------------------------------------------------

/**
 * Profile fed to ALL 7 status computations. Each status reads the subset it
 * needs and ignores the rest (per-status field map in schema.md §(a)).
 *
 * Numbers live in src/domain/constants.ts — never here.
 * Validate at every boundary: questionnaire form → profileValidation.parse(raw).
 */
export const profileValidation = z.object({
  // --- Chiffre d'affaires, split by activity stream (HT) ---
  /** CA vente de marchandises / fourniture de logement (BIC vente). */
  caVente: z.number().nonnegative(),
  /** CA prestations de services BIC. */
  caServiceBIC: z.number().nonnegative(),
  /** CA prestations BNC. caTotal = caVente + caServiceBIC + caServiceBNC (derived). */
  caServiceBNC: z.number().nonnegative(),

  // --- Charges & foyer fiscal ---
  /**
   * Real déductible business charges, EXCLUDING the operator's personal
   * mandatory cotisations (D1). Cash-subtracted in net for micro (CONV-1);
   * netted upstream in bénéfice for réel/société.
   */
  chargesReelles: z.number().nonnegative(),
  /** Drives DECOTE_SEUIL_* and the quotient familial base parts. */
  situationFamiliale: situationFamilialeValidation,
  /**
   * Parts de quotient familial. May be supplied OR derived from
   * situationFamiliale + nombrePersonnesACharge.
   * QF plafonnement (QF_PLAFOND_DEMI_PART) binds only on extra half-parts above
   * the household base (1 single / 2 couple).
   */
  nbParts: z.number().positive(),
  /** Enfants/personnes à charge (extra half-parts ⇒ QF plafonnement). */
  nombrePersonnesACharge: z.number().int().nonnegative(),
  /** Household other taxable income, added BEFORE the barème IR (CONV-2). */
  autresRevenusFoyer: z.number().nonnegative(),

  // --- Activity sous-type & ACRE timing ---
  /** 'cipav' switches the CIPAV barème for cotisations. Default 'regime_general'. */
  activiteSousType: activiteSousTypeValidation,
  /** Year 1 ⇒ ACRE eligible + CFE year-1 exemption. */
  firstYear: z.boolean(),
  /**
   * ISO date string. CONSTANT input — never the system clock.
   * Selects the micro ACRE rate: 50 % if < 2026-07-01, else 25 % (§10/CONV-7).
   */
  dateDebutActivite: z.string(),
  /**
   * Revenu fiscal de référence N-2 — versement libératoire (VL) eligibility
   * test for micro: RFR_{N-2} ≤ VERSEMENT_LIBERATOIRE_SEUIL_RFR × nbParts.
   */
  rfrNMoins2: z.number().nonnegative(),
  /**
   * micro — versement libératoire de l'IR opted in (CONV-8).
   * false ⇒ impôt au barème (marginal IR). true + éligible (rfrNMoins2 ≤ seuil ×
   * nbParts AND CA sous plafond) ⇒ impôt = min(VL, barème), vlApplied = VL ≤ barème.
   * true mais inéligible ⇒ barème. Ignored by the 6 non-micro statuses.
   */
  versementLiberatoire: z.boolean(),
  /** TVA franchise neutrality flag (B2B ⇒ net-neutral for micro/EI). */
  clienteleB2B: z.boolean(),

  // --- Société levers (eurl-is / sasu-* ; ignored by micro/ei-reel/eurl-ir) ---
  /**
   * Capital social + primes + compte courant d'associé — base of the EURL-IS
   * 10 % dividend rule (eurl-is only).
   */
  capitalPlusCCA: z.number().nonnegative(),
  /**
   * Chosen gérant/président rémunération (gross).
   * eurl-is = TNS rémunération versée (D5) ; sasu-* = brut.
   * 0 ⇒ SASU zero-pay lever.
   */
  remunerationChoisie: z.number().nonnegative(),
  /** 0..1 — share of post-IS résultat distributed as dividends (eurl-is, sasu-is). */
  partDividendes: z.number().min(0).max(1),
  /** Dividends tax: false ⇒ PFU (default), true ⇒ option barème IR. */
  optionBaremeDividendes: z.boolean(),
  /**
   * Optional rémunération override (eurl-is, sasu-is ONLY). Target MONTHLY net
   * salary AFTER income tax. When > 0, the engine resolves the gross salary that
   * yields this net-after-tax and fixes the split instead of auto-optimising.
   * 0 ⇒ ignored (auto-optimisation via optimizedProfileFor). Other statuses ignore it.
   */
  cibleSalaireNetMensuel: z.number().nonnegative(),
  /**
   * Optional dividend override (eurl-is, sasu-is ONLY). Target ANNUAL GROSS
   * dividends to distribute (before PFU / prélèvements). When > 0, distributes up
   * to this much of the post-IS résultat. 0 ⇒ ignored. Other statuses ignore it.
   * cibleSalaireNetMensuel = 0 AND cibleDividendesBruts = 0 ⇒ auto-optimisation.
   */
  cibleDividendesBruts: z.number().nonnegative(),

  // --- Portage salarial (ignored by the other 6) ---
  /**
   * 'pct' (default) ⇒ caTotal × PORTAGE_FRAIS_GESTION ;
   * 'fixed' ⇒ fraisGestionFixe (capped variant: min(pct, plafond)).
   */
  fraisGestionMode: fraisGestionModeValidation,
  /** Euro frais de gestion when mode = 'fixed' (per-mission input). */
  fraisGestionFixe: z.number().nonnegative(),

  // --- Régime général AT/MP (sasu-*, portage) ---
  /**
   * Accident-du-travail rate (sector-variable USER-INPUT ; maps to SS_AT_MP_TAUX ;
   * default ≈ 0.70 % bureau).
   */
  tauxAtMp: z.number().nonnegative(),

  // --- Product / scoring (questionnaire ; not used by the numeric pipeline) ---
  /** User's ranked criteria (net, protection sociale, simplicité…). */
  prioritesCriteres: z.array(z.string()),
  /** Current status, for the switch-cost view (optional). */
  statutActuel: statusIdValidation.optional(),
});

export type Profile = z.infer<typeof profileValidation>;

// ---------------------------------------------------------------------------
// StatusResult — engine output (schema.md §(b))
// ---------------------------------------------------------------------------

/**
 * Kind of a fiscal/social reduction line, for UI labelling/grouping.
 * 'abattement' (taxable-base reduction), 'deduction' (deductible from imposable),
 * 'exoneration' (ACRE-type relief), 'frais' (portage frais de gestion skim).
 */
export const reductionKindValidation = z.enum(['abattement', 'deduction', 'exoneration', 'frais']);
export type ReductionKind = z.infer<typeof reductionKindValidation>;

/**
 * Stable English code for a reduction line. The engine stays French-copy-free;
 * the UI maps each code to a French label.
 */
export const reductionCodeValidation = z.enum([
  'abattement-micro',
  'abattement-tns',
  'abattement-salarie',
  'acre',
  'cotisations-deductibles',
  'frais-gestion',
]);
export type ReductionCode = z.infer<typeof reductionCodeValidation>;

/**
 * One fiscal/social advantage applied during a status computation (abattement,
 * déduction, exonération, frais). `taux` is the effective rate (0..1) when one
 * exists; `base` the amount it applied to; `montant` the euro effect. Money rounded
 * at the boundary like every other figure.
 */
export const reductionLineValidation = z.object({
  code: reductionCodeValidation,
  kind: reductionKindValidation,
  /** Effective rate (0..1), when the line has one. */
  taux: z.number().optional(),
  /** Amount the rate/relief applied to. */
  base: z.number().optional(),
  /** Euro effect of the line. */
  montant: z.number(),
});
export type ReductionLine = z.infer<typeof reductionLineValidation>;

/**
 * Full per-status breakdown for the results UI ("afficher TOUT le détail"). Every
 * line is annual euros (the UI mensualises by /12) and is OPTIONAL except the
 * always-present anchors (caTotal, charges, netDisponible, reductions). A status
 * populates only the lines it has — salaried lines for assimilé-salarié, TNS lines
 * for TNS, IS/dividend lines for the IS sociétés. Self-contained: the UI renders
 * purely from this object, mapping `reductions` codes to French labels.
 */
export const statusDetailValidation = z.object({
  // --- Activité ---
  caTotal: z.number(),
  charges: z.number(),
  /** Bénéfice avant rémunération (société/réel). */
  beneficeAvantRemu: z.number().optional(),

  // --- Rémunération ---
  remunerationBrut: z.number().optional(),
  cotisationsSalariales: z.number().optional(),
  cotisationsPatronales: z.number().optional(),
  cotisationsTns: z.number().optional(),
  coutTotalEmployeur: z.number().optional(),
  remunerationNette: z.number().optional(),
  revenuImposable: z.number().optional(),
  impotRevenu: z.number().optional(),
  remunerationNetteApresImpot: z.number().optional(),

  // --- Société (IS) ---
  baseIS: z.number().optional(),
  is: z.number().optional(),

  // --- Dividendes ---
  dividendesBruts: z.number().optional(),
  dividendesPrelevementsSociaux: z.number().optional(),
  dividendesCotisationsTns: z.number().optional(),
  dividendesImpot: z.number().optional(),
  dividendesNets: z.number().optional(),

  // --- Impôts & taxes / frais ---
  cfe: z.number().optional(),
  fraisGestion: z.number().optional(),

  // --- Abattements & déductions ---
  reductions: z.array(reductionLineValidation),

  // --- Headline ---
  netDisponible: z.number(),
});
export type StatusDetail = z.infer<typeof statusDetailValidation>;

/**
 * Base output contract for all 7 statuses.
 * IS statuses (eurl-is, sasu-is) return StatusResultIS (the extension below).
 *
 * Money rounded to 2 decimals at the result boundary; tauxGlobal to 4.
 * (schema.md §(d) determinism contract)
 */
export const statusResultValidation = z.object({
  status: statusIdValidation,
  /**
   * Social total. For IS statuses INCLUDES the PFU prélèvements sociaux
   * (CONV-3: pfuDivPS booked here, NOT in impot).
   */
  cotisations: z.number(),
  /** IR and/or IS + PFU IR part (CONV-3). Décote already applied (§D.1). */
  impot: z.number(),
  /** Ranking key. */
  netDisponible: z.number(),
  /** 1 − netDisponible / caTotal  (CA denominator, all 7 — CONV-5). */
  tauxGlobal: z.number(),

  // Exposed intermediates ("the why") — additive, optional
  /** Assiette TNS or brut (salarié). */
  assietteSociale: z.number().optional(),
  cotisationsSalariales: z.number().optional(),
  cotisationsPatronales: z.number().optional(),
  /** Super-brut (salarié). */
  coutTotalEmployeur: z.number().optional(),
  /** Revenu imposable after 10 % abattement for salarié. */
  revenuImposable: z.number().optional(),
  is: z.number().optional(),
  dividendesNets: z.number().optional(),
  cfe: z.number().optional(),
  acreApplied: z.boolean().optional(),

  // Status-specific optional flags
  /** micro — versement libératoire retained. */
  vlApplied: z.boolean().optional(),
  /** micro — CA over the régime plafond. */
  plafondOverrun: z.boolean().optional(),
  /** micro — régime applicable (false ⇒ overrun, ranked-but-flagged). */
  eligible: z.boolean().optional(),
  /** portage — société de portage skim. */
  fraisGestion: z.number().optional(),
  /** portage — resolved brut below the salaire minimum. */
  nonViable: z.boolean().optional(),
  /** sasu-ir — 5-exercice / SAS<5ans eligibility. */
  optionIRValid: z.boolean().optional(),

  /** Full annual breakdown for the results UI ("afficher TOUT le détail"). */
  detail: statusDetailValidation.optional(),
});

export type StatusResult = z.infer<typeof statusResultValidation>;

/**
 * Extension for IS statuses (eurl-is, sasu-is).
 * Required by scoring-model §1/§3 (remShare).
 */
export const statusResultISValidation = statusResultValidation.extend({
  /** Cotised rémunération, gross (= remunerationChoisie / brut). */
  remuneration: z.number(),
  /** Dividendes bruts (gross distributed). */
  dividendes: z.number(),
  /** remuneration / (remuneration + dividendes) ; 0/0 ⇒ 0. */
  remunerationShare: z.number().min(0).max(1),
});

export type StatusResultIS = z.infer<typeof statusResultISValidation>;

// ---------------------------------------------------------------------------
// Compute input (uniform engine signature)
// ---------------------------------------------------------------------------

/** Uniform compute-function input. One object per calc.md §1. */
export type StatusComputeInput = {
  profile: Profile;
  status: StatusId;
};

/**
 * Barèmes registry — code mirror of `.claude/docs/business/baremes-registry.md`.
 *
 * THE ONLY place a numeric fiscal/social value is asserted (calc.md §1.2).
 * Reference fiscal year: 2026 (single-owner French statuses).
 *
 * Convention
 * ----------
 * - Each constant is a plain `number` in its **formula unit**:
 *     • a percentage rate is stored as a RATIO (registry "21,2 %" → `0.212`);
 *     • a euro amount is stored in euros (`48060`);
 *     • a "× PASS" / "× SMIC" multiple is stored as the multiple (`3`);
 *     • a "% PASS" assiette floor is stored as a ratio of the PASS (`0.115`).
 *   This matches calc.md §1.2's canonical example (`= 0.212`) and keeps formula
 *   code free of `/ 100` noise.
 * - Provenance lives in the JSDoc: registry value as written + official source +
 *   effective year. A value the registry still flags carries a
 *   `FLAGGED [2026 — verify & source]` marker here too (calc.md §1.6) — the
 *   computable golden-master fixtures never touch a flagged constant.
 * - Tables (IR barème, TNS maladie/alloc-fam curves) are structured `as const`.
 *
 * Corrections folded in from the 2026 regulatory-watcher TNS verification pass
 * (regulatory-diff note `update-note-2026-06-25-tns-verification-pass.md`):
 *   TNS_RETRAITE_BASE_TAUX_T1      17,75 → 17,87 %  (service-public F23890)
 *   TNS_IJ_TAUX_ARTISAN_COMMERCANT  0,85 →  0,50 %  (service-public F23890 + CLEISS)
 *   TNS_MALADIE_BAREME             single-linear → 5-segment piecewise global + 6,5 % marginal
 *   TNS_ALLOC_FAM_BAREME           knots confirmed 110 % → 140 % PASS, 0 → 3,10 %
 */

/** Reference fiscal year for every value in this file. */
export const REFERENCE_FISCAL_YEAR = 2026;

// ---------------------------------------------------------------------------
// Structural quotient-familial parts (art. 194 CGI) — legal structure, not a barème
// ---------------------------------------------------------------------------

/** Base parts de quotient familial, personne seule (art. 194 CGI). */
export const NB_PARTS_BASE_CELIBATAIRE = 1;
/** Base parts de quotient familial, couple marié/pacsé imposition commune (art. 194 CGI). */
export const NB_PARTS_BASE_COUPLE = 2;
/** Valeur d'une demi-part de quotient familial (art. 194 CGI). */
export const QF_DEMI_PART = 0.5;

// ---------------------------------------------------------------------------
// §1 Micro-entreprise — abattements forfaitaires (régime micro, IR)
// ---------------------------------------------------------------------------

/** Abattement micro-BIC vente de marchandises / logement. Registry 71 %. Source: impots.gouv. 2026. */
export const MICRO_ABATTEMENT_VENTE = 0.71;
/** Abattement micro-BIC prestations de services. Registry 50 %. Source: impots.gouv. 2026. */
export const MICRO_ABATTEMENT_SERVICE_BIC = 0.5;
/** Abattement micro-BNC (plancher MICRO_ABATTEMENT_MIN). Registry 34 %. Source: impots.gouv. 2026. */
export const MICRO_ABATTEMENT_BNC = 0.34;

// ---------------------------------------------------------------------------
// §2 Micro-entreprise — cotisations sociales (URSSAF auto-entrepreneur, % du CA)
// ---------------------------------------------------------------------------

/** Cotisations micro, vente de marchandises. Registry 12,3 %. Source: service-public F36232. 2026. */
export const MICRO_COTIS_VENTE = 0.123;
/** Cotisations micro, prestations de services BIC. Registry 21,2 %. Source: service-public F36232. 2026. */
export const MICRO_COTIS_SERVICE_BIC = 0.212;
/** Cotisations micro, BNC régime général/SSI. Registry 25,6 %. Source: service-public F36232. 2026. */
export const MICRO_COTIS_BNC = 0.256;

// ---------------------------------------------------------------------------
// §3 Micro-entreprise — plafonds de chiffre d'affaires (€)
// ---------------------------------------------------------------------------

/** Plafond CA micro, vente/logement (2026–2028). Registry 203 100 €. Source: service-public F32353. 2026. */
export const MICRO_PLAFOND_VENTE = 203100;
/** Plafond CA micro, services & BNC (2026–2028). Registry 83 600 €. Source: service-public F32353. 2026. */
export const MICRO_PLAFOND_SERVICE_BNC = 83600;

// ---------------------------------------------------------------------------
// §4 Versement libératoire de l'IR (option micro)
// ---------------------------------------------------------------------------

/** Taux VL, vente. Registry 1,0 %. Source: service-public F23267. 2026. */
export const VERSEMENT_LIBERATOIRE_VENTE = 0.01;
/** Taux VL, services BIC. Registry 1,7 %. Source: service-public F23267. 2026. */
export const VERSEMENT_LIBERATOIRE_SERVICE_BIC = 0.017;
/** Taux VL, BNC. Registry 2,2 %. Source: service-public F23267. 2026. */
export const VERSEMENT_LIBERATOIRE_BNC = 0.022;
/** Plafond RFR N-2 par part ouvrant droit au VL (= borne haute tranche 2 IR). Registry 29 579 €. Source: service-public F23267. 2026. */
export const VERSEMENT_LIBERATOIRE_SEUIL_RFR = 29579;

// ---------------------------------------------------------------------------
// §5 TVA — franchise en base (€) — tous statuts sauf portage
// ---------------------------------------------------------------------------

/** Seuil franchise TVA, vente. Registry 85 000 €. Source: impots.gouv. 2026. */
export const TVA_SEUIL_FRANCHISE_VENTE = 85000;
/** Seuil franchise TVA, services. Registry 37 500 €. Source: impots.gouv. 2026. */
export const TVA_SEUIL_FRANCHISE_SERVICE = 37500;
/** Seuil majoré (tolérance) TVA, vente. Registry 93 500 €. Source: impots.gouv. 2026. */
export const TVA_SEUIL_FRANCHISE_VENTE_MAJORE = 93500;
/** Seuil majoré (tolérance) TVA, services. Registry 41 250 €. Source: impots.gouv. 2026. */
export const TVA_SEUIL_FRANCHISE_SERVICE_MAJORE = 41250;

// ---------------------------------------------------------------------------
// §6 Coarse blended rates — DEPRECATED (registry §6). MUST NOT be read by the precise calc.
// ---------------------------------------------------------------------------

/**
 * @deprecated Coarse fallback only — superseded by the §14 per-cotisation TNS cascade.
 * Registry band ≈ 40–45 % (no single official figure). Never import into a formula.
 */
export const TNS_TAUX_COTIS_REEL = 0.42;
/**
 * @deprecated Coarse fallback only — superseded by the §16 régime-général cascade.
 * Registry band ≈ 75–82 % of net (no single official figure). Never import into a formula.
 */
export const ASSIMILE_SALARIE_TAUX_GLOBAL = 0.78;

// ---------------------------------------------------------------------------
// §7 Impôt sur les sociétés (IS)
// ---------------------------------------------------------------------------

/** Taux réduit IS (PME, fraction éligible). Registry 15 %. Source: service-public F23575. 2026. */
export const IS_TAUX_REDUIT = 0.15;
/** Plafond de bénéfice au taux réduit IS. Registry 42 500 €. Source: service-public F23575. 2026. */
export const IS_PLAFOND_TAUX_REDUIT = 42500;
/** Taux normal IS au-delà du plafond réduit. Registry 25 %. Source: service-public F23575. 2026. */
export const IS_TAUX_NORMAL = 0.25;
/** Plafond CA HT pour le taux réduit IS (condition PME). Registry 10 000 000 €. Source: service-public F23575. 2026. */
export const IS_CA_PLAFOND_PME_TAUX_REDUIT = 10000000;

// ---------------------------------------------------------------------------
// §8 Prélèvement forfaitaire unique (PFU) sur dividendes — MAJOR 2026 CHANGE 30 → 31,4 %
// ---------------------------------------------------------------------------

/** PFU global (IR + PS). Registry 31,4 %. Source: service-public A18796. 2026. */
export const PFU_TAUX = 0.314;
/** PFU — part IR (CONV-3: booked under `impot`). Registry 12,8 %. Source: service-public A18796. 2026. */
export const PFU_PART_IR = 0.128;
/** PFU — part prélèvements sociaux (CONV-3: booked under `cotisations`). Registry 18,6 %. Source: service-public A18796. 2026. */
export const PFU_PART_PS = 0.186;

// ---------------------------------------------------------------------------
// §9 Barème de l'impôt sur le revenu (IR) — art. 197 CGI, indexé +0,9 % (LF 2026)
// ---------------------------------------------------------------------------

/** A single marginal IR bracket (per part de quotient familial). */
export type IrTranche = { readonly min: number; readonly max: number; readonly taux: number };

/**
 * Barème progressif IR par part de quotient familial (revenus 2025, BOFiP
 * BOI-IR-LIQ-20-10). Bornes en euros, taux en ratio. Source: BOFiP. 2026.
 */
export const BAREME_IR_TRANCHES: readonly IrTranche[] = [
  { min: 0, max: 11600, taux: 0 },
  { min: 11600, max: 29579, taux: 0.11 },
  { min: 29579, max: 84577, taux: 0.3 },
  { min: 84577, max: 181917, taux: 0.41 },
  { min: 181917, max: Number.POSITIVE_INFINITY, taux: 0.45 },
] as const;

// ---------------------------------------------------------------------------
// §10 ACRE micro (exonération de début d'activité) — mid-year 2026 change
// ---------------------------------------------------------------------------

/** ACRE micro, début < 2026-07-01 (exonération 50 % des cotisations). Registry 50 %. Source: service-public F11677. 2026. */
export const ACRE_TAUX_EXO_AVANT_20260701 = 0.5;
/** ACRE micro, début ≥ 2026-07-01 (exonération 25 %). Registry 25 %. Source: service-public F11677. 2026. */
export const ACRE_TAUX_EXO_DES_20260701 = 0.25;
/** Date de bascule du taux d'exonération ACRE micro (CONV-7). ISO date — constant, never the clock. Source: service-public F11677. */
export const ACRE_MICRO_DATE_BASCULE = '2026-07-01';
/** Durée ACRE micro ≈ fin du 3e trimestre civil suivant le début. Registry ≈ 12 mois. Source: service-public F11677. 2026. */
export const ACRE_DUREE = 12;

// ---------------------------------------------------------------------------
// §11 Dividendes EURL-IS — assujettissement TNS (art. L131-6 CSS)
// ---------------------------------------------------------------------------

/** Fraction des dividendes (> 10 % de capital+primes+CCA) soumise aux cotisations TNS du gérant majoritaire. Registry 10 %. Source: service-public F32963. 2026. */
export const EURL_IS_SEUIL_DIVIDENDES_COTIS = 0.1;

/**
 * EURL_IS_CAPITAL_DEFAULT — assumed paid-up (libéré) capital social for the eurl-is
 * « règle des 10 % » (art. L131-6 III + R131-7 CSS) when the questionnaire omits
 * capital (CCA assumed 0). PRODUCT JUDGEMENT CALL, not a sourced barème: no official
 * median EURL capital exists (INSEE/INPI publish none). Conventional value above the
 * 1 € legal floor; used ONLY in the draft→Profile resolve layer when capital is
 * unset — the Zod floor stays 0 (a user can legitimately enter 0). Registry §11.
 */
export const EURL_IS_CAPITAL_DEFAULT = 1000;

// ---------------------------------------------------------------------------
// §12 Cotisation foncière des entreprises (CFE)
// ---------------------------------------------------------------------------

/**
 * CFE base minimum — commune-dependent (art. 1647 D CGI), no single national figure.
 * FLAGGED [2026 — verify & source]. Per CONV-4 the engine reports `cfe: 0` and the UI
 * shows CFE as a separate commune-dependent line; this constant is NOT subtracted from net.
 * Source: impots.gouv CET/CFE. 2026.
 */
export const CFE_MONTANT = 0;
/** Plafond CA en deçà duquel exonéré de cotisation minimum CFE (gating). Registry 5 000 €. Source: impots.gouv. 2026. */
export const CFE_CA_SEUIL_EXO = 5000;

// ---------------------------------------------------------------------------
// §13 Supporting constants
// ---------------------------------------------------------------------------

/** Plafond annuel de la sécurité sociale. Registry 48 060 €. Source: urssaf.fr. 2026. */
export const PASS_ANNUEL = 48060;
/** Plafond mensuel de la sécurité sociale. Registry 4 005 €. Source: urssaf.fr. 2026. */
export const PASS_MENSUEL = 4005;
/** Prélèvements sociaux sur revenus du capital (= PFU_PART_PS). Registry 18,6 %. Source: service-public A18796. 2026. */
export const PS_TAUX_GLOBAL = 0.186;
/** CSG + CRDS sur revenus d'activité (TNS). Registry 9,7 %. Source: service-public F2971. 2026. */
export const CSG_CRDS_TAUX = 0.097;
/** CFP micro, vente/commerçant. Registry 0,1 %. Source: service-public F23459. 2026. */
export const MICRO_CFP_VENTE = 0.001;
/** CFP micro, services artisanaux BIC. Registry 0,3 %. Source: service-public F23459. 2026. */
export const MICRO_CFP_SERVICE_BIC = 0.003;
/** CFP micro, BNC / profession libérale. Registry 0,2 %. Source: service-public F23459. 2026. */
export const MICRO_CFP_BNC = 0.002;
/** Salaire min. de référence porté (alias senior), en × PMSS. Registry 75 %. Source: service-public F31620. 2026. */
export const PORTAGE_SALAIRE_MIN_REF = 0.75;
/** Salaire min. porté junior, × PMSS. Registry 70 %. Source: service-public F31620. 2026. */
export const PORTAGE_SALAIRE_MIN_REF_JUNIOR = 0.7;
/** Salaire min. porté senior, × PMSS. Registry 75 %. Source: service-public F31620. 2026. */
export const PORTAGE_SALAIRE_MIN_REF_SENIOR = 0.75;
/** Salaire min. porté forfait-jours, × PMSS. Registry 85 %. Source: service-public F31620. 2026. */
export const PORTAGE_SALAIRE_MIN_REF_FORFAIT_JOURS = 0.85;
/**
 * Plancher mensuel brut de référence porté (tier senior 75 % × PMSS 4 005 € = 3 003,75 €).
 * FLAGGED [2026 — verify: décomposition base+CP+prime via IDCC 3219]. Source: service-public F31620. 2026.
 */
export const PORTAGE_SALAIRE_MIN_REF_EUR = 3003.75;
/**
 * Frais de gestion société de portage (% du CA HT) — USER-INPUT / DEFAULT (décision produit),
 * tarif commercial non encadré par la loi. Default ≈ 8 % (band 5–10 %). Source: service-public F31620. 2026.
 */
export const PORTAGE_FRAIS_GESTION = 0.08;
/**
 * @deprecated Soft sanity-bound only — superseded by §16 + §18 (CHOMAGE_PAT, AGS_PAT).
 * Registry band ≈ 45–55 %. Never import into a formula.
 */
export const PORTAGE_TAUX_CHARGES_GLOBAL = 0.5;

// ---------------------------------------------------------------------------
// §14 TNS au réel — assiette unique 2026 & cotisations par poste (décret 2024-688)
// ---------------------------------------------------------------------------

/** Abattement forfaitaire de l'assiette sociale unique (borné plancher/plafond ci-dessous). Registry 26 %. Source: impots.gouv réforme assiette. 2026. */
export const TNS_ABATTEMENT_ASSIETTE = 0.26;
/** Plancher du MONTANT de l'abattement 26 % (= 1,76 % PASS). Registry 845,86 €. Source: Légifrance décret 2024-688. 2026. */
export const TNS_ABATTEMENT_PLANCHER = 845.86;
/** Plafond du MONTANT de l'abattement 26 % (= 130 % PASS). Registry 62 478 €. Source: Légifrance décret 2024-688. 2026. */
export const TNS_ABATTEMENT_PLAFOND = 62478;

/**
 * A piecewise-linear GLOBAL-rate curve over an assiette expressed as a fraction of the PASS.
 * `knots` = [fractionOfPASS, globalRate] ascending; the rate is linearly interpolated
 * between knots and flat-extrapolated below the first / above the last knot.
 * `marginalSeuilPass` / `marginalTaux` add a MARGINAL rate on the assiette fraction above
 * `marginalSeuilPass × PASS` (set seuil = +Infinity, taux = 0 when there is no marginal band).
 */
export type GlobalRateCurve = {
  readonly knots: readonly (readonly [number, number])[];
  readonly marginalSeuilPass: number;
  readonly marginalTaux: number;
};

/**
 * Maladie-maternité TNS (décret 2024-688). 5-segment piecewise-linear taux GLOBAL ≤ 3 PASS,
 * nul < 20 % PASS, + 6,50 % MARGINAL sur la fraction > 3 PASS.
 * Corrected from the single-linear assumption by the 2026 regulatory-watcher pass.
 * Source: Légifrance art. D.621-1 / D.621-2 CSS, décret 2024-688. 2026.
 */
export const TNS_MALADIE_BAREME: GlobalRateCurve = {
  knots: [
    [0.2, 0],
    [0.4, 0.015],
    [0.6, 0.04],
    [1.1, 0.065],
    [2.0, 0.077],
    [3.0, 0.085],
  ],
  marginalSeuilPass: 3,
  marginalTaux: 0.065,
} as const;

/** Indemnités journalières, artisan/commerçant (≤ 5 PASS). Corrected 0,85 → 0,50 % (regulatory-watcher 2026). Registry 0,50 %. Source: service-public F23890 + CLEISS. 2026. */
export const TNS_IJ_TAUX_ARTISAN_COMMERCANT = 0.005;
/** Indemnités journalières, profession libérale (≤ 3 PASS). FLAGGED [2026 — verify & source]. Registry 0,30 %. Source: urssaf plr-hors-cipav. 2026. */
export const TNS_IJ_TAUX_PL = 0.003;
/** Plafond IJ artisan/commerçant. Registry 5 PASS. Source: urssaf ac-plnr. 2026. */
export const TNS_IJ_PLAFOND_PASS_ARTISAN_COMMERCANT = 5;
/** Plafond IJ profession libérale. FLAGGED [2026 — verify & source]. Registry 3 PASS. Source: urssaf plr-hors-cipav. 2026. */
export const TNS_IJ_PLAFOND_PASS_PL = 3;
/** Retraite de base, part plafonnée (≤ 1 PASS). Corrected 17,75 → 17,87 % post-réforme (regulatory-watcher 2026). Registry 17,87 %. Source: service-public F23890. 2026. */
export const TNS_RETRAITE_BASE_TAUX_T1 = 0.1787;
/** Retraite de base, part déplafonnée (totalité). Registry 0,72 %. Source: urssaf réforme indépendants. 2026. */
export const TNS_RETRAITE_BASE_TAUX_DEPLAFONNE = 0.0072;
/** Retraite complémentaire RCI, tranche ≤ 1 PASS. Registry 8,10 %. Source: urssaf réforme indépendants. 2026. */
export const TNS_RETRAITE_COMPL_TAUX_T1 = 0.081;
/** Retraite complémentaire RCI, tranche 1 → 4 PASS. Registry 9,10 %. Source: urssaf réforme indépendants. 2026. */
export const TNS_RETRAITE_COMPL_TAUX_T2 = 0.091;
/** Plafond haut T2 RCI. Registry 4 PASS. Source: urssaf ac-plnr. 2026. */
export const TNS_RETRAITE_COMPL_PLAFOND_T2_PASS = 4;
/** Invalidité-décès (≤ 1 PASS). Registry 1,30 %. Source: urssaf ac-plnr. 2026. */
export const TNS_INVALIDITE_DECES_TAUX = 0.013;

/**
 * Allocations familiales TNS, progressif GLOBAL : 0 % ≤ 110 % PASS ; linéaire 0 → 3,10 %
 * entre 110 % et 140 % PASS ; 3,10 % au-delà (plateau, pas de marginal).
 * Knots confirmed by the 2026 regulatory-watcher pass. Source: Légifrance art. D.613-1 CSS. 2026.
 */
export const TNS_ALLOC_FAM_BAREME: GlobalRateCurve = {
  knots: [
    [1.1, 0],
    [1.4, 0.031],
  ],
  marginalSeuilPass: Number.POSITIVE_INFINITY,
  marginalTaux: 0,
} as const;

/** CFP artisan (forfait = taux × PASS ≈ 139 €). Registry 0,29 %. Source: service-public F23459. 2026. */
export const TNS_CFP_TAUX_ARTISAN = 0.0029;
/** CFP commerçant / PL (forfait = taux × PASS ≈ 120 €). Registry 0,25 %. Source: service-public F23459. 2026. */
export const TNS_CFP_TAUX_COMMERCANT_PL = 0.0025;
/** Assiette minimale retraite de base, en fraction du PASS (0,115 × PASS). FLAGGED [2026 — verify & source]. Registry 11,5 % PASS. Source: urssaf. 2026. */
export const TNS_ASSIETTE_MIN_RETRAITE_BASE_PASS = 0.115;
/** Assiette minimale IJ uniquement, en fraction du PASS (0,40 × PASS). Le minimum maladie-maternité a été supprimé : ce plancher ne s'applique QU'AUX indemnités journalières. FLAGGED [2026 — verify & source]. Registry 40 % PASS. Source: urssaf. 2026. */
export const TNS_ASSIETTE_MIN_IJ_PASS = 0.4;
/** Assiette minimale invalidité-décès, en fraction du PASS (0,115 × PASS). FLAGGED [2026 — verify & source]. Registry 11,5 % PASS. Source: urssaf. 2026. */
export const TNS_ASSIETTE_MIN_INVALIDITE_PASS = 0.115;

// ---------------------------------------------------------------------------
// §15 CSG-CRDS — décomposition (somme = CSG_CRDS_TAUX 9,7 %)
// ---------------------------------------------------------------------------

/** CSG déductible sur revenus d'activité. Registry 6,80 %. Source: service-public F2971. 2026. */
export const CSG_DEDUCTIBLE_TAUX = 0.068;
/** CSG non déductible sur revenus d'activité. Registry 2,40 %. Source: service-public F2971. 2026. */
export const CSG_NON_DEDUCTIBLE_TAUX = 0.024;
/** CRDS sur revenus d'activité. Registry 0,50 %. Source: service-public F2971. 2026. */
export const CRDS_TAUX = 0.005;
/** Abattement d'assiette CSG-CRDS salarié (assiette = 98,25 % du brut). Registry 1,75 %. Source: service-public F2971. 2026. */
export const CSG_CRDS_ABATTEMENT_SALARIE = 0.0175;
/** Plafond d'assiette de l'abattement 1,75 %. Registry 4 PASS. Source: service-public F2971. 2026. */
export const CSG_CRDS_PLAFOND_SALARIE_PASS = 4;

// ---------------------------------------------------------------------------
// §16 Assimilé-salarié / régime général — sasu-*, portage
// ---------------------------------------------------------------------------

/** Maladie patronal, taux plein (totalité). Registry 13,00 %. Source: urssaf secteur-privé. 2026. */
export const SS_MALADIE_PATRONAL_PLEIN = 0.13;
/** @deprecated SUPERSEDED par RGDU 2026 (zones uniquement). Registry 7,00 %. */
export const SS_MALADIE_PATRONAL_REDUIT = 0.07;
/** @deprecated SUPERSEDED — ex-bandeau maladie. Registry 2,5 × SMIC. */
export const SS_MALADIE_SEUIL_SMIC = 2.5;
/** Vieillesse plafonnée, salariale (T1 ≤ 1 PASS). Registry 6,90 %. Source: urssaf secteur-privé. 2026. */
export const SS_VIEILLESSE_PLAF_SAL = 0.069;
/** Vieillesse plafonnée, patronale (T1 ≤ 1 PASS). Registry 8,55 %. Source: urssaf secteur-privé. 2026. */
export const SS_VIEILLESSE_PLAF_PAT = 0.0855;
/** Vieillesse déplafonnée, salariale (totalité). Registry 0,40 %. Source: urssaf secteur-privé. 2026. */
export const SS_VIEILLESSE_DEPLAF_SAL = 0.004;
/** Vieillesse déplafonnée, patronale (totalité). Hausse 2,02 → 2,11 % au 01/01/2026. Registry 2,11 %. Source: urssaf secteur-privé. 2026. */
export const SS_VIEILLESSE_DEPLAF_PAT = 0.0211;
/** Allocations familiales patronal, plein (totalité). Registry 5,25 %. Source: urssaf secteur-privé. 2026. */
export const SS_ALLOC_FAM_PAT_PLEIN = 0.0525;
/** @deprecated SUPERSEDED par RGDU 2026 (zones uniquement). Registry 3,45 %. */
export const SS_ALLOC_FAM_PAT_REDUIT = 0.0345;
/** @deprecated SUPERSEDED — ex-bandeau alloc. familiales. Registry 3,5 × SMIC. */
export const SS_ALLOC_FAM_SEUIL_SMIC = 3.5;
/** Contribution solidarité autonomie (totalité). Registry 0,30 %. Source: urssaf secteur-privé. 2026. */
export const SS_CSA_PAT = 0.003;
/** FNAL (< 50 salariés, sur T1). Registry 0,10 %. Source: urssaf FNAL. 2026. */
export const SS_FNAL_PAT = 0.001;
/** Accident du travail / maladie pro — USER-INPUT / DEFAULT (sectoriel CARSAT). Default ≈ 0,70 % bureau. Source: urssaf AT. 2026. */
export const SS_AT_MP_TAUX = 0.007;
/** Agirc-Arrco T1, salariale. Registry 3,15 %. Source: agirc-arrco.fr. 2026. */
export const AGIRC_ARRCO_T1_SAL = 0.0315;
/** Agirc-Arrco T1, patronale. Registry 4,72 %. Source: agirc-arrco.fr. 2026. */
export const AGIRC_ARRCO_T1_PAT = 0.0472;
/** Agirc-Arrco T2, salariale. Registry 8,64 %. Source: agirc-arrco.fr. 2026. */
export const AGIRC_ARRCO_T2_SAL = 0.0864;
/** Agirc-Arrco T2, patronale. Registry 12,95 %. Source: agirc-arrco.fr. 2026. */
export const AGIRC_ARRCO_T2_PAT = 0.1295;
/** Plafond haut T2 Agirc-Arrco / CET (T2 = 1 → 8 PASS). Registry 8 PASS. Source: agirc-arrco.fr. 2026. */
export const AGIRC_ARRCO_PLAFOND_T2_PASS = 8;
/** CEG T1, salariale. Registry 0,86 %. Source: agirc-arrco.fr. 2026. */
export const CEG_T1_SAL = 0.0086;
/** CEG T1, patronale. Registry 1,29 %. Source: agirc-arrco.fr. 2026. */
export const CEG_T1_PAT = 0.0129;
/** CEG T2, salariale. Registry 1,08 %. Source: agirc-arrco.fr. 2026. */
export const CEG_T2_SAL = 0.0108;
/** CEG T2, patronale. Registry 1,62 %. Source: agirc-arrco.fr. 2026. */
export const CEG_T2_PAT = 0.0162;
/** CET, salariale (totalité ≤ 8 PASS). Registry 0,14 %. Source: agirc-arrco.fr. 2026. */
export const CET_SAL = 0.0014;
/** CET, patronale. Registry 0,21 %. Source: agirc-arrco.fr. 2026. */
export const CET_PAT = 0.0021;
/** APEC (cadres), salariale (T1+T2 ≤ 4 PASS). Registry 0,024 %. Source: agirc-arrco.fr. 2026. */
export const APEC_SAL = 0.00024;
/** APEC (cadres), patronale. Registry 0,036 %. Source: agirc-arrco.fr. 2026. */
export const APEC_PAT = 0.00036;
/** Plafond haut APEC (tranches A+B = 0 → 4 PASS). Registry 4 PASS. Source: agirc-arrco.fr. 2026. */
export const APEC_PLAFOND_PASS = 4;
/** Prévoyance cadre obligatoire (min. 1,50 % TA — ANI cadres art. 7). Registry 1,50 %. Source: agirc-arrco.fr. 2026. */
export const PREVOYANCE_CADRE_PAT_T1 = 0.015;
/** Formation pro employeur (< 11 salariés). Registry 0,55 %. Source: urssaf. 2026. */
export const FORMATION_PRO_PAT = 0.0055;
/** Taxe d'apprentissage (hors Alsace-Moselle). Registry 0,68 %. Source: urssaf. 2026. */
export const TAXE_APPRENTISSAGE_PAT = 0.0068;

// ---------------------------------------------------------------------------
// §17 SMIC de référence (€)
// ---------------------------------------------------------------------------

/** SMIC brut annuel FIGÉ au 01/01/2026 pour la RGDU (12,02 €/h × 1 820 h ; 3 SMIC = 65 629,20 €). Registry 21 876,40 €. Source: service-public A18966. 2026. */
export const SMIC_ANNUEL_BRUT = 21876.4;
/** SMIC brut annuel EN VIGUEUR depuis 01/06/2026 (hors RGDU). Registry 22 404,20 €. Source: service-public F2300. 2026. */
export const SMIC_ANNUEL_BRUT_EN_VIGUEUR = 22404.2;

// ---------------------------------------------------------------------------
// §18 Portage — assurance chômage + AGS (s'ajoutent au régime général §16)
// ---------------------------------------------------------------------------

/** Assurance chômage, patronale (≤ 4 PASS). Registry 4,00 %. Source: unedic.org. 2026. */
export const CHOMAGE_PAT = 0.04;
/** AGS (garantie des salaires), patronale (≤ 4 PASS). Registry 0,25 %. Source: unedic.org. 2026. */
export const AGS_PAT = 0.0025;
/** Plafond chômage + AGS. Registry 4 PASS. Source: unedic.org. 2026. */
export const CHOMAGE_PLAFOND_PASS = 4;

// ---------------------------------------------------------------------------
// §19 Réduction générale dégressive unique (RGDU) — régime général 2026 (portage éligible, sasu-* NON)
// ---------------------------------------------------------------------------

/** Plafond d'éligibilité / point d'annulation RGDU. Registry 3 × SMIC. Source: service-public A18448. 2026. */
export const RGDU_SMIC_PLAFOND_MULTIPLE = 3;
/** Paramètre Tmin (plancher 2 % dans la bande). Registry 0,0200. Source: service-public A18448. 2026. */
export const RGDU_PARAM_TMIN = 0.02;
/** Paramètre Tdelta (FNAL 0,10 % / < 50 sal.). Registry 0,3781. Source: service-public A18448. 2026. */
export const RGDU_PARAM_TDELTA = 0.3781;
/** Exposant P de la formule dégressive. Registry 1,75. Source: service-public A18448. 2026. */
export const RGDU_PARAM_EXPOSANT_P = 1.75;
/** Coefficient maximal à hauteur du SMIC (= Tmin + Tdelta). Registry 0,3981. Source: service-public A18448. 2026. */
export const RGDU_COEFF_MAX = 0.3981;

// ---------------------------------------------------------------------------
// §20 IR / dividendes / micro — constantes fiscales complémentaires
// ---------------------------------------------------------------------------

/** Plafonnement de l'avantage en impôt par demi-part de QF (LF 2026). Registry 1 807 €. Source: BOFiP BOI-IR-LIQ-20-20-20. 2026. */
export const QF_PLAFOND_DEMI_PART = 1807;
/** Plancher de l'abattement forfaitaire micro (art. 50-0 / 102 ter CGI). Registry 305 €. Source: impots.gouv. 2026. */
export const MICRO_ABATTEMENT_MIN = 305;
/** Abattement dividendes pour l'option barème IR (art. 158-3-2° CGI) — non applicable au PFU. Registry 40 %. Source: BOFiP BOI-RPPM-RCM-20-10-30-10. 2026. */
export const DIVIDENDES_ABATTEMENT_BAREME = 0.4;

// ---------------------------------------------------------------------------
// §21 ACRE au réel (≠ micro) — exonération dégressive d'une fraction des cotisations
// ---------------------------------------------------------------------------

/** Plafond de revenu pour l'exonération PLEINE (= 36 045 €). Registry 0,75 PASS. Source: service-public F11677. 2026. */
export const ACRE_REEL_PLAFOND_REVENU_PASS = 0.75;
/** Plafond haut de la bande dégressive (exonération nulle au-delà = 48 060 €). Registry 1 PASS. Source: service-public F11677. 2026. */
export const ACRE_REEL_DEGRESSIVITE_PLAFOND_PASS = 1;
/** Taux d'exonération ACRE au réel (≤ 0,75 PASS). Registry 25 %. Source: service-public F11677. 2026. */
export const ACRE_REEL_TAUX_EXO = 0.25;
/** Taux d'exonération ACRE assimilé-salarié (président de SASU, 1re année, sur les lignes SS du régime général). Mêmes bandes dégressives que le réel (décret CSS D131-6-1 unifié) ; valeur 2026 alignée sur ACRE_REEL_TAUX_EXO mais constante distincte pour découpler une divergence future. FLAGGED [2026 — verify & source ; CSS D131-6-1 / URSSAF]. Registry 25 %. Source: urssaf.fr exoneration-acre-createur. 2026. */
export const ACRE_ASSIMILE_TAUX_EXO = 0.25;

// ---------------------------------------------------------------------------
// §22 Constitution de société (capital, options fiscales, frais)
// ---------------------------------------------------------------------------

/** Capital social minimum légal EURL. Registry 1 €. Source: service-public F37777. 2026. */
export const EURL_CAPITAL_MIN = 1;
/** Part minimale des apports en numéraire libérée à la constitution EURL (art. L223-7 c. com.). Registry 20 %. Source: Légifrance. 2026. */
export const EURL_CAPITAL_LIBERATION_MIN_PCT = 0.2;
/** Capital social minimum légal SASU. Registry 1 €. Source: service-public F37383. 2026. */
export const SASU_CAPITAL_MIN = 1;
/** Part minimale des apports en numéraire libérée à la constitution SASU. Registry 50 %. Source: service-public F37383. 2026. */
export const SASU_CAPITAL_LIBERATION_MIN_PCT = 0.5;
/** Fenêtre de renonciation à l'option IS (art. 239 CGI). Registry 5 exercices. Source: BOFiP. 2026. */
export const IS_OPTION_RENONCIATION_WINDOW_YEARS = 5;
/** Au-delà, l'option IS devient définitive (art. 239 CGI). Registry 5 exercices. Source: BOFiP. 2026. */
export const IS_OPTION_REVERSAL_CAP_YEARS = 5;
/** Durée maximale de l'option IR (art. 239 bis AB CGI). Registry 5 exercices. Source: Légifrance. 2026. */
export const SASU_IR_OPTION_MAX_YEARS = 5;
/** Frais de greffe immatriculation RCS société (+ 19,33 € bénéficiaires effectifs). FLAGGED [2026 — verify: tarif greffe A743]. Registry 33,83 €. Source: infogreffe.fr. 2026. */
export const GREFFE_FRAIS_IMMATRICULATION_SOCIETE = 33.83;
/** Forfait annonce légale de constitution (varie par forme + département ; indicatif métropole). FLAGGED [2026 — verify: forfait par forme/département]. Registry band ≈ 121–197 €. Source: Légifrance arrêté 19/11/2025. 2026. */
export const ANNONCE_LEGALE_COUT_CONSTITUTION = 150;

// ---------------------------------------------------------------------------
// §23 CIPAV — variantes micro & réel (profession libérale réglementée, branche D4)
// ---------------------------------------------------------------------------

/** Cotisations micro, BNC relevant de la CIPAV. Registry 23,20 %. Source: urssaf plr-cipav. 2026. */
export const MICRO_COTIS_BNC_CIPAV = 0.232;
/** Retraite compl. CIPAV (réel), tranche ≤ 1 PASS. FLAGGED [2026 — verify & source ; modèle par points]. Registry 11 %. Source: urssaf plr-cipav. 2026. */
export const TNS_RETRAITE_COMPL_CIPAV_TAUX_T1 = 0.11;
/** Retraite compl. CIPAV (réel), tranche > 1 PASS. FLAGGED [2026 — verify & source ; modèle par points]. Registry 21 %. Source: urssaf plr-cipav. 2026. */
export const TNS_RETRAITE_COMPL_CIPAV_TAUX_T2 = 0.21;
/** Retraite de base PLR/CIPAV (réel), part plafonnée (≤ 1 PASS). Confirmé 8,73 % (tax-social-modeler 2026, résout 8,23 vs 8,73). Registry 8,73 %. Source: urssaf plr-cipav. 2026. */
export const TNS_RETRAITE_BASE_CIPAV_TAUX_T1 = 0.0873;
/** Retraite de base PLR/CIPAV (réel), part T2 (1 → 5 PASS). La CIPAV n'a PAS la déplafonnée SSI 0,72 % mais une seconde tranche de base. FLAGGED [2026 — verify & source ; modèle CIPAV par points]. Registry ≈ 1,87 %. Source: urssaf plr-cipav. 2026. */
export const TNS_RETRAITE_BASE_CIPAV_TAUX_T2 = 0.0187;
/** Plafond haut de la retraite de base T2 CIPAV. FLAGGED [2026 — verify & source]. Registry 5 PASS. Source: urssaf plr-cipav. 2026. */
export const TNS_RETRAITE_BASE_CIPAV_PLAFOND_T2_PASS = 5;

// ---------------------------------------------------------------------------
// §24 IR — décote, abattement forfaitaire salarié, contributions hauts revenus
// ---------------------------------------------------------------------------

/** Décote IR — forfait personne seule (s'applique tant que IR brut < 1 982 €). Registry 897 €. Source: economie.gouv. 2026. */
export const DECOTE_SEUIL_CELIBATAIRE = 897;
/** Décote IR — forfait couple imposition commune (s'applique tant que IR brut < 3 277 €). Registry 1 483 €. Source: economie.gouv. 2026. */
export const DECOTE_SEUIL_COUPLE = 1483;
/** Taux de la décote (fraction de l'IR brut retranchée du forfait). Registry 45,25 %. Source: economie.gouv. 2026. */
export const DECOTE_TAUX = 0.4525;
/** Déduction forfaitaire 10 % frais pro (traitements & salaires) — sasu-is rému + portage. Registry 10 %. Source: impots.gouv. 2026. */
export const ABATTEMENT_FORFAITAIRE_SALARIE_TAUX = 0.1;
/** Plancher de la déduction 10 % (par personne). Registry 509 €. Source: impots.gouv. 2026. */
export const ABATTEMENT_FORFAITAIRE_SALARIE_MIN = 509;
/** Plafond de la déduction 10 % (par personne). Registry 14 555 €. Source: impots.gouv. 2026. */
export const ABATTEMENT_FORFAITAIRE_SALARIE_MAX = 14555;
/** CEHR — seuil de RFR d'assujettissement, personne seule (art. 223 sexies CGI). Registry 250 000 €. Source: service-public F31130. 2026. */
export const CEHR_SEUIL_CELIBATAIRE = 250000;
/** CEHR — seuil de RFR, couple. Registry 500 000 €. Source: service-public F31130. 2026. */
export const CEHR_SEUIL_COUPLE = 500000;
/** CEHR — taux tranche 1 (3 %). Registry 3 %. Source: service-public F31130. 2026. */
export const CEHR_TAUX_TRANCHE_1 = 0.03;
/** CEHR — taux tranche 2 (4 %). Registry 4 %. Source: service-public F31130. 2026. */
export const CEHR_TAUX_TRANCHE_2 = 0.04;
/** CDHR — taux effectif minimum d'imposition (RFR > 250k/500k), prorogée 2026. FLAGGED [2026 — verify: mécanique RFR retraité + acompte]. Registry 20 %. Source: service-public F31130. 2026. */
export const CDHR_TAUX_MINIMUM = 0.2;

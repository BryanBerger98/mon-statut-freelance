/**
 * Portage-salarial calc — salarié porté (régime général FULL cover incl. chômage + AGS,
 * RGDU eligible per D6). Unlike sasu-*, the `brut` is NOT chosen: it is RESOLVED from the
 * CA-after-frais-de-gestion envelope, because patronal rates are per-tranche (PASS-capped)
 * and the RGDU is degressive ⇒ brut → enveloppe chargée is not a single ratio. Pure
 * transcription of `.claude/docs/business/calculation/portage-salarial.md`.
 *
 * Pipeline (spec §c):
 *   1. fraisGestion = pct × caTotal (default) OR fraisGestionFixe (fixed mode)
 *   2. enveloppeChargée = caTotal − fraisGestion (masse salariale chargée disponible)
 *   3. resolve `brut` by monotone bisection: coutTotalEmployeur(brut) = enveloppeChargée
 *      (coutTotalEmployeur strictly increases in brut: brut↑, patronal↑, RGDU↓; chômage/AGS↑)
 *   4. cotisationsPatronales = enveloppeChargée − brut (exact by construction, step 5 spec)
 *   5. cotisationsSalariales / net from the régime cascade at the resolved brut
 *   6. salaireImposable = net + CSG/CRDS non déduct. ; − 10 % abattement salarié (clampé)
 *   7. impotIR = IR marginal du foyer (barème → QF → décote, CONV-2)
 *   8. netDisponible = caTotal − fraisGestion − cotisations − impotIR (= net − impotIR)
 *
 * No ACRE (salarié porté is not a créateur ⇒ `firstYear` ignored). No CFE (the société de
 * portage bears its own). Non-viable flag: resolved brut below the annual salaire-minimum
 * floor (CA too low) ⇒ surfaced, NOT silently clamped to a negative net (spec edge (d)).
 *
 * Ledger: fraisGestion + cotisations + impot + netDisponible = caTotal (exact — step-5
 * patronal closes the envelope to the penny). Numbers come only from constants.ts.
 */
import {
  ABATTEMENT_FORFAITAIRE_SALARIE_MAX,
  ABATTEMENT_FORFAITAIRE_SALARIE_MIN,
  ABATTEMENT_FORFAITAIRE_SALARIE_TAUX,
  PASS_ANNUEL,
  PORTAGE_FRAIS_GESTION,
  PORTAGE_SALAIRE_MIN_REF,
} from '../constants';
import { computeMarginalImpotRevenu } from '../helpers/impot-revenu';
import { roundTaux, roundToEuros } from '../helpers/money';
import { clampMontant } from '../helpers/pass';
import { computeRegimeGeneral } from '../helpers/regime-general';
import type { ReductionLine, StatusDetail } from '../validation';
import type { StatusCompute } from './types';

/** Bisection iteration cap (numerical-method param, NOT a barème): log2 bracket / 1 € ≪ 40. */
const BISECTION_MAX_ITER = 40;
/** Bisection target tolerance in euros (spec edge (c): fixed 1 € tolerance, deterministic). */
const BISECTION_TOL_EUR = 1;

type ResolveBrutInput = {
  enveloppeChargee: number;
  tauxAtMp: number;
};

/**
 * Resolves the annual `brut` whose fully-charged employer cost exhausts the chargeable
 * envelope, by monotone bisection on coutTotalEmployeur (RGDU + chômage/AGS on, no ACRE).
 * @param input the chargeable envelope (caTotal − fraisGestion) and the AT/MP rate
 * @returns the resolved brut in [0, enveloppeChargee] within BISECTION_TOL_EUR of the target
 */
const resolveBrut = (input: ResolveBrutInput): number => {
  const { enveloppeChargee, tauxAtMp } = input;
  if (enveloppeChargee <= 0) return 0;
  const coutEmployeur = (brut: number): number =>
    computeRegimeGeneral({ brut, tauxAtMp, appliquerRgdu: true, inclureChomageAgs: true }).coutTotalEmployeur;
  // coutTotalEmployeur ≥ brut ⇒ the solution brut ≤ enveloppeChargee: a valid bracket.
  let low = 0;
  let high = enveloppeChargee;
  for (let i = 0; i < BISECTION_MAX_ITER; i++) {
    const mid = (low + high) / 2;
    const cout = coutEmployeur(mid);
    if (Math.abs(cout - enveloppeChargee) < BISECTION_TOL_EUR) return mid;
    if (cout < enveloppeChargee) low = mid;
    else high = mid;
  }
  return (low + high) / 2;
};

export const computePortage: StatusCompute = (input) => {
  const { profile } = input;
  const caTotal = profile.caVente + profile.caServiceBIC + profile.caServiceBNC;

  // 1. Frais de gestion — pct du CA (défaut) ou montant fixe (per-mission), borné au CA.
  const fraisGestion = profile.fraisGestionMode === 'fixed' ? Math.min(profile.fraisGestionFixe, caTotal) : caTotal * PORTAGE_FRAIS_GESTION;

  // 2. Enveloppe chargée disponible pour le salaire (masse salariale chargée).
  const enveloppeChargee = caTotal - fraisGestion;

  // 3. Résolution du brut par bissection (coutTotalEmployeur monotone croissant).
  const brut = resolveBrut({ enveloppeChargee, tauxAtMp: profile.tauxAtMp });
  const regime = computeRegimeGeneral({ brut, tauxAtMp: profile.tauxAtMp, appliquerRgdu: true, inclureChomageAgs: true });

  // 4. Patronal = enveloppe − brut (exact, ferme l'enveloppe au centime — step 5 spec).
  const cotisationsPatronales = enveloppeChargee - brut;
  const cotisationsSalariales = regime.cotisationsSalariales;
  const net = brut - cotisationsSalariales;

  // 6. Salaire imposable = net + CSG/CRDS non déductible, moins le 10 % abattement salarié
  // (clampé [MIN, MAX], jamais > salaireImposable ⇒ 0 à brut nul).
  const salaireImposable = net + regime.csgCrdsNonDeduct;
  const abattementSalarie = Math.min(
    salaireImposable,
    clampMontant({
      value: ABATTEMENT_FORFAITAIRE_SALARIE_TAUX * salaireImposable,
      min: ABATTEMENT_FORFAITAIRE_SALARIE_MIN,
      max: ABATTEMENT_FORFAITAIRE_SALARIE_MAX,
    }),
  );
  const remunerationImposable = salaireImposable - abattementSalarie;

  // 7. IR marginal du foyer (barème → QF → décote, CONV-2).
  const impotIr = computeMarginalImpotRevenu({
    revenuImposable: remunerationImposable,
    autresRevenusFoyer: profile.autresRevenusFoyer,
    nbParts: profile.nbParts,
    situationFamiliale: profile.situationFamiliale,
  });

  // 8. Net disponible (= net − IR ; pas de CFE pour le salarié porté).
  const cotisations = cotisationsSalariales + cotisationsPatronales;
  const netDisponible = net - impotIr;
  const tauxGlobal = caTotal > 0 ? 1 - netDisponible / caTotal : 0;

  // Viabilité : brut résolu sous le plancher annuel (0,75 × PASS = annualisation du salaire min.
  // de référence porté) ⇒ mission non viable à ce CA. Surfacé, jamais clampé en net négatif (edge (d)).
  const salaireMinAnnuel = PORTAGE_SALAIRE_MIN_REF * PASS_ANNUEL;
  const nonViable = brut < salaireMinAnnuel;

  // Full breakdown for the results UI ("afficher TOUT le détail"). The frais de gestion (société
  // de portage) take a % of CA off the top ; the 10 % abattement salarié lowers the IR base.
  const reductions: ReductionLine[] = [
    {
      code: 'frais-gestion',
      kind: 'frais',
      taux: roundTaux(caTotal > 0 ? fraisGestion / caTotal : 0),
      base: roundToEuros(caTotal),
      montant: roundToEuros(fraisGestion),
    },
    {
      code: 'abattement-salarie',
      kind: 'abattement',
      taux: roundTaux(salaireImposable > 0 ? abattementSalarie / salaireImposable : 0),
      base: roundToEuros(salaireImposable),
      montant: roundToEuros(abattementSalarie),
    },
  ];
  const detail: StatusDetail = {
    caTotal: roundToEuros(caTotal),
    charges: roundToEuros(profile.chargesReelles),
    remunerationBrut: roundToEuros(brut),
    cotisationsSalariales: roundToEuros(cotisationsSalariales),
    cotisationsPatronales: roundToEuros(cotisationsPatronales),
    remunerationNette: roundToEuros(net),
    revenuImposable: roundToEuros(remunerationImposable),
    impotRevenu: roundToEuros(impotIr),
    remunerationNetteApresImpot: roundToEuros(net - impotIr),
    fraisGestion: roundToEuros(fraisGestion),
    reductions,
    netDisponible: roundToEuros(netDisponible),
  };

  return {
    status: 'portage-salarial',
    cotisations: roundToEuros(cotisations),
    impot: roundToEuros(impotIr),
    netDisponible: roundToEuros(netDisponible),
    tauxGlobal: roundTaux(tauxGlobal),
    cotisationsSalariales: roundToEuros(cotisationsSalariales),
    cotisationsPatronales: roundToEuros(cotisationsPatronales),
    assietteSociale: roundToEuros(brut),
    revenuImposable: roundToEuros(remunerationImposable),
    fraisGestion: roundToEuros(fraisGestion),
    nonViable,
    detail,
  };
};

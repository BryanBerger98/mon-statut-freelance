/**
 * Micro-entreprise calc — TNS forfaitaire (cotisations = taux × CA), IR au barème
 * OR versement libératoire (auto-optimised). Pure transcription of
 * `.claude/docs/business/calculation/micro-entreprise.md`.
 *
 * Each activity stream (vente / service-BIC / BNC) carries its own abattement,
 * cotis rate, CFP rate and VL rate; the result is the sum of the three streams.
 * Numbers come only from constants.ts (calc.md §1.2); rounding is boundary-only.
 */
import {
  CFE_MONTANT,
  MICRO_ABATTEMENT_BNC,
  MICRO_ABATTEMENT_MIN,
  MICRO_ABATTEMENT_SERVICE_BIC,
  MICRO_ABATTEMENT_VENTE,
  MICRO_CFP_BNC,
  MICRO_CFP_SERVICE_BIC,
  MICRO_CFP_VENTE,
  MICRO_COTIS_BNC,
  MICRO_COTIS_BNC_CIPAV,
  MICRO_COTIS_SERVICE_BIC,
  MICRO_COTIS_VENTE,
  MICRO_PLAFOND_SERVICE_BNC,
  MICRO_PLAFOND_VENTE,
  VERSEMENT_LIBERATOIRE_BNC,
  VERSEMENT_LIBERATOIRE_SERVICE_BIC,
  VERSEMENT_LIBERATOIRE_SEUIL_RFR,
  VERSEMENT_LIBERATOIRE_VENTE,
} from '../constants';
import { microAcreExoTaux } from '../helpers/acre';
import { computeMarginalImpotRevenu } from '../helpers/impot-revenu';
import { roundTaux, roundToEuros } from '../helpers/money';
import type { ReductionLine, StatusDetail } from '../validation';
import type { StatusCompute } from './types';

/** One micro activity stream: its CA and the four per-stream rates. */
type MicroStream = {
  ca: number;
  abattementTaux: number;
  cotisTaux: number;
  cfpTaux: number;
  vlTaux: number;
};

/** Abattement forfaitaire of one stream, floored at MICRO_ABATTEMENT_MIN, capped at the CA. */
const streamAbattement = (stream: MicroStream): number =>
  Math.min(stream.ca, Math.max(stream.ca * stream.abattementTaux, MICRO_ABATTEMENT_MIN));

export const computeMicro: StatusCompute = (input) => {
  const { profile } = input;
  const cotisTauxBNC = profile.activiteSousType === 'cipav' ? MICRO_COTIS_BNC_CIPAV : MICRO_COTIS_BNC;

  const streams: readonly MicroStream[] = [
    {
      ca: profile.caVente,
      abattementTaux: MICRO_ABATTEMENT_VENTE,
      cotisTaux: MICRO_COTIS_VENTE,
      cfpTaux: MICRO_CFP_VENTE,
      vlTaux: VERSEMENT_LIBERATOIRE_VENTE,
    },
    {
      ca: profile.caServiceBIC,
      abattementTaux: MICRO_ABATTEMENT_SERVICE_BIC,
      cotisTaux: MICRO_COTIS_SERVICE_BIC,
      cfpTaux: MICRO_CFP_SERVICE_BIC,
      vlTaux: VERSEMENT_LIBERATOIRE_SERVICE_BIC,
    },
    {
      ca: profile.caServiceBNC,
      abattementTaux: MICRO_ABATTEMENT_BNC,
      cotisTaux: cotisTauxBNC,
      cfpTaux: MICRO_CFP_BNC,
      vlTaux: VERSEMENT_LIBERATOIRE_BNC,
    },
  ];

  const caTotal = streams.reduce((sum, stream) => sum + stream.ca, 0);

  // Cotisations sociales (assiette = CA per stream), reduced by ACRE on the social part only.
  const acreExoTaux = microAcreExoTaux({ firstYear: profile.firstYear, dateDebutActivite: profile.dateDebutActivite });
  // Gross social cotisations BEFORE ACRE, so the exonération surfaces as its own line.
  const cotisationsSocialesBrutes = streams.reduce((sum, stream) => sum + stream.ca * stream.cotisTaux, 0);
  const acreExoneration = cotisationsSocialesBrutes * acreExoTaux;
  const cotisationsSociales = cotisationsSocialesBrutes - acreExoneration;
  const cfp = streams.reduce((sum, stream) => sum + stream.ca * stream.cfpTaux, 0);
  const cotisations = cotisationsSociales + cfp;

  // Revenu imposable micro = Σ (CA − abattement forfaitaire) per stream.
  const revenuImposable = streams.reduce((sum, stream) => sum + (stream.ca - streamAbattement(stream)), 0);
  const impotBareme = computeMarginalImpotRevenu({
    revenuImposable,
    autresRevenusFoyer: profile.autresRevenusFoyer,
    nbParts: profile.nbParts,
    situationFamiliale: profile.situationFamiliale,
  });

  // Plafond overrun (registry §3): vente cap, services+BNC sub-cap, and the global CA cap.
  const plafondOverrun =
    profile.caVente > MICRO_PLAFOND_VENTE ||
    profile.caServiceBIC + profile.caServiceBNC > MICRO_PLAFOND_SERVICE_BNC ||
    caTotal > MICRO_PLAFOND_VENTE;
  const eligible = !plafondOverrun;

  // Versement libératoire: elected, régime-éligible, and RFR N-2 ≤ seuil × nbParts (CONV-8).
  const vlEligible = profile.versementLiberatoire && eligible && profile.rfrNMoins2 <= VERSEMENT_LIBERATOIRE_SEUIL_RFR * profile.nbParts;
  const impotVL = streams.reduce((sum, stream) => sum + stream.ca * stream.vlTaux, 0);
  const impot = vlEligible ? Math.min(impotVL, impotBareme) : impotBareme;
  const vlApplied = vlEligible && impotVL <= impotBareme;

  // CFE reported separately (CONV-4: commune-dependent, not subtracted from net).
  const cfe = CFE_MONTANT;
  const netDisponible = caTotal - profile.chargesReelles - cotisations - impot - cfe;
  const tauxGlobal = caTotal > 0 ? 1 - netDisponible / caTotal : 0;

  // Full breakdown for the results UI ("afficher TOUT le détail"). The micro abattement is
  // per-stream (71 / 50 / 34 %); we surface the blended EFFECTIVE rate so the % reconciles
  // with base × montant. ACRE (year 1) exonerates the social part only.
  const abattementMicro = caTotal - revenuImposable;
  const reductions: ReductionLine[] = [
    {
      code: 'abattement-micro',
      kind: 'abattement',
      taux: roundTaux(caTotal > 0 ? abattementMicro / caTotal : 0),
      base: roundToEuros(caTotal),
      montant: roundToEuros(abattementMicro),
    },
  ];
  if (acreExoTaux > 0) {
    reductions.push({
      code: 'acre',
      kind: 'exoneration',
      taux: roundTaux(acreExoTaux),
      base: roundToEuros(cotisationsSocialesBrutes),
      montant: roundToEuros(acreExoneration),
    });
  }
  const detail: StatusDetail = {
    caTotal: roundToEuros(caTotal),
    charges: roundToEuros(profile.chargesReelles),
    cotisationsTns: roundToEuros(cotisations),
    revenuImposable: roundToEuros(revenuImposable),
    impotRevenu: roundToEuros(impot),
    cfe: roundToEuros(cfe),
    reductions,
    netDisponible: roundToEuros(netDisponible),
  };

  return {
    status: 'micro-entreprise',
    cotisations: roundToEuros(cotisations),
    impot: roundToEuros(impot),
    netDisponible: roundToEuros(netDisponible),
    tauxGlobal: roundTaux(tauxGlobal),
    assietteSociale: roundToEuros(caTotal),
    revenuImposable: roundToEuros(revenuImposable),
    cfe: roundToEuros(cfe),
    acreApplied: acreExoTaux > 0,
    vlApplied,
    plafondOverrun,
    eligible,
    detail,
  };
};

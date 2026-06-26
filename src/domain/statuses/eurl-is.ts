/**
 * EURL-IS calc — gérant associé unique d'EURL à l'IS. Le gérant majoritaire est TNS
 * art. 62 CGI (PAS assimilé-salarié ⇒ AUCUN abattement 10 % salarié), l'IS frappe le
 * résultat après rémunération et cotisations, les dividendes subissent le PFU mais la
 * fraction > 10 % du capital+CCA bascule en cotisations TNS au lieu des prélèvements
 * sociaux (règle des 10 %). Pure transcription of
 * `.claude/docs/business/calculation/eurl-is.md`.
 *
 * Pipeline (spec §c): B = caTotal − chargesReelles ; R = remunerationChoisie.
 *   1. cotisations TNS sur l'assiette rémunération (abattement 26 % §A.1, cascade §A.3)
 *   2. baseIS = B − R − cotisationsTNS_remu ; IS (deux tranches)
 *   3. dividendesBruts = partDividendes × max(0, baseIS − IS)
 *   4. règle des 10 % : seuil = EURL_IS_SEUIL_DIVIDENDES_COTIS × capitalPlusCCA
 *      → fraction ≤ seuil : prélèvements sociaux PFU ; excès : cotisations TNS
 *   5. 2ᵉ passe TNS sur l'assiette combinée (R + excès) ⇒ cotisationsTNS_dividendes
 *      (marginal, à la charge du gérant, NON déductible de l'IS ⇒ baseIS inchangée)
 *   6. remunerationImposable = R − cotisationsDeductibles_remu ; IR marginal (CONV-2)
 *   7. PFU : IR sur le brut entier, PS sur la seule fraction ≤ seuil (option barème : keep better)
 *   8. CFE (year-1 / CA-floor exempt) ; 9. agrégats & net disponible
 *
 * ACRE-réel (1re année) — tax-social-modeler verdict Q1(b) : le taux dégressif se teste sur le
 * revenu d'activité COMBINÉ (R + excès dividende), PAS sur la rémunération seule (sinon
 * sur-exonération). Ce combiné dépend de baseIS qui dépend des cotisations ACRE-réduites ⇒
 * point fixe en année 1 ; rompu par un prédicteur ACRE-off de l'excès servant UNIQUEMENT au
 * test de bande, puis un eAcre unique propagé aux deux passes (exact dès firstYear=false ou
 * sans excès année 1 — le cas dominant). FLAGGED: l'interaction ACRE × excès-dividende est une
 * simplification du snapshot annuel statique (l'excès art. L131-6 tombe rarement dans la
 * fenêtre ACRE de 12 mois) — item regulatory-watcher.
 *
 * Ledger (partDividendes=1, baseIS>0, cfe=0): cotisations + impot + netDisponible = B.
 * Numbers come only from constants.ts (calc.md §1.2); rounding is boundary-only.
 */
import {
  CFE_CA_SEUIL_EXO,
  CFE_MONTANT,
  EURL_IS_SEUIL_DIVIDENDES_COTIS,
  TNS_ABATTEMENT_ASSIETTE,
  TNS_ABATTEMENT_PLAFOND,
  TNS_ABATTEMENT_PLANCHER,
} from '../constants';
import { acreReelExoTaux } from '../helpers/acre-reel';
import { computeImpotRevenu, computeMarginalImpotRevenu } from '../helpers/impot-revenu';
import { computeImpotSocietes } from '../helpers/is';
import { roundTaux, roundToEuros } from '../helpers/money';
import { clampMontant } from '../helpers/pass';
import { computeDividendesTax } from '../helpers/pfu';
import { computeTnsCotisations, resolveTnsRegime, type TnsCotisationsResult, type TnsRegime } from '../helpers/tns-cotisations';
import type { ReductionLine, StatusDetail, StatusResultIS } from '../validation';
import type { StatusComputeIS } from './types';

/**
 * Abated TNS assiette unique from a brut social (26 % abattement borné [PLANCHER, PLAFOND], §A.1).
 * @param brutSocial the social base before abattement (rémunération or rémunération + dividend excess)
 * @returns the abated assiette to feed the TNS cascade
 */
const assietteUnique = (brutSocial: number): number =>
  brutSocial -
  clampMontant({
    value: TNS_ABATTEMENT_ASSIETTE * brutSocial,
    min: TNS_ABATTEMENT_PLANCHER,
    max: TNS_ABATTEMENT_PLAFOND,
  });

type EurlIsCoreInput = {
  beneficeAvantRemu: number;
  caTotal: number;
  remuneration: number;
  partDividendes: number;
  seuilDividendesCotis: number;
  regime: TnsRegime;
  acreExoTaux: number;
};

type EurlIsCore = {
  cotisRemu: TnsCotisationsResult;
  baseIS: number;
  is: number;
  dividendesBruts: number;
  dividendesSoumisTns: number;
};

/**
 * Steps 1–4 of the EURL-IS pipeline for a GIVEN ACRE rate — shared by the year-1 predictor
 * (acreExoTaux 0) and the final consistent pass, so both derive the dividend split identically.
 * @param input the bénéfice/CA, rémunération, dividend lever, 10 %-seuil, régime, and ACRE rate
 * @returns the rémunération cotisations, baseIS, IS, gross dividend and its >10 % TNS excess
 */
const eurlIsCore = (input: EurlIsCoreInput): EurlIsCore => {
  const assietteRemu0 = assietteUnique(input.remuneration);
  const cotisRemu = computeTnsCotisations({ assietteTNS: assietteRemu0, regime: input.regime, acreExoTaux: input.acreExoTaux });
  const baseIS = input.beneficeAvantRemu - input.remuneration - cotisRemu.cotisationsTotales;
  const is = computeImpotSocietes({ baseIS, caTotal: input.caTotal });
  const resultatApresIS = Math.max(0, baseIS - is);
  const dividendesBruts = input.partDividendes * resultatApresIS;
  const dividendesSoumisTns = Math.max(0, dividendesBruts - input.seuilDividendesCotis);
  return { cotisRemu, baseIS, is, dividendesBruts, dividendesSoumisTns };
};

export const computeEurlIs: StatusComputeIS = (input) => {
  const { profile } = input;
  const caTotal = profile.caVente + profile.caServiceBIC + profile.caServiceBNC;
  const beneficeAvantRemu = caTotal - profile.chargesReelles;
  const remuneration = profile.remunerationChoisie;
  const seuilDividendesCotis = EURL_IS_SEUIL_DIVIDENDES_COTIS * profile.capitalPlusCCA;
  const regime = resolveTnsRegime({
    caVente: profile.caVente,
    caServiceBIC: profile.caServiceBIC,
    caServiceBNC: profile.caServiceBNC,
    activiteSousType: profile.activiteSousType,
  });
  const coreParams = { beneficeAvantRemu, caTotal, remuneration, partDividendes: profile.partDividendes, seuilDividendesCotis, regime };

  // ACRE-réel (1re année) : bande dégressive testée sur l'assiette COMBINÉE abattue (R + excès),
  // l'excès estimé par un prédicteur ACRE-off pour rompre le point fixe (cf. en-tête, verdict Q1b).
  const dividendesSoumisTnsPredictor = profile.firstYear ? eurlIsCore({ ...coreParams, acreExoTaux: 0 }).dividendesSoumisTns : 0;
  const acreExoTaux = profile.firstYear ? acreReelExoTaux(assietteUnique(remuneration + dividendesSoumisTnsPredictor)) : 0;

  // 1–4. Pass consistant : cotisations rémunération (§A.3), IS (§D.2), dividendes bruts et split 10 %.
  const core = eurlIsCore({ ...coreParams, acreExoTaux });
  const { cotisRemu, is, dividendesBruts, dividendesSoumisTns } = core;
  const cotisationsTnsRemu = cotisRemu.cotisationsTotales;

  // 5. 2ᵉ passe TNS sur l'assiette combinée (R + excès) ⇒ cotisations marginales sur l'excès.
  // À la charge du gérant, NON déductibles de l'IS (baseIS déjà figée à l'étape 2).
  const assietteRemuFull = assietteUnique(remuneration + dividendesSoumisTns);
  const cotisFull = computeTnsCotisations({ assietteTNS: assietteRemuFull, regime, acreExoTaux });
  const cotisationsTnsTotal = cotisFull.cotisationsTotales;
  const cotisationsTnsDividendes = cotisationsTnsTotal - cotisationsTnsRemu;

  // 6. Rémunération imposable = R − cotisations déductibles de la rémunération (TNS art. 62, PAS d'abattement 10 %).
  // cotisationsDeductibles = total ACRE-réduit − CSG/CRDS non déduct. (ACRE n'exonère jamais la CSG-CRDS).
  const remunerationImposable = remuneration - cotisRemu.cotisationsDeductibles;
  const impotIrRemu = computeMarginalImpotRevenu({
    revenuImposable: remunerationImposable,
    autresRevenusFoyer: profile.autresRevenusFoyer,
    nbParts: profile.nbParts,
    situationFamiliale: profile.situationFamiliale,
  });

  // 7. PFU : la part IR frappe le dividende brut ENTIER ; les PS la seule fraction ≤ seuil (CONV-3).
  // Option barème : la part IR PFU peut être remplacée par l'IR marginal du dividende abattu (keep the better).
  const divPfuWhole = computeDividendesTax({ dividendesCapital: dividendesBruts, optionBaremeDividendes: false });
  const divBaremeWhole = computeDividendesTax({ dividendesCapital: dividendesBruts, optionBaremeDividendes: true });
  const pfuDivIR = divPfuWhole.flatTaxIR;
  const baremeDivIR =
    computeImpotRevenu({
      revenuImposable: remunerationImposable + divBaremeWhole.baremeImposable,
      autresRevenusFoyer: profile.autresRevenusFoyer,
      nbParts: profile.nbParts,
      situationFamiliale: profile.situationFamiliale,
    }) -
    computeImpotRevenu({
      revenuImposable: remunerationImposable,
      autresRevenusFoyer: profile.autresRevenusFoyer,
      nbParts: profile.nbParts,
      situationFamiliale: profile.situationFamiliale,
    });
  const dividendImpotIR = profile.optionBaremeDividendes ? Math.min(pfuDivIR, baremeDivIR) : pfuDivIR;
  const pfuDivPS = computeDividendesTax({
    dividendesCapital: Math.min(dividendesBruts, seuilDividendesCotis),
    optionBaremeDividendes: false,
  }).prelevementsSociaux;
  const dividendesNets = dividendesBruts - pfuDivPS - dividendImpotIR - cotisationsTnsDividendes;

  // 8. CFE — exonérée la 1re année ou sous le seuil de CA (CONV-4).
  const cfe = profile.firstYear || caTotal <= CFE_CA_SEUIL_EXO ? 0 : CFE_MONTANT;

  // 9. Agrégats (PFU bucketing CONV-3) & net disponible (single-deduction : R apparaît une seule fois).
  const cotisations = cotisationsTnsTotal + pfuDivPS;
  const impot = is + impotIrRemu + dividendImpotIR;
  const netDisponible = remuneration - impotIrRemu + dividendesNets - cfe;
  const tauxGlobal = caTotal > 0 ? 1 - netDisponible / caTotal : 0;

  const remunerationTotale = remuneration + dividendesBruts;
  const remunerationShare = remunerationTotale > 0 ? remuneration / remunerationTotale : 0;

  // Full breakdown for the results UI ("afficher TOUT le détail"). Gérant TNS art. 62: NO 10 %
  // abattement salarié, the 26 % abattement applies to the social assiette ; the >10 % dividend
  // excess bears TNS cotisations instead of PS (règle des 10 %). `remunerationNette` is omitted
  // (TNS rémunération has no salarié-style net) — only its net-après-impôt is meaningful.
  const abattementTnsRemu = remuneration - assietteUnique(remuneration);
  const reductions: ReductionLine[] = [
    {
      code: 'abattement-tns',
      kind: 'abattement',
      taux: roundTaux(remuneration > 0 ? abattementTnsRemu / remuneration : 0),
      base: roundToEuros(remuneration),
      montant: roundToEuros(abattementTnsRemu),
    },
  ];
  if (acreExoTaux > 0) {
    reductions.push({
      code: 'acre',
      kind: 'exoneration',
      taux: roundTaux(acreExoTaux),
      montant: roundToEuros(cotisFull.acreExoneration),
    });
  }
  const detail: StatusDetail = {
    caTotal: roundToEuros(caTotal),
    charges: roundToEuros(profile.chargesReelles),
    beneficeAvantRemu: roundToEuros(beneficeAvantRemu),
    remunerationBrut: roundToEuros(remuneration),
    cotisationsTns: roundToEuros(cotisationsTnsRemu),
    revenuImposable: roundToEuros(remunerationImposable),
    impotRevenu: roundToEuros(impotIrRemu),
    remunerationNetteApresImpot: roundToEuros(remuneration - impotIrRemu),
    baseIS: roundToEuros(core.baseIS),
    is: roundToEuros(is),
    dividendesBruts: roundToEuros(dividendesBruts),
    dividendesPrelevementsSociaux: roundToEuros(pfuDivPS),
    dividendesCotisationsTns: roundToEuros(cotisationsTnsDividendes),
    dividendesImpot: roundToEuros(dividendImpotIR),
    dividendesNets: roundToEuros(dividendesNets),
    cfe: roundToEuros(cfe),
    reductions,
    netDisponible: roundToEuros(netDisponible),
  };

  const result: StatusResultIS = {
    status: 'eurl-is',
    cotisations: roundToEuros(cotisations),
    impot: roundToEuros(impot),
    netDisponible: roundToEuros(netDisponible),
    tauxGlobal: roundTaux(tauxGlobal),
    remuneration: roundToEuros(remuneration),
    dividendes: roundToEuros(dividendesBruts),
    remunerationShare: roundTaux(remunerationShare),
    is: roundToEuros(is),
    dividendesNets: roundToEuros(dividendesNets),
    assietteSociale: roundToEuros(Math.max(0, assietteRemuFull)),
    revenuImposable: roundToEuros(remunerationImposable),
    cfe: roundToEuros(cfe),
    acreApplied: acreExoTaux > 0,
    detail,
  };
  return result;
};

import { Info } from 'lucide-react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { ReductionCode, StatusDetail, StatusResult } from '@/domain/validation';
import { formatEuros, formatPercent } from './format';

/**
 * The per-card full breakdown (spec change #3, request "afficher TOUT le détail"): every line
 * from the chiffre d'affaires down to the net disponible, grouped by stage (Activité,
 * Rémunération, Société/IS, Dividendes, Impôt sur le revenu, Autres impôts & taxes, Abattements
 * & déductions). Each money line shows its annual amount AND its mensualisé figure (annual / 12),
 * and the deduction / abattement lines carry their percentage so the "why" is auditable
 * (calc.md §1.1: every figure is read straight from `result.detail`, the engine output — nothing
 * is recomputed here; the closing line is the engine's `netDisponible`).
 *
 * The engine stays French-copy-free: each reduction line carries a stable English `code` that
 * this component maps to a French label (REDUCTION_LABELS). A status populates only the lines it
 * has (salaried lines for assimilé-salarié, TNS lines for TNS, IS/dividend lines for the IS
 * sociétés), and zero-valued optional lines are hidden so each of the 7 tiles stays scannable.
 *
 * Presentation: the breakdown is collapsed behind a disclosure (same Accordion idiom as the setup
 * path) — progressive disclosure keeps the tile scannable, the full audit one tap away. If a
 * status result predates the `detail` contract, a minimal fallback renders the headline figures.
 */
export type NetBreakdownProps = {
  /** The engine result for this status (figures only — nothing recomputed). */
  result: StatusResult;
  /** Total CA (sum of the three CA inputs) — fallback starting point when `detail` is absent. */
  caTotal: number;
  /** Declared real charges — fallback deduction when `detail` is absent. */
  chargesReelles: number;
};

/** French labels for the engine's stable reduction codes (the engine stays French-copy-free). */
const REDUCTION_LABELS: Record<ReductionCode, string> = {
  'abattement-micro': 'Abattement forfaitaire micro',
  'abattement-tns': 'Abattement forfaitaire (assiette sociale)',
  'abattement-salarie': 'Abattement forfaitaire frais professionnels',
  acre: 'Exonération ACRE',
  'cotisations-deductibles': 'Cotisations déductibles du revenu imposable',
  'frais-gestion': 'Frais de gestion (société de portage)',
};

/**
 * Plain-French explanation per breakdown line — keyed by the stable `line.key` (and reduction
 * `code`, plus the closing `net-disponible`). Lives in the UI layer so the engine stays
 * French-copy-free (calc.md): the figures come from `result.detail`, the words from here. Each
 * string says exactly what the line is, consistent with what the engine actually computes; every
 * quoted rate (8 %, 26 %, 15 %/42 500 €/25 %, 12,8 %, 18,6 %, 40 %, 10 %, 5 000 €) mirrors a
 * `src/domain/constants.ts` value. Rendered through an Info-icon tooltip on each row.
 */
const LINE_EXPLANATIONS: Record<string, string> = {
  ca: "Le total de vos trois chiffres d'affaires saisis (vente, prestations BIC et prestations BNC), hors TVA. C'est le point de départ de tous les calculs.",
  frais:
    "En portage salarial uniquement : la commission prélevée par la société de portage, soit un pourcentage du chiffre d'affaires (environ 8 % par défaut dans le simulateur), soit un montant fixe. Elle est retirée du chiffre d'affaires avant de constituer le salaire.",
  charges:
    "Pour les statuts au réel (EI au réel, EURL-IR, EURL-IS, SASU-IR, SASU-IS), vos charges professionnelles réelles sont déduites du chiffre d'affaires pour obtenir le bénéfice. Ce bénéfice n'est pas encore la base imposable : les cotisations, et selon le statut la rémunération du dirigeant, en sont encore déduites avant l'impôt.",
  'charges-info':
    "En micro-entreprise et en portage salarial, les charges que vous saisissez ne réduisent ni la base de calcul des cotisations ni celle de l'impôt. En micro, un abattement forfaitaire est appliqué à la place de vos charges réelles ; en portage, vos frais professionnels réels sont gérés à part par la société de portage (souvent remboursés) et les frais de gestion sont sa commission, pas un forfait remplaçant vos charges. Elles restent affichées en gris pour la transparence.",
  benef:
    "Le chiffre d'affaires, diminué des charges réelles pour les statuts au réel, avant toute rémunération du dirigeant et avant cotisations.",
  brut: "Rémunération du dirigeant avant déduction des cotisations sociales. En SASU (président assimilé-salarié) comme en portage salarial (salarié à part entière, avec assurance chômage), c'est le salaire brut du bulletin de paie. En EURL à l'IS (gérant majoritaire TNS), c'est la rémunération qui sert d'assiette aux cotisations sociales.",
  'cot-sal':
    'Part des cotisations sociales retenue sur le salaire brut : président de SASU (assimilé-salarié) et salarié porté en portage salarial (salarié à part entière). Elle couvre notamment la retraite et la CSG-CRDS. La rémunération nette correspond au brut moins cette part.',
  'cot-tns':
    "Cotisations sociales du travailleur non salarié (TNS) : micro-entreprise, entreprise individuelle au réel et gérant majoritaire d'EURL. L'assiette diffère selon le régime : en micro-entreprise, elles correspondent à un pourcentage du chiffre d'affaires ; au réel, elles portent sur le bénéfice (ou la rémunération en EURL à l'IS), après un abattement d'assiette de 26 %.",
  net: "Rémunération qui reste après déduction des cotisations sociales, mais avant l'impôt sur le revenu. L'impôt sur le revenu est calculé ensuite.",
  'cot-pat':
    "Part des cotisations sociales payée par la société en plus du salaire brut : président de SASU (assimilé-salarié) et salarié porté (salarié à part entière). Elle n'entre pas dans la rémunération nette mais augmente le coût total. En portage salarial, elle est prélevée par la société de portage sur le chiffre d'affaires, après déduction des frais de gestion.",
  'cout-emp':
    "Salaire brut plus cotisations patronales : c'est le coût total de la rémunération en statut salarié ou assimilé-salarié — président de SASU (assimilé-salarié) et salarié porté (salarié à part entière). En SASU, c'est le coût pour la société ; en portage salarial, ce coût est financé par le chiffre d'affaires du consultant, après frais de gestion.",
  'base-is':
    "Bénéfice de la société une fois la rémunération du dirigeant et ses cotisations sociales déduites. C'est sur ce montant qu'est calculé l'impôt sur les sociétés.",
  is: "Impôt payé par la société sur son bénéfice. Le taux réduit de 15 % s'applique jusqu'à 42 500 € de bénéfice ; au-delà, le taux normal de 25 % s'applique.",
  'div-brut':
    "Part du résultat distribuée après paiement de l'impôt sur les sociétés, avant tout prélèvement. Son montant dépend de la répartition choisie entre rémunération et dividendes.",
  'div-ps':
    'Prélèvements sociaux (CSG, CRDS et prélèvement de solidarité) appliqués aux dividendes dans le cadre du prélèvement forfaitaire unique (PFU), au taux global de 18,6 %. En EURL-IS, ils ne portent que sur la fraction des dividendes non soumise aux cotisations TNS.',
  'div-tns':
    "En EURL-IS, le gérant majoritaire relève du régime des travailleurs non salariés (TNS) : la fraction des dividendes supérieure à 10 % du capital social, des primes et des comptes courants d'associés est soumise aux cotisations TNS. Cette ligne n'existe pas en SASU-IS, où le président est assimilé-salarié.",
  'div-ir':
    "Imposition des dividendes au titre de l'impôt sur le revenu. Par défaut, le prélèvement forfaitaire unique (PFU) s'applique au taux de 12,8 %. Sur option globale au barème progressif (avec abattement de 40 %), le simulateur retient le plus avantageux des deux calculs.",
  'div-net':
    "Montant des dividendes qui reste une fois déduits les prélèvements sociaux et l'impôt sur le revenu. En EURL-IS, les cotisations TNS éventuelles sont aussi retranchées.",
  'rev-imp':
    "Le revenu net retenu comme base de l'impôt sur le revenu du foyer. Il dépend du statut : en micro-entreprise, c'est le chiffre d'affaires diminué d'un abattement forfaitaire ; au réel (EI, EURL à l'IR), c'est le bénéfice, soit le chiffre d'affaires moins les charges réelles déductibles, dont les cotisations sociales obligatoires.",
  ir: "L'impôt sur le revenu du foyer calculé sur ce revenu imposable, au barème progressif par tranches. Il tient compte du nombre de parts du foyer (quotient familial) et des autres revenus déclarés.",
  'net-ai':
    "La rémunération nette une fois déduit l'impôt sur le revenu qui s'y rapporte. C'est ce qu'il reste de la rémunération, après cotisations puis impôt.",
  cfe: "Impôt local annuel dû par la quasi-totalité des entreprises. Son montant est fixé par la commune : il n'existe pas de tarif national unique. En général, aucune CFE la 1re année d'activité, et exonération en dessous de 5 000 € de chiffre d'affaires.",
  'net-disponible':
    "Ce qui reste réellement en poche après avoir retiré toutes les charges, les cotisations sociales et les impôts. C'est le montant utilisé pour classer et comparer les 7 statuts. Il s'agit d'une estimation.",
  'abattement-micro':
    "En micro-entreprise, l'administration retire du chiffre d'affaires un pourcentage forfaitaire censé couvrir vos frais : 71 % pour la vente, 50 % pour les services BIC, 34 % pour le BNC. Ce qui reste forme le revenu imposable. Aucune charge réelle ne vient s'ajouter à cet abattement.",
  'abattement-tns':
    "Pour un travailleur non salarié (TNS) au réel, les cotisations sociales ne portent pas sur la totalité du revenu d'activité : un abattement forfaitaire de 26 % en est d'abord retiré, dans la limite d'un plancher et d'un plafond. C'est cette assiette réduite qui sert de base au calcul des cotisations. Cet abattement concerne l'assiette sociale, pas le revenu soumis à l'impôt.",
  'abattement-salarie':
    "Pour un dirigeant assimilé salarié (SASU à l'IS) ou un salarié porté, 10 % du salaire imposable sont retirés au titre des frais professionnels, dans la limite d'un plancher et d'un plafond. Le revenu soumis à l'impôt sur le revenu est diminué d'autant.",
  acre: "L'ACRE est une exonération partielle des cotisations sociales en début d'activité, sous conditions. Dans le simulateur, elle s'applique la première année et réduit une partie des cotisations dues.",
  'cotisations-deductibles':
    "Au réel, les cotisations sociales obligatoires viennent en déduction du revenu soumis à l'impôt sur le revenu. Seule la part réellement déductible est retirée : la fraction non déductible (CSG-CRDS non déductible) reste, elle, dans le revenu imposable.",
};

/**
 * Visual role of a breakdown line.
 * - `neutral`: a structural amount (CA, brut, dividendes bruts…).
 * - `deduction`: a euro amount taken off (rendered with a leading −, muted).
 * - `total`: a stage subtotal (bénéfice, rémunération nette…) — emphasised, top rule.
 * - `context`: employer-side / non-deducted info (patronales, coût employeur) — small, muted.
 * - `reduction`: a fiscal advantage reducing a taxable base — tinted, % to the fore.
 */
type LineKind = 'neutral' | 'deduction' | 'total' | 'context' | 'reduction';

type BreakdownLine = {
  /** Stable React key. */
  key: string;
  label: string;
  /** Annual euros (the row mensualises by /12). */
  amount: number;
  kind: LineKind;
  /** 0–1 ratio shown as a chip (effective abattement rate, or share of CA for a deduction). */
  pct?: number;
};

type BreakdownGroup = { title: string; lines: BreakdownLine[] };

/**
 * Share of CA for a deduction line — presentation-only ratio. The zero-CA branch returns 0 but is
 * unreachable for a rendered line: with CA at 0 every CA-derived amount is 0 too and `isShown`
 * filters it out, so no chip is ever produced from the degenerate case.
 */
const partDuCa = (amount: number, caTotal: number): number => (caTotal > 0 ? amount / caTotal : 0);

/** Present and non-zero (negatives kept — a loss-making bénéfice is meaningful). */
const isShown = (value: number | undefined): value is number => value !== undefined && value !== 0;

/**
 * Builds the grouped breakdown from the engine `detail`. Pure: only reads the detail object,
 * pushes a line per present non-zero field, and maps reduction codes to French labels.
 * @param detail the engine's full per-status breakdown
 * @returns the ordered, non-empty groups to render
 */
const buildGroups = (detail: StatusDetail): BreakdownGroup[] => {
  const ca = detail.caTotal;
  const groups: BreakdownGroup[] = [];

  // --- Activité : CA → (frais de gestion | charges) → bénéfice avant rémunération ---
  const activite: BreakdownLine[] = [{ key: 'ca', label: "Chiffre d'affaires HT", amount: ca, kind: 'neutral' }];
  if (isShown(detail.fraisGestion)) {
    activite.push({
      key: 'frais',
      label: 'Frais de gestion',
      amount: detail.fraisGestion,
      kind: 'deduction',
      pct: partDuCa(detail.fraisGestion, ca),
    });
  }
  if (detail.beneficeAvantRemu !== undefined) {
    if (detail.charges > 0) {
      activite.push({
        key: 'charges',
        label: 'Charges déductibles',
        amount: detail.charges,
        kind: 'deduction',
        pct: partDuCa(detail.charges, ca),
      });
    }
    activite.push({ key: 'benef', label: 'Bénéfice avant rémunération', amount: detail.beneficeAvantRemu, kind: 'total' });
  } else if (detail.charges > 0) {
    // micro / portage: real charges are NOT deducted (abattement / frais de gestion instead).
    // Show them honestly so a user who entered charges sees they were not applied here.
    activite.push({ key: 'charges-info', label: 'Charges réelles (non déduites)', amount: detail.charges, kind: 'context' });
  }
  groups.push({ title: 'Activité', lines: activite });

  // --- Rémunération : brut → cotisations → net ; employer-side cost as context ---
  const remuneration: BreakdownLine[] = [];
  if (isShown(detail.remunerationBrut))
    remuneration.push({ key: 'brut', label: 'Rémunération brute', amount: detail.remunerationBrut, kind: 'neutral' });
  if (isShown(detail.cotisationsSalariales)) {
    remuneration.push({
      key: 'cot-sal',
      label: 'Cotisations salariales',
      amount: detail.cotisationsSalariales,
      kind: 'deduction',
      pct: partDuCa(detail.cotisationsSalariales, ca),
    });
  }
  if (isShown(detail.cotisationsTns)) {
    remuneration.push({
      key: 'cot-tns',
      label: 'Cotisations sociales (TNS)',
      amount: detail.cotisationsTns,
      kind: 'deduction',
      pct: partDuCa(detail.cotisationsTns, ca),
    });
  }
  if (isShown(detail.remunerationNette))
    remuneration.push({ key: 'net', label: 'Rémunération nette', amount: detail.remunerationNette, kind: 'total' });
  if (isShown(detail.cotisationsPatronales)) {
    remuneration.push({
      key: 'cot-pat',
      label: 'Cotisations patronales (employeur)',
      amount: detail.cotisationsPatronales,
      kind: 'context',
      pct: partDuCa(detail.cotisationsPatronales, ca),
    });
  }
  if (isShown(detail.coutTotalEmployeur))
    remuneration.push({
      key: 'cout-emp',
      label: 'Coût total employeur (brut + patronales)',
      amount: detail.coutTotalEmployeur,
      kind: 'context',
    });
  if (remuneration.length > 0) {
    const hasSalaire = detail.remunerationBrut !== undefined || detail.remunerationNette !== undefined;
    groups.push({ title: hasSalaire ? 'Rémunération' : 'Cotisations sociales', lines: remuneration });
  }

  // --- Société (IS) : base imposable → IS ---
  const societe: BreakdownLine[] = [];
  if (isShown(detail.baseIS)) societe.push({ key: 'base-is', label: 'Base imposable (IS)', amount: detail.baseIS, kind: 'neutral' });
  if (isShown(detail.is))
    societe.push({ key: 'is', label: 'Impôt sur les sociétés', amount: detail.is, kind: 'deduction', pct: partDuCa(detail.is, ca) });
  if (societe.length > 0) groups.push({ title: 'Société (IS)', lines: societe });

  // --- Dividendes : bruts → PS → cotisations TNS → impôt → nets (only when distributed) ---
  if ((detail.dividendesBruts ?? 0) > 0) {
    const dividendes: BreakdownLine[] = [
      { key: 'div-brut', label: 'Dividendes bruts', amount: detail.dividendesBruts ?? 0, kind: 'neutral' },
    ];
    if (isShown(detail.dividendesPrelevementsSociaux)) {
      dividendes.push({
        key: 'div-ps',
        label: 'Prélèvements sociaux',
        amount: detail.dividendesPrelevementsSociaux,
        kind: 'deduction',
        pct: partDuCa(detail.dividendesPrelevementsSociaux, ca),
      });
    }
    if (isShown(detail.dividendesCotisationsTns)) {
      dividendes.push({
        key: 'div-tns',
        label: 'Cotisations sociales (TNS) sur dividendes',
        amount: detail.dividendesCotisationsTns,
        kind: 'deduction',
        pct: partDuCa(detail.dividendesCotisationsTns, ca),
      });
    }
    if (isShown(detail.dividendesImpot)) {
      dividendes.push({
        key: 'div-ir',
        label: 'Impôt sur les dividendes',
        amount: detail.dividendesImpot,
        kind: 'deduction',
        pct: partDuCa(detail.dividendesImpot, ca),
      });
    }
    if (isShown(detail.dividendesNets))
      dividendes.push({ key: 'div-net', label: 'Dividendes nets', amount: detail.dividendesNets, kind: 'total' });
    groups.push({ title: 'Dividendes', lines: dividendes });
  }

  // --- Impôt sur le revenu : revenu imposable → IR → rémunération nette après impôt ---
  const impotRevenu: BreakdownLine[] = [];
  if (isShown(detail.revenuImposable))
    impotRevenu.push({ key: 'rev-imp', label: 'Revenu imposable', amount: detail.revenuImposable, kind: 'neutral' });
  if (isShown(detail.impotRevenu))
    impotRevenu.push({
      key: 'ir',
      label: 'Impôt sur le revenu',
      amount: detail.impotRevenu,
      kind: 'deduction',
      pct: partDuCa(detail.impotRevenu, ca),
    });
  if (isShown(detail.remunerationNetteApresImpot))
    impotRevenu.push({ key: 'net-ai', label: 'Rémunération nette après impôt', amount: detail.remunerationNetteApresImpot, kind: 'total' });
  if (impotRevenu.length > 0) groups.push({ title: 'Impôt sur le revenu', lines: impotRevenu });

  // --- Autres impôts & taxes : CFE (frais de gestion already shown under Activité) ---
  if (isShown(detail.cfe)) {
    groups.push({
      title: 'Autres impôts & taxes',
      lines: [
        {
          key: 'cfe',
          label: 'CFE (cotisation foncière des entreprises)',
          amount: detail.cfe,
          kind: 'deduction',
          pct: partDuCa(detail.cfe, ca),
        },
      ],
    });
  }

  // --- Abattements & déductions : the fiscal advantages, each with its rate ---
  const reductions = detail.reductions.filter((line) => line.code !== 'frais-gestion' && line.montant !== 0);
  if (reductions.length > 0) {
    groups.push({
      title: 'Abattements & déductions',
      lines: reductions.map((line) => ({
        key: line.code,
        label: REDUCTION_LABELS[line.code],
        amount: line.montant,
        kind: 'reduction',
        ...(line.taux !== undefined ? { pct: line.taux } : {}),
      })),
    });
  }

  return groups;
};

const LINE_LABEL_CLASS: Record<LineKind, string> = {
  neutral: 'text-muted-foreground',
  deduction: 'text-muted-foreground',
  total: 'font-medium text-foreground',
  context: 'text-xs text-muted-foreground',
  reduction: 'text-foreground',
};

const LINE_AMOUNT_CLASS: Record<LineKind, string> = {
  neutral: 'text-foreground',
  deduction: 'text-muted-foreground',
  total: 'font-semibold text-foreground',
  context: 'text-xs text-muted-foreground',
  reduction: 'text-positive',
};

/**
 * Info-icon tooltip explaining what a breakdown line is. The trigger is a real focusable `<button>`
 * (via `asChild`) so the same primitive covers hover, keyboard focus, and mobile tap (tooltip.tsx
 * §trigger). The icon is decorative; the `<button>`'s aria-label carries the line name for AT.
 */
const InfoTooltip = ({ label, explanation }: { label: string; explanation: string }) => (
  <Tooltip>
    <TooltipTrigger asChild>
      <button
        type="button"
        className="inline-flex size-5 shrink-0 items-center justify-center rounded-full text-muted-foreground"
        aria-label={`Explication : ${label}`}
      >
        <Info className="size-3.5" aria-hidden="true" />
      </button>
    </TooltipTrigger>
    <TooltipContent>{explanation}</TooltipContent>
  </Tooltip>
);

const Row = ({ line }: { line: BreakdownLine }) => {
  const sign = line.kind === 'deduction' ? '−' : '';
  const explanation = LINE_EXPLANATIONS[line.key];
  return (
    <div className="grid grid-cols-[1fr_auto_auto] items-baseline gap-x-3 py-0.5">
      <dt className={`flex flex-wrap items-baseline gap-x-1.5 ${LINE_LABEL_CLASS[line.kind]}`}>
        <span>{line.label}</span>
        {line.pct !== undefined ? (
          <span className="rounded bg-muted px-1 py-px text-[10px] font-medium tabular-nums text-muted-foreground">
            {formatPercent(line.pct)}
          </span>
        ) : null}
        {explanation !== undefined ? <InfoTooltip label={line.label} explanation={explanation} /> : null}
      </dt>
      <dd className={`font-mono text-sm tabular-nums ${LINE_AMOUNT_CLASS[line.kind]}`}>
        {sign}
        {formatEuros(line.amount)}
      </dd>
      <dd className="font-mono text-xs tabular-nums text-muted-foreground">
        {sign}
        {formatEuros(line.amount / 12)}
      </dd>
    </div>
  );
};

const NetBreakdown = ({ result, caTotal, chargesReelles }: NetBreakdownProps) => {
  const { detail } = result;
  const groups = detail ? buildGroups(detail) : [];
  const netDisponible = detail?.netDisponible ?? result.netDisponible;

  return (
    <Accordion type="single" collapsible className="w-full">
      <AccordionItem value="breakdown">
        <AccordionTrigger className="text-sm font-medium">Voir le détail complet du calcul</AccordionTrigger>
        <AccordionContent>
          {detail ? (
            <div className="space-y-3">
              <div className="grid grid-cols-[1fr_auto_auto] gap-x-3 border-b border-border pb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                <span aria-hidden="true" />
                <span className="text-right">Par an</span>
                <span className="text-right">Par mois</span>
              </div>
              {groups.map((group) => (
                <dl key={group.title} className="text-sm">
                  <p className="mb-0.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{group.title}</p>
                  {group.lines.map((line) => (
                    <Row key={line.key} line={line} />
                  ))}
                </dl>
              ))}
              <dl className="text-sm">
                <div className="grid grid-cols-[1fr_auto_auto] items-baseline gap-x-3 border-t border-border pt-2">
                  <dt className="flex flex-wrap items-baseline gap-x-1.5 font-semibold text-foreground">
                    <span>Net disponible</span>
                    <InfoTooltip label="Net disponible" explanation={LINE_EXPLANATIONS['net-disponible'] ?? ''} />
                  </dt>
                  <dd className="font-mono text-sm font-semibold tabular-nums text-foreground">{formatEuros(netDisponible)}</dd>
                  <dd className="font-mono text-xs font-semibold tabular-nums text-muted-foreground">{formatEuros(netDisponible / 12)}</dd>
                </div>
              </dl>
            </div>
          ) : (
            <dl className="space-y-1 text-sm">
              <div className="flex items-center justify-between gap-2">
                <dt className="text-muted-foreground">Chiffre d'affaires</dt>
                <dd className="font-mono tabular-nums">{formatEuros(caTotal)}</dd>
              </div>
              {chargesReelles > 0 ? (
                <div className="flex items-center justify-between gap-2">
                  <dt className="text-muted-foreground">− Charges réelles</dt>
                  <dd className="font-mono tabular-nums text-muted-foreground">−{formatEuros(chargesReelles)}</dd>
                </div>
              ) : null}
              <div className="flex items-center justify-between gap-2">
                <dt className="text-muted-foreground">− Cotisations sociales</dt>
                <dd className="font-mono tabular-nums text-muted-foreground">−{formatEuros(result.cotisations)}</dd>
              </div>
              {result.impot > 0 ? (
                <div className="flex items-center justify-between gap-2">
                  <dt className="text-muted-foreground">− Impôts</dt>
                  <dd className="font-mono tabular-nums text-muted-foreground">−{formatEuros(result.impot)}</dd>
                </div>
              ) : null}
              <div className="flex items-center justify-between gap-2 border-t border-border pt-1.5">
                <dt className="font-medium">Net disponible</dt>
                <dd className="font-mono font-semibold tabular-nums">{formatEuros(netDisponible)}</dd>
              </div>
            </dl>
          )}
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
};

export default NetBreakdown;

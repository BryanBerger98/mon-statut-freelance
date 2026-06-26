import { AlertTriangle, Check, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { formatEuros, formatEurosPerMonth, formatSignedEuros, formatSignedEurosPerMonth } from './format';
import type { RecommendationView } from './ranking';
import { STATUS_META } from './status-meta';

/**
 * The argued recommendation (product-spec §C.2, spec change #5): a scannable winner card —
 * the recommended status, its yearly net promoted to a big mono figure, the euro gap (or the
 * "best net but priorities win" caveat), the strengths as a checked list, the single weakness,
 * and a link to the calculation hypotheses. Every figure comes from `RecommendationView` and
 * the panel-derived euro gap — nothing is recomputed here (calc.md §1.1).
 */
export type RecommendationProps = {
  /** The structured recommendation pieces from `buildRecommendationView`. */
  view: RecommendationView;
  /** Label of the best-net status (named when it differs from the recommendation). */
  bestNetLabel: string;
  /** Whether the recommended status is also the best-net one. */
  bestNetIsRecommended: boolean;
  /** Best-net minus runner-up net — the lead the winner holds (only shown when positive). */
  leadGapAnnual: number;
  /** Runner-up status label — named in the lead sentence. */
  secondLabel: string | undefined;
};

const Recommendation = ({ view, bestNetLabel, bestNetIsRecommended, leadGapAnnual, secondLabel }: RecommendationProps) => {
  const label = STATUS_META[view.status].label;
  const showLead = bestNetIsRecommended && leadGapAnnual > 0 && secondLabel != null;

  return (
    <Card variant="winner">
      <CardHeader>
        <CardTitle asChild variant="section">
          <h2>Notre recommandation : {label}</h2>
        </CardTitle>
        <CardDescription>D'après vos priorités — vous avez classé «&nbsp;{view.topPriorityLabel}&nbsp;» en tête.</CardDescription>
      </CardHeader>
      {/* Cap line length at ~60ch (spec §4.4): the widened container must not stretch
          the recommendation prose past the 45-75ch readable band. */}
      <CardContent className="max-w-[60ch] space-y-4">
        <div className="space-y-1">
          <p className="font-mono text-3xl font-semibold tabular-nums">{formatEuros(view.netAnnual)}</p>
          <p className="text-sm text-muted-foreground">net disponible par an · {formatEurosPerMonth(view.netAnnual)}</p>
          {showLead ? (
            <p className="flex flex-wrap items-center gap-x-1.5 text-sm font-medium text-positive">
              <TrendingUp className="size-4 shrink-0" aria-hidden="true" />
              <span className="font-mono tabular-nums">
                {formatSignedEuros(leadGapAnnual)}/an · {formatSignedEurosPerMonth(leadGapAnnual)}
              </span>
              <span className="font-normal text-muted-foreground">de plus que {secondLabel}</span>
            </p>
          ) : !bestNetIsRecommended ? (
            <p className="text-sm text-muted-foreground">
              {bestNetLabel} affiche le revenu net le plus élevé, mais {label} l'emporte selon vos priorités.
            </p>
          ) : null}
        </div>

        {view.strengths.length > 0 ? (
          <div className="space-y-1.5">
            <p className="text-sm font-medium">Pourquoi ce statut</p>
            <ul className="space-y-1 text-sm">
              {view.strengths.map((strength) => (
                <li key={strength} className="flex items-start gap-2">
                  <Check className="mt-0.5 size-4 shrink-0 text-positive" aria-hidden="true" />
                  <span>{strength}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="space-y-1.5">
          <p className="text-sm font-medium">Point d'attention</p>
          <p className="flex items-start gap-2 text-sm text-muted-foreground">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-attention" aria-hidden="true" />
            <span>{view.weakness}</span>
          </p>
        </div>

        <a href="#hypotheses" className="inline-block text-sm font-medium text-primary underline-offset-4 hover:underline">
          Voir les hypothèses de calcul
        </a>
      </CardContent>
    </Card>
  );
};

export default Recommendation;

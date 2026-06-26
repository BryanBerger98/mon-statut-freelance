import { AlertTriangle } from 'lucide-react';
import type { RankingResult } from '@/domain/scoring';
import AssumptionsPanel from './assumptions-panel';
import Disclaimer from './disclaimer';
import type { Draft } from './draft';
import EvolutionPanel from './evolution-panel';
import { buildRecommendationView } from './ranking';
import RankingCard from './ranking-card';
import Recommendation from './recommendation';
import { STATUS_META } from './status-meta';
import SwitchPanel from './switch-panel';

/**
 * The results column (product-spec §C–§E): argued recommendation, the ranked tiles,
 * the calculation hypotheses, the switch cost/benefit (when a current status is set),
 * and the evolution sandbox — closed by the single mandatory disclaimer for the
 * surface. Every figure comes from the engine via `ranking`; nothing is recomputed.
 */
export type ResultsPanelProps = {
  /** The full ranking outcome for the live draft. */
  ranking: RankingResult;
  /** The originating questionnaire draft. */
  draft: Draft;
};

const ResultsPanel = ({ ranking, draft }: ResultsPanelProps) => {
  const recommendationView = buildRecommendationView({ ranking, draft });

  // `ranked` is sorted by composite SCORE, so the best NET may not be ranked[0].
  // Derive the euro axis (écart-mètre max + runner-up) from a net-descending sort.
  const caTotal = draft.caVente + draft.caServiceBIC + draft.caServiceBNC;
  const byNetDesc = [...ranking.ranked].sort((a, b) => b.result.netDisponible - a.result.netDisponible);
  const best = byNetDesc[0];
  const second = byNetDesc[1];
  const netMax = best?.result.netDisponible ?? 0;
  const secondNet = second?.result.netDisponible ?? netMax;
  const secondLabel = second ? STATUS_META[second.status].label : undefined;
  const bestNetLabel = best ? STATUS_META[best.status].label : '';
  const bestNetIsRecommended = best != null && best.status === recommendationView?.status;
  const leadGapAnnual = netMax - secondNet;

  return (
    <div className="space-y-8">
      {ranking.nonViable ? (
        <div className="flex items-start gap-3 rounded-lg border border-destructive/50 bg-destructive/5 p-4 text-sm">
          <AlertTriangle className="mt-0.5 size-5 shrink-0 text-destructive" />
          <div className="space-y-1">
            <p className="font-semibold text-destructive">Aucun statut viable avec ces chiffres</p>
            <p className="text-muted-foreground">
              Avec le chiffre d'affaires et les charges saisis, tous les statuts aboutissent à un revenu disponible nul ou négatif. Vérifiez
              vos montants : un chiffre d'affaires trop faible face aux charges rend l'activité non rentable, quel que soit le statut.
            </p>
          </div>
        </div>
      ) : /* The recommendation verdict scrolls with the page — it is deliberately NOT pinned.
            On mobile the only sticky element is `MobileSummaryBar` (the CA/charges recap above
            the form); pinning the verdict too would stack two competing sticky bars and eat the
            viewport (spec §7 risk #3 — double-sticky). The verdict leads the column, so it is
            already above the fold once results render. */
      recommendationView ? (
        <Recommendation
          view={recommendationView}
          bestNetLabel={bestNetLabel}
          bestNetIsRecommended={bestNetIsRecommended}
          leadGapAnnual={leadGapAnnual}
          secondLabel={secondLabel}
        />
      ) : null}

      {/* #18: mobile-only quick-jump — skip the long card list to the hypotheses and the
          what-if sandbox at the bottom of the column (both anchors live on `lg` too, but the
          desktop column is short/sticky so the nav is hidden there to keep the verdict clean). */}
      <nav aria-label="Accès rapide aux sections" className="flex flex-wrap gap-2 lg:hidden">
        <a
          href="#hypotheses"
          className="glass-pill rounded-full px-3 py-1.5 text-sm font-medium text-primary underline-offset-4 hover:underline"
        >
          Hypothèses de calcul
        </a>
        <a
          href="#evolution"
          className="glass-pill rounded-full px-3 py-1.5 text-sm font-medium text-primary underline-offset-4 hover:underline"
        >
          Simuler une évolution
        </a>
      </nav>

      <section className="space-y-4">
        <h2 className="font-heading text-lg font-semibold text-foreground">Classement des 7 statuts</h2>
        {ranking.ranked.map((scored) => (
          <RankingCard
            key={scored.status}
            scored={scored}
            isCurrent={scored.status === draft.statutActuel}
            caTotal={caTotal}
            chargesReelles={draft.chargesReelles}
            netMax={netMax}
            secondNet={secondNet}
            secondLabel={secondLabel}
          />
        ))}
      </section>

      <AssumptionsPanel draft={draft} />

      {draft.statutActuel === 'aucun' ? null : <SwitchPanel ranking={ranking} draft={draft} />}

      <EvolutionPanel baseline={draft} />

      <Disclaimer />
    </div>
  );
};

export default ResultsPanel;

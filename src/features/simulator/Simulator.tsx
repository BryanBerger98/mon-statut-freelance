import { ArrowUp, Calculator, Loader2 } from 'lucide-react';
import { useDeferredValue, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import type { RankingResult } from '@/domain/scoring';
import { useUrlParam } from '@/lib/use-url-param';
import { cn } from '@/lib/utils';
import { DEFAULT_DRAFT, DRAFT_PARAM_KEY, type Draft, draftCodec, hasRankableInput } from './draft';
import MobileSummaryBar from './mobile-summary-bar';
import QuestionnaireForm from './questionnaire-form';
import { rankFromDraft } from './ranking';
import ResultsPanel from './results-panel';

/**
 * Simulator — the single interactive React 19 island (the ONLY component that
 * hydrates, `client:idle`). It owns the questionnaire draft, mirrored to one URL
 * search param so a simulation is shareable and refresh-safe (components.md §1.4),
 * and drives the live ranking.
 *
 * Architecture: the pure calc engine (`src/domain`) is imported directly and bundled
 * at build, so there is NO data fetching here (react.md §1.1) — the draft flows
 * straight through `rankFromDraft`. The heavy recompute (7 statuses × IS rémunération
 * sweep) runs against a deferred draft so typing stays responsive (hooks.md §2.5).
 */

/** Result of a ranking attempt — a discriminated union so the error path is explicit. */
type ComputeOutcome = { ranking: RankingResult; error: null } | { ranking: null; error: string };

/**
 * Ranks a draft, converting any engine failure into a displayable message instead of
 * crashing the island (react.md §1.5 — never a silent catch).
 * @param draft the questionnaire draft to rank
 * @returns the ranking, or an error message
 */
const computeOutcome = (draft: Draft): ComputeOutcome => {
  try {
    return { ranking: rankFromDraft(draft), error: null };
  } catch (error: unknown) {
    return { ranking: null, error: error instanceof Error ? error.message : 'Erreur de calcul inattendue.' };
  }
};

const Simulator = () => {
  const [draft, setDraft] = useUrlParam<Draft>({ key: DRAFT_PARAM_KEY, defaultValue: DEFAULT_DRAFT, codec: draftCodec });
  // Defer the expensive recompute: the form (driven by the live draft) stays snappy
  // while the ranking catches up against the deferred value.
  const deferredDraft = useDeferredValue(draft);
  const isStale = deferredDraft !== draft;

  // Mobile-only editing toggle. When a ranking exists on a narrow viewport the form
  // condenses behind a sticky summary bar so the verdict leads above the fold
  // (spec change #1); on `lg` both columns show at once, so this flag is inert there.
  // It starts `false` so a pre-filled URL opens straight on the verdict, and flips to
  // `true` on the first manual edit (see `handleDraftChange`) so typing never collapses
  // the form mid-input — the auto-condense only ever fires for URL-loaded simulations.
  const [isEditingMobile, setIsEditingMobile] = useState(false);

  // Any manual edit means the user is filling the form, so keep it open on mobile.
  // Distinguishes manual typing from a programmatic URL load (which never calls this),
  // which is what lets a shared simulation still open on the verdict.
  const handleDraftChange = (next: Draft) => {
    setIsEditingMobile(true);
    setDraft(next);
  };

  const rankable = hasRankableInput(deferredDraft);
  const outcome = rankable ? computeOutcome(deferredDraft) : null;
  const hasResults = outcome !== null && outcome.error === null;

  // Mobile order swap via visibility (not `order-*`): once results exist the form
  // hides until "Modifier" and the ranking takes its place; `lg:block` always wins,
  // keeping the two-column desktop layout intact and CLS-free.
  const formHiddenOnMobile = hasResults && !isEditingMobile;
  const resultsHiddenOnMobile = hasResults && isEditingMobile;
  const caTotal = deferredDraft.caVente + deferredDraft.caServiceBIC + deferredDraft.caServiceBNC;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(360px,420px)_1fr] lg:gap-10">
      {formHiddenOnMobile ? (
        <MobileSummaryBar
          caTotal={caTotal}
          chargesReelles={deferredDraft.chargesReelles}
          situationFamiliale={deferredDraft.situationFamiliale}
          onEdit={() => setIsEditingMobile(true)}
          className="lg:hidden"
        />
      ) : null}

      <div className={cn('lg:sticky lg:top-24 lg:self-start', formHiddenOnMobile ? 'hidden lg:block' : 'block')}>
        {hasResults && isEditingMobile ? (
          <Button type="button" variant="outline" onClick={() => setIsEditingMobile(false)} className="mb-4 w-full lg:hidden">
            <ArrowUp />
            Voir le classement
          </Button>
        ) : null}
        <QuestionnaireForm draft={draft} onChange={handleDraftChange} />
      </div>

      <div className={cn('relative', resultsHiddenOnMobile ? 'hidden lg:block' : 'block')}>
        {isStale && hasResults ? (
          <div
            role="status"
            className="glass-pill pointer-events-none absolute right-2 top-2 z-10 flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium text-muted-foreground"
          >
            <Loader2 className="size-3.5 animate-spin text-primary motion-reduce:animate-none" aria-hidden="true" />
            Recalcul…
          </div>
        ) : null}
        <div className={cn('transition-opacity motion-reduce:transition-none', isStale && 'opacity-60')}>
          {outcome === null ? (
            <Card>
              <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
                <Calculator className="size-6 text-muted-foreground" />
                <p className="text-base font-medium">Renseignez votre chiffre d'affaires</p>
                <p className="max-w-sm text-sm text-muted-foreground">
                  Saisissez au moins un montant de chiffre d'affaires pour comparer les 7 statuts et voir votre revenu net classé.
                </p>
              </CardContent>
            </Card>
          ) : outcome.error !== null ? (
            <Card>
              <CardContent className="space-y-2 py-12 text-center">
                <p className="text-base font-medium text-destructive">Le calcul n'a pas pu aboutir</p>
                <p className="text-sm text-muted-foreground">
                  Vérifiez les valeurs saisies, puis réessayez. Si le problème persiste, certains montants sont peut-être incohérents.
                </p>
              </CardContent>
            </Card>
          ) : (
            <ResultsPanel ranking={outcome.ranking} draft={deferredDraft} />
          )}
        </div>
      </div>
    </div>
  );
};

export default Simulator;

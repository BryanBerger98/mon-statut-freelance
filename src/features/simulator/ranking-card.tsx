import { AlertTriangle, Check, Info, Minus, TrendingDown, TrendingUp } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { ScoredStatus } from '@/domain/scoring';
import { formatEuros, formatEurosPerMonth, formatScore, formatSignedEuros, formatSignedEurosPerMonth } from './format';
import GapMeter from './gap-meter';
import NetBreakdown from './net-breakdown';
import { reasonChipsFor } from './ranking';
import SetupPath from './setup-path';
import { STATUS_META } from './status-meta';

/**
 * One ranked-status tile (product-spec §C.1, spec changes #3/#4): rank, the status name,
 * its big net disponible, the signed euro gap promoted to first level, the écart-mètre on
 * the shared euro axis, the honest CA→net breakdown, the reason chips (icon + sign, never
 * colour alone), the badges (best-net / recommended / current / plafond / non-viable), the
 * priority score demoted to a secondary line, and the collapsible setup path. Every figure
 * comes from the engine result — nothing is recomputed here (calc.md §1.1).
 */
export type RankingCardProps = {
  /** The scored status to render. */
  scored: ScoredStatus;
  /** Whether this is the user's current status (shows the "Statut actuel" badge). */
  isCurrent: boolean;
  /** Total CA — the breakdown's starting point and shared context. */
  caTotal: number;
  /** Declared real charges — a breakdown deduction (unused for portage). */
  chargesReelles: number;
  /** Best net across the ranking — the écart-mètre axis maximum. */
  netMax: number;
  /** Runner-up's net — the écart-mètre reference line and the leader's comparison point. */
  secondNet: number;
  /** Runner-up status label — named in the leader's gap pastille. */
  secondLabel: string | undefined;
};

/** Number of reason chips shown per card (product-spec §C.1: 2–3). */
const REASON_CHIP_COUNT = 3;

const RankingCard = ({ scored, isCurrent, caTotal, chargesReelles, netMax, secondNet, secondLabel }: RankingCardProps) => {
  const meta = STATUS_META[scored.status];
  const chips = reasonChipsFor({ scored, count: REASON_CHIP_COUNT });
  const isLeader = scored.netDelta <= 0;
  const net = scored.result.netDisponible;
  const leadGap = netMax - secondNet;

  return (
    <Card variant={scored.recommended ? 'winner' : 'default'}>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted font-mono text-sm font-bold tabular-nums">
              {scored.rank}
            </span>
            <div>
              <h3 className="font-heading text-base font-semibold leading-tight">{meta.label}</h3>
              <p className="text-sm text-muted-foreground">{meta.tagline}</p>
            </div>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1">
            {isLeader ? <Badge variant="winner">Meilleur revenu</Badge> : null}
            {scored.recommended ? (
              <Badge variant="positive">
                <Check className="size-3" aria-hidden="true" />
                Recommandé
              </Badge>
            ) : null}
            {isCurrent ? <Badge variant="secondary">Statut actuel</Badge> : null}
            {scored.flagReason === 'plafond-overrun' ? (
              <Badge variant="attention">
                <AlertTriangle className="size-3" aria-hidden="true" />
                Plafond dépassé
              </Badge>
            ) : null}
            {scored.flagReason === 'non-viable' ? <Badge variant="destructive">Non viable</Badge> : null}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1">
          <p className="font-mono text-3xl font-semibold tabular-nums">{formatEuros(net)}</p>
          <p className="text-sm text-muted-foreground">net disponible par an · {formatEurosPerMonth(net)}</p>
          {isLeader ? (
            leadGap > 0 && secondLabel ? (
              <p className="flex flex-wrap items-center gap-x-1.5 text-sm font-medium text-positive">
                <TrendingUp className="size-4 shrink-0" aria-hidden="true" />
                <span className="font-mono tabular-nums">
                  {formatSignedEuros(leadGap)}/an · {formatSignedEurosPerMonth(leadGap)}
                </span>
                <span className="font-normal text-muted-foreground">vs {secondLabel}</span>
              </p>
            ) : null
          ) : (
            <p className="flex flex-wrap items-center gap-x-1.5 text-sm text-muted-foreground">
              <TrendingDown className="size-4 shrink-0" aria-hidden="true" />
              <span className="font-mono tabular-nums text-foreground">
                {formatSignedEuros(-scored.netDelta)}/an · {formatSignedEurosPerMonth(-scored.netDelta)}
              </span>
              <span>vs le meilleur</span>
            </p>
          )}
        </div>

        <GapMeter net={net} netMax={netMax} secondNet={secondNet} isWinner={isLeader} statusLabel={meta.label} />

        <NetBreakdown result={scored.result} caTotal={caTotal} chargesReelles={chargesReelles} />

        {chips.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {chips.map((chip) => (
              <Badge key={chip.code} variant={chip.positive ? 'positive' : 'attention'}>
                {chip.positive ? <Check className="size-3" aria-hidden="true" /> : <Minus className="size-3" aria-hidden="true" />}
                {chip.text}
              </Badge>
            ))}
          </div>
        ) : null}

        <div className="flex items-center gap-1.5 border-t border-border pt-3">
          <span className="text-xs text-muted-foreground">Score selon vos priorités</span>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                className="inline-flex size-6 items-center justify-center rounded-full text-muted-foreground"
                aria-label="À propos du score selon vos priorités"
              >
                <Info className="size-3.5" aria-hidden="true" />
              </button>
            </TooltipTrigger>
            <TooltipContent>
              Note sur 100 qui combine vos 5 critères (revenu net, protection sociale, simplicité, capitalisation, évolutivité), pondérés
              selon l'ordre de priorité que vous avez choisi.
            </TooltipContent>
          </Tooltip>
          <span className="ml-auto font-mono text-sm font-medium tabular-nums">{formatScore(scored.score)}/100</span>
        </div>

        {/* #18: on mobile, only the top 3 unfold the creation path to cut the scroll; desktop shows all. */}
        <div className={scored.rank > 3 ? 'hidden lg:block' : undefined}>
          <SetupPath status={scored.status} />
        </div>
      </CardContent>
    </Card>
  );
};

export default RankingCard;

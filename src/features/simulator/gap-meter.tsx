import { cn } from '@/lib/utils';
import { formatEuros } from './format';

/**
 * The "écart-mètre" (spec change #4): the 7 score-bars recast into ONE shared euro
 * axis (`0 → net max`) so the cards read as a single comparison. Each card's bar
 * fills to its `net` share of the best net; the best-net bar is solid Bleu France, the
 * rest a lighter Bleu France — the winner reads by saturation, not a separate accent.
 * A vertical reference line marks the runner-up's net so the gap to beat is visible at
 * a glance. Pure presentational leaf — every figure is an engine result passed in,
 * nothing is recomputed (calc.md §1.1).
 */
export type GapMeterProps = {
  /** This status's net disponible — the bar value. */
  net: number;
  /** The best net across the ranking — the shared axis maximum. */
  netMax: number;
  /** The runner-up's net — drawn as a vertical reference line. */
  secondNet: number;
  /** Whether this is the best-net status (solid Bleu France fill). */
  isWinner: boolean;
  /** Status label, for a distinct accessible name (spec #20 — no duplicate aria-labels). */
  statusLabel: string;
};

const GapMeter = ({ net, netMax, secondNet, isWinner, statusLabel }: GapMeterProps) => {
  const safeMax = netMax > 0 ? netMax : 1;
  const fillPct = Math.max(0, Math.min(100, (net / safeMax) * 100));
  const refPct = Math.max(0, Math.min(100, (secondNet / safeMax) * 100));
  // Show the runner-up line only when it sits inside the track AND away from this bar's
  // own edge (so the #2 card itself doesn't draw a line on top of its own fill).
  const showRef = refPct > 0.5 && refPct < 99.5 && Math.abs(fillPct - refPct) > 1.5;

  return (
    <div
      className="relative h-2.5 w-full overflow-hidden rounded-full bg-surface"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={Math.round(netMax)}
      aria-valuenow={Math.round(net)}
      aria-valuetext={`${formatEuros(net)} sur ${formatEuros(netMax)}`}
      aria-label={`Revenu net — ${statusLabel}`}
    >
      <div
        className={cn('h-full rounded-full transition-[width] motion-reduce:transition-none', isWinner ? 'bg-france' : 'bg-france/25')}
        style={{ width: `${fillPct}%` }}
      />
      {showRef ? <span aria-hidden="true" className="absolute inset-y-0 w-px bg-foreground/40" style={{ left: `${refPct}%` }} /> : null}
    </div>
  );
};

export default GapMeter;

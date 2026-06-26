import { ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { CriterionCode } from '@/domain/scoring';
import { CRITERIA_META } from './criteria-meta';

/**
 * Priority ranker (questionnaire A16): orders the 5 comparison criteria by drag-free
 * up/down controls. The output is always a permutation of the 5 codes — the engine
 * (`rankStatuses`) throws otherwise, so reordering only ever swaps two adjacent items.
 */
export type CriteriaRankerProps = {
  /** Current ordered priorities (most important first). */
  order: readonly CriterionCode[];
  /** Called with the new full order after a move. */
  onChange: (next: CriterionCode[]) => void;
};

/** A single up/down move: the row to shift and the direction (−1 up, +1 down). */
type MoveCriterionInput = { index: number; direction: -1 | 1 };

const CriteriaRanker = ({ order, onChange }: CriteriaRankerProps) => {
  const handleMove = ({ index, direction }: MoveCriterionInput) => {
    const target = index + direction;
    if (target < 0 || target >= order.length) return;
    const next = [...order];
    const moved = next[index];
    const swapped = next[target];
    if (moved === undefined || swapped === undefined) return;
    next[index] = swapped;
    next[target] = moved;
    onChange(next);
  };

  return (
    <ol className="space-y-2">
      {order.map((code, index) => (
        <li key={code} className="flex items-center gap-3 rounded-lg border bg-card px-3 py-2">
          <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold tabular-nums">
            {index + 1}
          </span>
          <span className="flex-1 text-sm">{CRITERIA_META[code].label}</span>
          <div className="flex shrink-0 gap-1">
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              onClick={() => handleMove({ index, direction: -1 })}
              disabled={index === 0}
              aria-label={`Monter « ${CRITERIA_META[code].label} »`}
            >
              <ChevronUp />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              onClick={() => handleMove({ index, direction: 1 })}
              disabled={index === order.length - 1}
              aria-label={`Descendre « ${CRITERIA_META[code].label} »`}
            >
              <ChevronDown />
            </Button>
          </div>
        </li>
      ))}
    </ol>
  );
};

export default CriteriaRanker;

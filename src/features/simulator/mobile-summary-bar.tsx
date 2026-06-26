import { SlidersHorizontal } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { SituationUi } from './draft';
import { formatEuros } from './format';

/**
 * Mobile-only sticky recap of the questionnaire's headline inputs. When a ranking
 * exists on a narrow viewport the form condenses behind this bar so the verdict
 * leads above the fold (spec change #1); "Modifier" reopens the form. Purely
 * presentational — the parent owns the editing state (components.md §1.1).
 */

/** Short household labels for the recap line (the verbose labels live in the assumptions panel). */
const SITUATION_SHORT: Record<SituationUi, string> = {
  celibataire: 'célibataire',
  marie_pacse: 'marié·e ou pacsé·e',
  union_libre: 'union libre',
};

export type MobileSummaryBarProps = {
  caTotal: number;
  chargesReelles: number;
  situationFamiliale: SituationUi;
  onEdit: () => void;
  className?: string;
};

const MobileSummaryBar = ({ caTotal, chargesReelles, situationFamiliale, onEdit, className }: MobileSummaryBarProps) => (
  <div className={cn('glass-pill sticky top-0 z-30 flex items-center justify-between gap-3 rounded-2xl px-4 py-3', className)}>
    <div className="min-w-0">
      <p className="truncate text-sm font-medium text-foreground">
        <span className="font-mono tabular-nums">{formatEuros(caTotal)}</span> de chiffre d'affaires
      </p>
      <p className="truncate text-xs text-muted-foreground">
        Charges <span className="font-mono tabular-nums">{formatEuros(chargesReelles)}</span> · {SITUATION_SHORT[situationFamiliale]}
      </p>
    </div>
    <Button type="button" variant="outline" size="sm" onClick={onEdit} className="shrink-0">
      <SlidersHorizontal />
      Modifier
    </Button>
  </div>
);

export default MobileSummaryBar;

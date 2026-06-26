import { ArrowRight } from 'lucide-react';
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { RankingResult } from '@/domain/scoring';
import { type StatusId, statusIdValidation } from '@/domain/validation';
import type { Draft } from './draft';
import { formatSignedEuros } from './format';
import { STATUS_META } from './status-meta';

/**
 * Switch cost/benefit view (product-spec §E): only shown when the user declared a
 * current status. Pins the current status, lets them pick a target (defaulting to the
 * recommended one), and states the RECURRING net delta plus a qualitative verdict.
 *
 * It deliberately shows NO one-off break-even: no sourced creation-cost figure exists
 * in the barèmes registry, and inventing one is forbidden (calc.md §1.6). The verdict
 * names the creation cost / complexity as an unquantified counterweight instead.
 */
export type SwitchPanelProps = {
  /** The full ranking (holds every status' net + rank). */
  ranking: RankingResult;
  /** The originating draft (its `statutActuel` is the pinned current status). */
  draft: Draft;
};

/** Status ids selectable as a switch target. */
const TARGET_STATUS_IDS = Object.keys(STATUS_META) as StatusId[];

const SwitchPanel = ({ ranking, draft }: SwitchPanelProps) => {
  const current = draft.statutActuel === 'aucun' ? null : ranking.ranked.find((entry) => entry.status === draft.statutActuel);
  const defaultTarget: StatusId = ranking.recommendation ?? current?.status ?? 'micro-entreprise';
  const [target, setTarget] = useState<StatusId>(defaultTarget);

  if (!current) return null;

  const targetEntry = ranking.ranked.find((entry) => entry.status === target);
  const delta = (targetEntry?.result.netDisponible ?? 0) - current.result.netDisponible;
  const worthwhile = delta > 0;
  const sameStatus = target === current.status;

  return (
    <Card variant="quiet">
      <CardHeader>
        <CardTitle asChild variant="section">
          <h2>Faut-il changer de statut ?</h2>
        </CardTitle>
      </CardHeader>
      <CardContent size="sm" className="space-y-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <Label>Statut actuel</Label>
            <p className="font-medium">{STATUS_META[current.status].label}</p>
          </div>
          <ArrowRight className="mb-2 size-4 text-muted-foreground" />
          <div className="space-y-1">
            <Label htmlFor="switch-target">Statut cible</Label>
            <Select value={target} onValueChange={(value) => setTarget(statusIdValidation.parse(value))}>
              <SelectTrigger id="switch-target" className="w-56">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TARGET_STATUS_IDS.map((id) => (
                  <SelectItem key={id} value={id}>
                    {STATUS_META[id].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {sameStatus ? (
          <p className="text-muted-foreground">Choisissez un statut cible différent pour estimer le gain ou la perte du changement.</p>
        ) : (
          <div className="space-y-2">
            <p>
              Écart de revenu net :{' '}
              <strong className={worthwhile ? 'text-positive' : 'text-destructive'}>{formatSignedEuros(delta)} / an</strong> (
              {formatSignedEuros(delta / 12)} / mois), de façon récurrente.
            </p>
            <p className="text-muted-foreground">
              {worthwhile
                ? `Le passage vers ${STATUS_META[target].label} améliorerait votre revenu net chaque année. À mettre en balance avec les frais de création et la complexité de gestion accrue (non chiffrés ici).`
                : `Le passage vers ${STATUS_META[target].label} ne se justifie pas financièrement : votre revenu net serait inférieur ou identique, avant même de compter les frais de changement.`}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default SwitchPanel;

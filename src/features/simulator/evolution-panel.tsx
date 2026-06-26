import { RotateCcw } from 'lucide-react';
import { useDeferredValue, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { RankingResult, ScoredStatus } from '@/domain/scoring';
import { type Draft, remunerationPreferenceValidation, situationUiValidation } from './draft';
import { formatEuros, formatSignedEuros } from './format';
import NumberField from './number-field';
import { PREFERENCE_OPTIONS, SITUATION_OPTIONS } from './options';
import { rankFromDraft } from './ranking';
import { STATUS_META } from './status-meta';

/**
 * Evolution simulation (product-spec §D): a what-if sandbox seeded from the live
 * profile. The user flexes CA / charges / situation / rémunération preference and sees
 * the recommended status and net move against today's baseline. State is ephemeral
 * (a throwaway exploration), so it is `useState`, not the URL (components.md §1.4).
 */
export type EvolutionPanelProps = {
  /** The live questionnaire draft (the baseline to compare against). */
  baseline: Draft;
};

/** The recommended entry of a ranking (falls back to rank 1 if all flagged). */
const recommendedEntry = (ranking: RankingResult): ScoredStatus | null =>
  ranking.ranked.find((entry) => entry.recommended) ?? ranking.ranked[0] ?? null;

const EvolutionPanel = ({ baseline }: EvolutionPanelProps) => {
  const [simulated, setSimulated] = useState<Draft>(baseline);
  const deferredSimulated = useDeferredValue(simulated);

  const baselineRanking = rankFromDraft(baseline);
  const simulatedRanking = rankFromDraft(deferredSimulated);
  const baselineRec = recommendedEntry(baselineRanking);
  const simulatedRec = recommendedEntry(simulatedRanking);

  const update = (patch: Partial<Draft>) => setSimulated((current) => ({ ...current, ...patch }));

  const baselineNet = baselineRec?.result.netDisponible ?? 0;
  const simulatedNet = simulatedRec?.result.netDisponible ?? 0;
  const delta = simulatedNet - baselineNet;
  const improved = delta > 0;
  // Where today's recommended status lands in the simulated ranking (rank movement).
  const baselineRecInSimulated = baselineRec ? simulatedRanking.ranked.find((entry) => entry.status === baselineRec.status) : undefined;

  return (
    <Card variant="quiet" id="evolution" className="scroll-mt-24">
      <CardHeader>
        <CardTitle asChild variant="section">
          <h2>Et si ma situation évoluait ?</h2>
        </CardTitle>
      </CardHeader>
      <CardContent size="sm" className="space-y-5">
        <div className="grid gap-3 sm:grid-cols-2">
          <NumberField
            id="evo-vente"
            label="CA vente de marchandises"
            value={simulated.caVente}
            onChange={(v) => update({ caVente: v })}
            suffix="€"
          />
          <NumberField
            id="evo-bic"
            label="CA prestations de services (BIC)"
            value={simulated.caServiceBIC}
            onChange={(v) => update({ caServiceBIC: v })}
            suffix="€"
          />
          <NumberField
            id="evo-bnc"
            label="CA prestations libérales (BNC)"
            value={simulated.caServiceBNC}
            onChange={(v) => update({ caServiceBNC: v })}
            suffix="€"
          />
          <NumberField
            id="evo-charges"
            label="Charges réelles"
            value={simulated.chargesReelles}
            onChange={(v) => update({ chargesReelles: v })}
            suffix="€"
          />
          <div className="space-y-1">
            <Label htmlFor="evo-situation">Situation familiale</Label>
            <Select
              value={simulated.situationFamiliale}
              onValueChange={(value) => update({ situationFamiliale: situationUiValidation.parse(value) })}
            >
              <SelectTrigger id="evo-situation" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SITUATION_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="evo-preference">Stratégie de rémunération (IS)</Label>
            <Select
              value={simulated.preferenceRemuneration}
              onValueChange={(value) => update({ preferenceRemuneration: remunerationPreferenceValidation.parse(value) })}
            >
              <SelectTrigger id="evo-preference" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PREFERENCE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border bg-muted/40 p-3">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Aujourd'hui</p>
            <p className="mt-1 font-medium">{baselineRec ? STATUS_META[baselineRec.status].label : '—'}</p>
            <p className="text-lg font-bold tabular-nums">{formatEuros(baselineNet)}</p>
          </div>
          <div className="rounded-lg border bg-primary/5 p-3">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Simulation</p>
            <p className="mt-1 font-medium">{simulatedRec ? STATUS_META[simulatedRec.status].label : '—'}</p>
            <p className="text-lg font-bold tabular-nums">{formatEuros(simulatedNet)}</p>
          </div>
        </div>

        <p>
          Variation du revenu net :{' '}
          <strong className={improved ? 'text-positive' : delta < 0 ? 'text-destructive' : undefined}>
            {formatSignedEuros(delta)} / an
          </strong>
          {baselineRec && baselineRecInSimulated && baselineRecInSimulated.rank !== baselineRec.rank ? (
            <>
              {' '}
              · {STATUS_META[baselineRec.status].label} passe de la position {baselineRec.rank} à la position {baselineRecInSimulated.rank}.
            </>
          ) : null}
        </p>

        <Button type="button" variant="outline" size="sm" onClick={() => setSimulated(baseline)}>
          <RotateCcw />
          Réinitialiser sur ma situation actuelle
        </Button>
      </CardContent>
    </Card>
  );
};

export default EvolutionPanel;

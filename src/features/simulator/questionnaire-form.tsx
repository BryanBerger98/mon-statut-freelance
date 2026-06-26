import { Info } from 'lucide-react';
import type { PropsWithChildren } from 'react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { activiteSousTypeValidation, fraisGestionModeValidation } from '@/domain/validation';
import CriteriaRanker from './criteria-ranker';
import { type Draft, remunerationPreferenceValidation, situationUiValidation, statutActuelChoiceValidation } from './draft';
import NumberField from './number-field';
import {
  ACTIVITE_OPTIONS,
  FRAIS_GESTION_OPTIONS,
  type Option,
  PREFERENCE_OPTIONS,
  SITUATION_OPTIONS,
  STATUT_ACTUEL_OPTIONS,
} from './options';

/**
 * The full questionnaire (product-spec §B, variables A1–A18). Controlled form: it owns
 * no state — it reads the live `Draft` and emits the next one through `onChange`. The
 * orchestrator (Simulator) holds the draft in the URL. Conditional reveals follow the
 * spec: CIPAV only with BNC turnover, ACRE date only the first year, the VL reference
 * income only when versement libératoire is on, the fixed amount only in fixed-frais
 * mode. Everything volatile/advanced sits behind an "Options avancées" accordion.
 */
export type QuestionnaireFormProps = {
  /** The live questionnaire draft. */
  draft: Draft;
  /** Called with the next draft on any field change. */
  onChange: (next: Draft) => void;
};

/**
 * A questionnaire section (spec change #7): a coloured ordinal eyebrow + an Archivo
 * encre title + a short intent phrase, with the fields grouped on a `--surface`
 * sub-panel so each section is instantly identifiable (objectif #2).
 */
type FormSectionProps = PropsWithChildren<{
  /** Coloured ordinal + theme eyebrow, e.g. "01 · Revenus". */
  eyebrow: string;
  /** Section title (Archivo, encre). */
  title: string;
  /** One-line statement of what the section is for. */
  intent: string;
}>;

const FormSection = ({ eyebrow, title, intent, children }: FormSectionProps) => (
  <section className="space-y-3">
    <header className="space-y-0.5">
      <p className="font-mono text-xs font-semibold uppercase tracking-wide text-primary">{eyebrow}</p>
      <h3 className="font-heading text-base font-semibold text-foreground">{title}</h3>
      <p className="text-sm text-muted-foreground">{intent}</p>
    </header>
    <div className="space-y-3 rounded-lg bg-surface p-4">{children}</div>
  </section>
);

/** A labelled select bound to an enum, parsing the raw value back to its validated type. */
type SelectFieldProps<TValue extends string> = {
  id: string;
  label: string;
  value: TValue;
  options: Option<TValue>[];
  parse: (raw: string) => TValue;
  onChange: (next: TValue) => void;
};

const SelectField = <TValue extends string>({ id, label, value, options, parse, onChange }: SelectFieldProps<TValue>) => (
  <div className="space-y-1">
    <Label htmlFor={id}>{label}</Label>
    <Select value={value} onValueChange={(raw) => onChange(parse(raw))}>
      <SelectTrigger id={id} className="w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  </div>
);

/** An inline label + toggle row. */
type SwitchRowProps = {
  id: string;
  label: string;
  hint?: string;
  checked: boolean;
  onCheckedChange: (next: boolean) => void;
};

const SwitchRow = ({ id, label, hint, checked, onCheckedChange }: SwitchRowProps) => (
  <div className="flex items-start justify-between gap-4">
    <div className="space-y-0.5">
      <Label htmlFor={id}>{label}</Label>
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
    <Switch id={id} checked={checked} onCheckedChange={onCheckedChange} />
  </div>
);

const QuestionnaireForm = ({ draft, onChange }: QuestionnaireFormProps) => {
  const update = (patch: Partial<Draft>) => onChange({ ...draft, ...patch });
  const caTotal = draft.caVente + draft.caServiceBIC + draft.caServiceBNC;

  return (
    <Card>
      <CardHeader>
        <CardTitle asChild variant="section">
          <h2>Votre profil</h2>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <FormSection eyebrow="01 · Revenus" title="Votre chiffre d'affaires" intent="Vos recettes annuelles encaissées, hors TVA.">
          <NumberField
            id="ca-vente"
            label="Vente de marchandises"
            suffix="€"
            value={draft.caVente}
            onChange={(v) => update({ caVente: v })}
          />
          <NumberField
            id="ca-bic"
            label="Prestations de services (BIC)"
            suffix="€"
            value={draft.caServiceBIC}
            onChange={(v) => update({ caServiceBIC: v })}
          />
          <NumberField
            id="ca-bnc"
            label="Prestations libérales (BNC)"
            suffix="€"
            value={draft.caServiceBNC}
            onChange={(v) => update({ caServiceBNC: v })}
          />
          {draft.caServiceBNC > 0 ? (
            <SelectField
              id="activite-soustype"
              label="Caisse de retraite (activité libérale)"
              value={draft.activiteSousType}
              options={ACTIVITE_OPTIONS}
              parse={activiteSousTypeValidation.parse}
              onChange={(value) => update({ activiteSousType: value })}
            />
          ) : null}
        </FormSection>

        <FormSection
          eyebrow="02 · Foyer fiscal"
          title="Vos charges et votre foyer"
          intent="Pour les régimes au réel et le barème de l'impôt sur le revenu."
        >
          <NumberField
            id="charges"
            label="Charges professionnelles annuelles"
            suffix="€"
            value={draft.chargesReelles}
            onChange={(v) => update({ chargesReelles: v })}
            hint="Loyer, matériel, assurances, déplacements, abonnements…"
          />
          {draft.chargesReelles === 0 && caTotal > 0 ? (
            <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
              <Info className="mt-0.5 size-3.5 shrink-0 text-primary" aria-hidden="true" />
              <span>Ajoutez vos charges réelles pour fiabiliser les régimes au réel (EI, EURL, SASU).</span>
            </p>
          ) : null}
          <SelectField
            id="situation"
            label="Situation familiale"
            value={draft.situationFamiliale}
            options={SITUATION_OPTIONS}
            parse={situationUiValidation.parse}
            onChange={(value) => update({ situationFamiliale: value })}
          />
          <NumberField
            id="personnes-charge"
            label="Personnes à charge"
            value={draft.nombrePersonnesACharge}
            step={1}
            onChange={(v) => update({ nombrePersonnesACharge: Math.round(v) })}
            hint="Enfants ou personnes rattachées à votre foyer fiscal."
          />
          <NumberField
            id="autres-revenus"
            label="Autres revenus imposables du foyer"
            suffix="€"
            value={draft.autresRevenusFoyer}
            onChange={(v) => update({ autresRevenusFoyer: v })}
            hint="Salaire du conjoint, revenus fonciers… imposés avec votre activité."
          />
        </FormSection>

        <FormSection eyebrow="03 · Pondération" title="Vos priorités" intent="Ce classement repondère le score de chaque statut.">
          <p className="text-xs text-muted-foreground">Classez du plus important (en haut) au moins important.</p>
          <CriteriaRanker order={draft.prioritesCriteres} onChange={(next) => update({ prioritesCriteres: next })} />
        </FormSection>

        <FormSection eyebrow="04 · Optionnel" title="Votre statut actuel" intent="Débloque l'analyse «&nbsp;faut-il en changer ?&nbsp;».">
          <SelectField
            id="statut-actuel"
            label="Statut sous lequel vous exercez aujourd'hui"
            value={draft.statutActuel}
            options={STATUT_ACTUEL_OPTIONS}
            parse={statutActuelChoiceValidation.parse}
            onChange={(value) => update({ statutActuel: value })}
          />
        </FormSection>

        <FormSection
          eyebrow="05 · Cible de rémunération"
          title="Salaire et dividendes souhaités"
          intent="Optionnel — n'oriente que les sociétés à l'IS (SASU-IS, EURL-IS). Laissez à 0 pour l'optimisation automatique."
        >
          <NumberField
            id="cible-salaire-net"
            label="Salaire net mensuel souhaité (après impôts)"
            suffix="€"
            value={draft.cibleSalaireNetMensuel}
            onChange={(v) => update({ cibleSalaireNetMensuel: v })}
            hint="Le simulateur ajuste le brut pour viser ce net mensuel après impôt. 0 = il optimise à votre place."
          />
          <NumberField
            id="cible-dividendes"
            label="Dividendes annuels bruts souhaités"
            suffix="€"
            value={draft.cibleDividendesBruts}
            onChange={(v) => update({ cibleDividendesBruts: v })}
            hint="Montant brut à distribuer avant prélèvements. 0 = optimisation automatique."
          />
        </FormSection>

        <Accordion type="single" collapsible className="w-full">
          <AccordionItem value="advanced">
            <AccordionTrigger className="text-sm font-semibold">Options avancées</AccordionTrigger>
            <AccordionContent className="space-y-4 pt-2">
              <SelectField
                id="preference-remuneration"
                label="Stratégie de rémunération (sociétés à l'IS)"
                value={draft.preferenceRemuneration}
                options={PREFERENCE_OPTIONS}
                parse={remunerationPreferenceValidation.parse}
                onChange={(value) => update({ preferenceRemuneration: value })}
              />

              <SwitchRow
                id="first-year"
                label="Première année d'activité"
                hint="Active la prise en compte de l'ACRE (exonération partielle de cotisations)."
                checked={draft.firstYear}
                onCheckedChange={(checked) => update({ firstYear: checked })}
              />
              {draft.firstYear ? (
                <div className="space-y-1">
                  <Label htmlFor="date-debut">Date de début d'activité</Label>
                  <Input
                    id="date-debut"
                    type="date"
                    value={draft.dateDebutActivite}
                    onChange={(event) => update({ dateDebutActivite: event.target.value })}
                  />
                </div>
              ) : null}

              <SwitchRow
                id="versement-liberatoire"
                label="Versement libératoire (micro-entreprise)"
                hint="Paiement de l'impôt en pourcentage du CA, si vous y êtes éligible."
                checked={draft.versementLiberatoire}
                onCheckedChange={(checked) => update({ versementLiberatoire: checked })}
              />
              {draft.versementLiberatoire ? (
                <NumberField
                  id="rfr-n2"
                  label="Revenu fiscal de référence (année N-2)"
                  suffix="€"
                  value={draft.rfrNMoins2}
                  onChange={(v) => update({ rfrNMoins2: v })}
                  hint="Conditionne l'éligibilité au versement libératoire (plafond par part)."
                />
              ) : null}

              <SwitchRow
                id="clientele-b2b"
                label="Clientèle principalement professionnelle (B2B)"
                hint="Si oui, la TVA est neutre. Sinon, la franchise en base devient un avantage."
                checked={draft.clienteleB2B}
                onCheckedChange={(checked) => update({ clienteleB2B: checked })}
              />

              <SelectField
                id="frais-gestion-mode"
                label="Frais de gestion du portage salarial"
                value={draft.fraisGestionMode}
                options={FRAIS_GESTION_OPTIONS}
                parse={fraisGestionModeValidation.parse}
                onChange={(value) => update({ fraisGestionMode: value })}
              />
              {draft.fraisGestionMode === 'fixed' ? (
                <NumberField
                  id="frais-gestion-fixe"
                  label="Frais de gestion fixes (annuels)"
                  suffix="€"
                  value={draft.fraisGestionFixe}
                  onChange={(v) => update({ fraisGestionFixe: v })}
                />
              ) : null}

              <NumberField
                id="taux-atmp"
                label="Taux accident du travail / maladie pro."
                suffix="%"
                step={0.1}
                value={Math.round(draft.tauxAtMp * 1000) / 10}
                onChange={(v) => update({ tauxAtMp: v / 100 })}
                hint="Notifié chaque année par l'URSSAF. Concerne les statuts assimilé-salarié (SASU, portage)."
              />
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </CardContent>
    </Card>
  );
};

export default QuestionnaireForm;

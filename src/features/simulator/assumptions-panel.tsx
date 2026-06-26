import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Card, CardContent } from '@/components/ui/card';
import type { Draft, SituationUi } from './draft';
import { deriveNbParts } from './draft-to-profile';
import { formatEuros } from './format';

/**
 * Collapsible "Hypothèses de calcul" panel (product-spec §C.4): makes every modelling
 * choice explicit (parts/QF, autres revenus, IS rémunération split, versement
 * libératoire, ACRE, CFE exclusion, micro net net-of-real-charges). Transparency
 * requirement — the user must be able to audit what the figures assume.
 */
export type AssumptionsPanelProps = {
  /** The originating questionnaire draft. */
  draft: Draft;
};

/** FR household labels for the assumptions copy. */
const SITUATION_LABELS: Record<SituationUi, string> = {
  celibataire: 'foyer d’une personne (célibataire)',
  marie_pacse: 'foyer commun (marié·e ou pacsé·e)',
  union_libre: 'foyers séparés (union libre, imposition individuelle)',
};

const AssumptionsPanel = ({ draft }: AssumptionsPanelProps) => {
  const parts = deriveNbParts({ situation: draft.situationFamiliale, nombrePersonnesACharge: draft.nombrePersonnesACharge });
  const remunerationLabel =
    draft.preferenceRemuneration === 'capitalisation'
      ? 'rémunération minimale, bénéfice capitalisé puis distribué en dividendes'
      : 'rémunération maximale (revenu disponible immédiat)';

  const assumptions: string[] = [
    `${parts} part${parts > 1 ? 's' : ''} de quotient familial — ${SITUATION_LABELS[draft.situationFamiliale]}.`,
    `${formatEuros(draft.autresRevenusFoyer)} d'autres revenus du foyer, ajoutés avant le barème de l'impôt sur le revenu.`,
    `Pour les sociétés à l'impôt sur les sociétés (EURL-IS, SASU-IS) : ${remunerationLabel}.`,
    draft.versementLiberatoire
      ? 'Micro-entreprise : versement libératoire de l’impôt appliqué dès qu’il est éligible et avantageux.'
      : 'Micro-entreprise : versement libératoire non retenu (imposition au barème).',
    draft.firstYear
      ? "Première année d'activité : l'ACRE (exonération partielle de cotisations) est prise en compte si le statut y donne droit."
      : "Hors première année : pas d'ACRE.",
    'La CFE (cotisation foncière des entreprises) n’est pas incluse : elle dépend de la commune et de la valeur locative.',
    'Micro-entreprise : le revenu net affiché est diminué de vos charges réelles saisies (le régime micro ne les déduit pas fiscalement).',
    'Toutes les estimations portent sur l’année 2026.',
  ];

  return (
    // `scroll-mt-24` keeps the heading clear of the sticky chrome when the recommendation's
    // "Voir les hypothèses de calcul" link jumps here. A quiet Card gives this panel the same
    // surface as the sibling switch/evolution panels at the bottom of the results column.
    <Card variant="quiet" id="hypotheses" className="scroll-mt-24">
      <CardContent>
        <Accordion type="single" collapsible className="w-full">
          <AccordionItem value="assumptions">
            <AccordionTrigger className="text-sm font-medium">Hypothèses de calcul</AccordionTrigger>
            <AccordionContent>
              <ul className="list-disc space-y-1.5 pl-5 text-sm text-muted-foreground">
                {assumptions.map((assumption) => (
                  <li key={assumption}>{assumption}</li>
                ))}
              </ul>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </CardContent>
    </Card>
  );
};

export default AssumptionsPanel;

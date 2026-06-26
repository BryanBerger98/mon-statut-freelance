import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import type { StatusId } from '@/domain/validation';
import { STATUS_META } from './status-meta';

/**
 * Collapsible "Comment créer ce statut ?" setup path (product-spec §C.3). Reads the
 * ordered creation steps straight from `STATUS_META` (no numbers, no business logic).
 */
export type SetupPathProps = {
  /** The status whose creation steps to display. */
  status: StatusId;
};

const SetupPath = ({ status }: SetupPathProps) => {
  const steps = STATUS_META[status].setupSteps;
  return (
    <Accordion type="single" collapsible className="w-full">
      <AccordionItem value="setup">
        <AccordionTrigger className="text-sm font-medium">Comment créer ce statut ?</AccordionTrigger>
        <AccordionContent>
          <ol className="list-decimal space-y-1.5 pl-5 text-sm text-muted-foreground">
            {steps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
};

export default SetupPath;

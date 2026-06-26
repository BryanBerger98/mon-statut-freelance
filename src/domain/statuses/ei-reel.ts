/**
 * EI au réel calc — entrepreneur individuel à l'IR au régime réel (TNS, bénéfice
 * taxé à l'IR du foyer). Thin wrapper over the shared TNS-au-réel pipeline
 * (`tns-au-reel.ts`), which `eurl-ir` reuses verbatim — only the status label differs.
 * Pure transcription of `.claude/docs/business/calculation/ei-reel.md`.
 */
import { computeTnsAuReel } from './tns-au-reel';
import type { StatusCompute } from './types';

export const computeEiReel: StatusCompute = (input) => computeTnsAuReel({ profile: input.profile, statusId: 'ei-reel' });

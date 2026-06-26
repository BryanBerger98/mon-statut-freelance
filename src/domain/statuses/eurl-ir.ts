/**
 * EURL-IR calc — gérant associé unique d'EURL à l'IR (régime de droit commun de
 * l'EURL personne physique). Le gérant majoritaire est TNS et le bénéfice est
 * imposé à l'IR du foyer : mécaniquement IDENTIQUE à l'EI au réel (seul le label
 * de statut diffère), d'où le partage du pipeline `tns-au-reel.ts`.
 * Pure transcription of `.claude/docs/business/calculation/eurl-ir.md`.
 */
import { computeTnsAuReel } from './tns-au-reel';
import type { StatusCompute } from './types';

export const computeEurlIr: StatusCompute = (input) => computeTnsAuReel({ profile: input.profile, statusId: 'eurl-ir' });

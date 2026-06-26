import type { StatusId } from '../validation';
import { computeEiReel } from './ei-reel';
import { computeEurlIr } from './eurl-ir';
import { computeEurlIs } from './eurl-is';
import { computeMicro } from './micro-entreprise';
import { computePortage } from './portage-salarial';
import { computeSasuIr } from './sasu-ir';
import { computeSasuIs } from './sasu-is';
import type { StatusCompute } from './types';

/**
 * Registry mapping each StatusId to its compute function — all 7 single-owner statuses wired.
 * The full (non-Partial) Record makes TS enforce exhaustiveness: a missing status fails typecheck.
 * eurl-is / sasu-is return StatusResultIS, assignable to StatusCompute via covariant return.
 */
export const statusRegistry: Record<StatusId, StatusCompute> = {
  'micro-entreprise': computeMicro,
  'ei-reel': computeEiReel,
  'eurl-ir': computeEurlIr,
  'eurl-is': computeEurlIs,
  'sasu-ir': computeSasuIr,
  'sasu-is': computeSasuIs,
  'portage-salarial': computePortage,
};

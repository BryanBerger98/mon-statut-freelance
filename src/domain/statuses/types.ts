import type { StatusComputeInput, StatusResult, StatusResultIS } from '../validation';

/**
 * Uniform compute-function type.
 * Every status module exports exactly ONE function matching this signature.
 * (calc.md §1 — deterministic, pure, no I/O)
 */
export type StatusCompute = (input: StatusComputeInput) => StatusResult;

/**
 * IS-status compute type — returns the StatusResultIS extension (remuneration / dividendes /
 * remunerationShare). Assignable to StatusCompute via covariant return (StatusResultIS extends
 * StatusResult), so it slots into statusRegistry unchanged. Used by eurl-is and sasu-is.
 */
export type StatusComputeIS = (input: StatusComputeInput) => StatusResultIS;

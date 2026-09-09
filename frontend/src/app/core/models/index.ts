/**
 * Barrel export for all API-contract models.
 * Import from a single place, e.g.:
 *   import { CourseOutcome, GeneratedQuestion, AttainmentReport } from '@app/core/models';
 * (or a relative path: '../../core/models')
 */
export * from './common.model';
export * from './vector-kb.model';
export * from './question-gen.model';
export * from './attainment.model';
export * from './report-analysis.model';
export * from './dashboard.model';

/**
 * ============================================================================
 *  cam.model.ts  —  API_CONTRACT.md v2.4 §9 (Course Articulation Matrix)
 * ============================================================================
 *  Four steps: faculty-entered course inputs → unit → CO links (AI suggests,
 *  faculty confirms) → CO → PO/PSO levels (AI suggests, faculty decides every
 *  cell) → finalize. COs carry no Bloom level (AGENTS.md › CAM).
 * ============================================================================
 */
import { ID, IsoDateTime } from './common.model';
import { CorrelationLevel, OutcomeKind } from './faculty-workspace.model';

/** A new entry is sent without its ID; the server assigns one. */
export interface CamCourseOutcome {
  coId?: ID;
  code: string;
  statement: string;
}

export interface CamUnit {
  unitNumber: number;
  title: string;
  content: string;
  hours?: number;
}

export interface CamProgramOutcome {
  outcomeId?: ID;
  kind: OutcomeKind;
  code: string;
  title?: string;
  statement: string;
}

export interface CamItem {
  itemId?: ID;
  title: string;
  description?: string;
  coIds: ID[];
}

export interface CamInputs {
  courseObjectives: string[];
  courseOutcomes: CamCourseOutcome[];
  units: CamUnit[];
  programOutcomes: CamProgramOutcome[];
  activities: CamItem[];
  practicals: CamItem[];
  tutorials: CamItem[];
}

export type CamValueSource = 'FACULTY' | 'AI_ACCEPTED' | 'AI_EDITED';

export interface UnitCoLink {
  unitNumber: number;
  coId: ID;
  source: CamValueSource;
  suggestionId?: ID;
}

export interface UnitMapping {
  status: 'DRAFT' | 'CONFIRMED';
  links: UnitCoLink[];
  confirmedAt?: IsoDateTime;
  confirmedBy?: string;
}

export interface CamCell {
  coId: ID;
  outcomeId: ID;
  level: CorrelationLevel;
  justification?: string;
  source: CamValueSource;
  suggestionId?: ID;
}

export interface CamScoringRubric {
  rubricId: ID;
  version: number;
  status: 'PROPOSED' | 'OFFICIAL';
  levels: { level: CorrelationLevel | null; label: string; meaning: string }[];
  rules: string[];
}

export interface Cam {
  camId: ID;
  offeringId: ID;
  status: 'DRAFT' | 'FINALIZED';
  version: number;
  inputs: CamInputs;
  unitMapping: UnitMapping;
  cells: CamCell[];
  scoringRubric: CamScoringRubric;
  updatedAt: IsoDateTime;
  updatedBy: string;
}

export interface CamUpdate {
  version: number;
  inputs: CamInputs;
  unitLinks: UnitCoLink[];
  cells: CamCell[];
}

/** §2.9 */
export interface AiProvenance {
  modelUsed: string;
  templateId?: string;
  templateVersion?: string;
  generatedAt: IsoDateTime;
}

export interface UnitCoSuggestion {
  suggestionId: ID;
  unitNumber: number;
  coId: ID;
  rationale: string;
  needsReview: boolean;
  reviewNote?: string;
  confidence?: number;
}

export interface UnitCoSuggestionSet extends AiProvenance {
  suggestionSetId: ID;
  basedOnCamVersion: number;
  suggestions: UnitCoSuggestion[];
}

export interface CamSuggestion {
  suggestionId: ID;
  coId: ID;
  outcomeId: ID;
  suggestedLevel: CorrelationLevel | null;
  rationale: string;
  evidence: { unitNumbers: number[]; itemIds: ID[] };
  needsReview: boolean;
  reviewNote?: string;
  confidence?: number;
}

export interface CamSuggestionSet extends AiProvenance {
  suggestionSetId: ID;
  basedOnCamVersion: number;
  rubricVersion: number;
  suggestions: CamSuggestion[];
}

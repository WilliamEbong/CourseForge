/** Shapes shared by the build-time data writer and the learner runtime (`<script id="cf-data">`). */
import type { InteractionMode } from '../../../../src/core/enums.js';

export interface CfItem {
  mode: InteractionMode;
  graded: boolean;
  correctKeys: string[];
  /** matching / categorization: option key → target key. */
  mapping: Record<string, string>;
  /** sequencing: option keys in the correct order. */
  order: string[];
  feedbackCorrect: string;
  feedbackIncorrect: string;
  optionFeedback: Record<string, string>;
  rationale: string;
}

export interface CfScreenInfo {
  id: string;
  moduleId: string;
  optional: boolean;
  graded: boolean;
  kind: string;
}

export interface CfData {
  courseId: string;
  version: string;
  storageKey: string;
  passingPercent: number;
  screens: CfScreenInfo[];
  items: Record<string, CfItem>;
}

/** A learner response, normalised per mode. */
export interface CfResponse {
  keys?: string[];
  mapping?: Record<string, string>;
  order?: string[];
}

export interface CfAnswer {
  correct: boolean;
  attempts: number;
  response: CfResponse;
}

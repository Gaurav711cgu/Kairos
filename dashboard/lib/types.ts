export type ReplayStatus =
  | 'CREATED'
  | 'ACQUIRING_RESOURCES'
  | 'RESTORING_DATABASE'
  | 'STARTING_MOCK_LAYER'
  | 'REPLAYING_EVENTS'
  | 'COLLECTING_TRACE'
  | 'ANALYZING'
  | 'COMPLETE'
  | 'FAILED_RESTORE_VALIDATION'
  | 'FAILED_ORDERING_VIOLATION'
  | 'FAILED_BRANCH_CREATION'
  | 'FAILED_CAUSAL_CYCLE'
  | 'FAILED';

export interface ReplayEvent {
  snapshotId: string;
  serviceId: string;
  causalPosition: number;
  method: string;
  path: string;
  capturedStatusCode: number;
  replayStatusCode: number;
  capturedLatencyMs: number;
  replayLatencyMs: number;
  statusCodeMatch: boolean;
  causedBy?: string[];
}

export interface DbDiff {
  tableName: string;
  before: Record<string, unknown>;
  after: Record<string, unknown>;
  changed: boolean;
}

export type RootCausePattern =
  | 'TOCTOU_RACE_CONDITION'
  | 'DEADLOCK'
  | 'MISSING_DISTRIBUTED_LOCK'
  | 'N_PLUS_ONE_QUERY'
  | 'CASCADING_FAILURE'
  | 'MISSING_IDEMPOTENCY'
  | 'VECTOR_CLOCK_VIOLATION'
  | 'OTHER';

export interface CodeFix {
  description: string;
  codeLocation: string;
  suggestedChange: string;
  codeDiff: string;
  confidence: number;
}

export interface RcaReport {
  rootCause: {
    pattern: RootCausePattern;
    description: string;
    affectedServices: string[];
    evidence: string[];
  };
  contributingFactors: string[];
  primaryFix: CodeFix;
  secondaryFixes: CodeFix[];
  traceSummary: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  schemaVersion: number;
}

export interface ReplaySession {
  sessionId: string;
  status: ReplayStatus;
  services: string[];
  events: ReplayEvent[];
  dbDiffs: DbDiff[];
  rcaReport: RcaReport | null;
  racingConditionDetected: boolean;
  createdAt: string;
  updatedAt: string;
  errorMessage?: string;
}

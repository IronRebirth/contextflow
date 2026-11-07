import Ajv, { ValidateFunction } from "ajv";
import addFormats from "ajv-formats";
import schema from "./diagnostic-report.schema.json";

// ─── Constants ───────────────────────────────────────────────────────────────

/** Current schema version */
export const SCHEMA_VERSION = "1.0" as const;

/** Platforms supported by the diagnostic report schema */
export const SUPPORTED_PLATFORMS = ["QNX", "Linux", "Generic"] as const;

/** Target architectures supported by the diagnostic report schema */
export const SUPPORTED_TARGETS = ["x86_64", "aarch64"] as const;

// ─── Types ───────────────────────────────────────────────────────────────────

export type Platform = (typeof SUPPORTED_PLATFORMS)[number];
export type TargetArch = (typeof SUPPORTED_TARGETS)[number];
export type BuildStatus = "success" | "failed" | "partial" | "skipped";
export type DiagnosticSeverity = "error" | "warning" | "note" | "info";
export type BuildSystem = "make" | "cmake" | "qmake" | "custom";
export type DiagnosticCategory =
  | "syntax"
  | "type"
  | "linker"
  | "include"
  | "qnx-specific"
  | "configuration"
  | "runtime"
  | "other";

// ─── Interfaces ──────────────────────────────────────────────────────────────

/** A single diagnostic entry (error, warning, note, or info) from a build. */
export interface DiagnosticEntry {
  /** Severity level of this diagnostic */
  severity: DiagnosticSeverity;
  /** Compiler error code if available */
  code?: string;
  /** Source file path */
  file?: string;
  /** Line number in the source file */
  line?: number;
  /** Column number in the source file */
  column?: number;
  /** The diagnostic message */
  message: string;
  /** AI-generated or rule-based fix suggestion */
  suggestion?: string;
  /** Surrounding source code context */
  context?: string;
  /** Category of the diagnostic */
  category?: DiagnosticCategory;
}

/** Project information for the build. */
export interface ProjectInfo {
  /** Project name */
  name?: string;
  /** Project path on disk */
  path?: string;
  /** Build system used */
  buildSystem?: BuildSystem;
}

/** Environment information captured at build time. */
export interface EnvironmentInfo {
  /** QNX_HOST path */
  qnxHost?: string;
  /** QNX_TARGET path */
  qnxTarget?: string;
  /** Host operating system */
  hostOs?: string;
  /** Host architecture */
  hostArch?: string;
  /** Node.js version */
  nodeVersion?: string;
}

/** Summary counts for the build diagnostics. */
export interface BuildSummary {
  /** Total number of errors */
  totalErrors?: number;
  /** Total number of warnings */
  totalWarnings?: number;
  /** Total number of notes */
  totalNotes?: number;
  /** List of affected source file paths */
  filesAffected?: string[];
}

/** Metadata about the report itself. */
export interface ReportMetadata {
  /** ContextFlow version that generated this report */
  contextflowVersion?: string;
  /** Tool that generated this report (e.g., "qnx-companion-cli") */
  generatedBy?: string;
  /** Associated Jira issue key */
  jiraIssueKey?: string;
}

/** Top-level diagnostic report — the contract between CLI and Forge App. */
export interface DiagnosticReport {
  /** Schema version for forward compatibility */
  schemaVersion: typeof SCHEMA_VERSION;
  /** Target platform */
  platform: Platform;
  /** QNX SDP version (e.g., '8.0') */
  sdpVersion?: string;
  /** Target architecture */
  target?: TargetArch;
  /** Overall build outcome */
  buildStatus: BuildStatus;
  /** Compiler used (e.g., 'qcc', 'gcc') */
  compiler?: string;
  /** ISO 8601 timestamp of the build */
  timestamp: string;
  /** Build duration in milliseconds */
  duration?: number;
  /** Project information */
  project?: ProjectInfo;
  /** Build environment details */
  environment?: EnvironmentInfo;
  /** Array of diagnostic entries */
  diagnostics: DiagnosticEntry[];
  /** Summary counts */
  summary?: BuildSummary;
  /** Report metadata */
  metadata?: ReportMetadata;
}

// ─── Validation ──────────────────────────────────────────────────────────────

let _validate: ValidateFunction | null = null;

function getValidator(): ValidateFunction {
  if (!_validate) {
    const ajv = new Ajv({ allErrors: true });
    addFormats(ajv);
    _validate = ajv.compile(schema);
  }
  return _validate;
}

/**
 * Validates unknown data against the DiagnosticReport JSON Schema.
 * Returns the typed report on success; throws an Error with details on failure.
 */
export function validateReport(data: unknown): DiagnosticReport {
  const validate = getValidator();
  const valid = validate(data);

  if (!valid) {
    const messages = (validate.errors ?? [])
      .map((e: any) => `${e.instancePath || "/"} ${e.message}`)
      .join("; ");
    throw new Error(`Invalid DiagnosticReport: ${messages}`);
  }

  return data as DiagnosticReport;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Creates a minimal valid DiagnosticReport for the given platform.
 * Useful as a starting point that can be populated during a build.
 */
export function createEmptyReport(platform: string): DiagnosticReport {
  if (
    !SUPPORTED_PLATFORMS.includes(platform as Platform)
  ) {
    throw new Error(
      `Unsupported platform "${platform}". Must be one of: ${SUPPORTED_PLATFORMS.join(", ")}`
    );
  }

  return {
    schemaVersion: SCHEMA_VERSION,
    platform: platform as Platform,
    buildStatus: "skipped",
    timestamp: new Date().toISOString(),
    diagnostics: [],
    summary: {
      totalErrors: 0,
      totalWarnings: 0,
      totalNotes: 0,
      filesAffected: [],
    },
    metadata: {
      generatedBy: "contextflow",
    },
  };
}

// Re-export the raw JSON schema for consumers that need it
export { schema as diagnosticReportSchema };

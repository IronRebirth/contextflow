import { z } from 'zod';

// ── Diagnostic Severity ─────────────────────────────────────────────────────

export type DiagnosticSeverity = 'error' | 'warning' | 'note' | 'info';

// ── Diagnostic Entry ────────────────────────────────────────────────────────

export const DiagnosticEntrySchema = z.object({
  file: z.string(),
  line: z.number().int().nonnegative(),
  column: z.number().int().nonnegative().optional(),
  severity: z.enum(['error', 'warning', 'note', 'info']),
  message: z.string(),
  code: z.string().optional(),
  suggestion: z.string().optional(),
  source: z.string().optional(),
  context: z.string().optional(),
});

export type DiagnosticEntry = z.infer<typeof DiagnosticEntrySchema>;

// ── Diagnostic Report ───────────────────────────────────────────────────────

export const DiagnosticReportSchema = z.object({
  version: z.literal('1.0.0'),
  tool: z.literal('@contextflow/qnx-companion'),
  timestamp: z.string().datetime(),
  project: z.string().optional(),
  target: z.string().optional(),
  summary: z.object({
    total: z.number().int().nonnegative(),
    errors: z.number().int().nonnegative(),
    warnings: z.number().int().nonnegative(),
    notes: z.number().int().nonnegative(),
    infos: z.number().int().nonnegative(),
  }),
  diagnostics: z.array(DiagnosticEntrySchema),
  rawLog: z.string().optional(),
});

export type DiagnosticReport = z.infer<typeof DiagnosticReportSchema>;

// ── Build Result ────────────────────────────────────────────────────────────

export interface BuildResult {
  success: boolean;
  exitCode: number;
  stdout: string;
  stderr: string;
  durationMs: number;
  target: string;
  projectDir: string;
  dryRun: boolean;
  report: DiagnosticReport | null;
}

// ── Doctor Result ───────────────────────────────────────────────────────────

export type CheckStatus = 'pass' | 'fail' | 'warn';

export interface DoctorCheck {
  name: string;
  status: CheckStatus;
  message: string;
  detail?: string;
}

export interface DoctorResult {
  timestamp: string;
  healthy: boolean;
  degraded: boolean;
  checks: DoctorCheck[];
}

// ── QNX Environment ─────────────────────────────────────────────────────────

export interface QnxEnvironment {
  qnxHost: string | null;
  qnxTarget: string | null;
  sdpVersion: string | null;
  qccPath: string | null;
  mkifsPath: string | null;
  availableTargets: string[];
  installed: boolean;
}

// ── Output Format ───────────────────────────────────────────────────────────

export type OutputFormat = 'json' | 'text' | 'markdown';

import type { DiagnosticEntry, DiagnosticReport, DiagnosticSeverity } from '../types.js';

/**
 * Regex for GCC/qcc style diagnostic lines:
 *   file:line:col: severity: message
 *   file:line: severity: message
 */
const DIAG_REGEX =
  /^(.+?):(\d+):(?:(\d+):)?\s*(error|warning|note|info):\s*(.+)$/;

/**
 * Regex for linker errors:
 *   /path/to/ld: file: message
 */
const LINKER_REGEX =
  /^(.+?\/ld):\s*(.+?):\s*(.+)$/;

/**
 * Map of common QNX-specific error patterns to helpful suggestions.
 */
const QNX_SUGGESTIONS: Array<{ pattern: RegExp; suggestion: string }> = [
  {
    pattern: /cannot find -lsocket/i,
    suggestion: 'QNX uses -lsocket. Ensure QNX_TARGET is set and you are linking with the correct library path.',
  },
  {
    pattern: /sys\/neutrino\.h/i,
    suggestion: 'The header <sys/neutrino.h> is QNX-specific. Ensure QNX_TARGET is set and the include path contains $QNX_TARGET/usr/include.',
  },
  {
    pattern: /undefined reference to.*dispatch/i,
    suggestion: 'You may need to link with -ldispatch for resource manager dispatch functions.',
  },
  {
    pattern: /undefined reference to.*MsgSend/i,
    suggestion: 'QNX message passing APIs require linking against the C library with proper QNX target. Ensure you compile with qcc.',
  },
  {
    pattern: /implicit declaration of function/i,
    suggestion: 'Add the appropriate #include for this function. Use `qcc -Wall` to catch missing declarations.',
  },
  {
    pattern: /incompatible pointer type/i,
    suggestion: 'Check pointer types carefully. QNX 8.0 uses LP64 data model on 64-bit targets.',
  },
  {
    pattern: /unknown type name.*_Uint\d+t/i,
    suggestion: 'QNX legacy integer types (_Uint32t, etc.) require #include <sys/platform.h> or use standard <stdint.h> types instead.',
  },
  {
    pattern: /cannot find -l(\w+)/,
    suggestion: 'Library not found. Check that the library is available for your target architecture under $QNX_TARGET/$CPUVARDIR/usr/lib.',
  },
];

/**
 * Parse a single line of compiler output into a DiagnosticEntry, or null if not a diagnostic.
 */
export function parseDiagnosticLine(line: string): DiagnosticEntry | null {
  const match = line.match(DIAG_REGEX);
  if (match) {
    const [, file, lineStr, colStr, severity, message] = match;
    const entry: DiagnosticEntry = {
      file: file!,
      line: parseInt(lineStr!, 10),
      column: colStr ? parseInt(colStr, 10) : undefined,
      severity: severity as DiagnosticSeverity,
      message: message!,
      source: 'qcc',
    };

    // Try to match a QNX-specific suggestion
    for (const { pattern, suggestion } of QNX_SUGGESTIONS) {
      if (pattern.test(message!)) {
        entry.suggestion = suggestion;
        break;
      }
    }

    return entry;
  }

  // Try linker error format
  const linkerMatch = line.match(LINKER_REGEX);
  if (linkerMatch) {
    const [, , file, message] = linkerMatch;
    const entry: DiagnosticEntry = {
      file: file!,
      line: 0,
      severity: 'error',
      message: message!,
      source: 'ld',
    };

    for (const { pattern, suggestion } of QNX_SUGGESTIONS) {
      if (pattern.test(message!)) {
        entry.suggestion = suggestion;
        break;
      }
    }

    return entry;
  }

  return null;
}

/**
 * Parse a full compiler output (multi-line) into an array of DiagnosticEntry objects.
 */
export function parseCompilerOutput(output: string): DiagnosticEntry[] {
  const lines = output.split('\n');
  const diagnostics: DiagnosticEntry[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const entry = parseDiagnosticLine(trimmed);
    if (entry) {
      diagnostics.push(entry);
    }
  }

  return diagnostics;
}

/**
 * Build a complete DiagnosticReport directly from raw compiler output string.
 */
export function createDiagnosticReport(
  output: string,
  options?: {
    project?: string;
    target?: string;
    rawLog?: string;
  },
): DiagnosticReport {
  const diagnostics = parseCompilerOutput(output);
  return buildDiagnosticReport(diagnostics, options);
}

/**
 * Build a complete DiagnosticReport from parsed entries.
 */
export function buildDiagnosticReport(
  diagnostics: DiagnosticEntry[],
  options?: {
    project?: string;
    target?: string;
    rawLog?: string;
  },
): DiagnosticReport {
  const errors = diagnostics.filter((d) => d.severity === 'error').length;
  const warnings = diagnostics.filter((d) => d.severity === 'warning').length;
  const notes = diagnostics.filter((d) => d.severity === 'note').length;
  const infos = diagnostics.filter((d) => d.severity === 'info').length;

  return {
    version: '1.0.0',
    tool: '@contextflow/qnx-companion',
    timestamp: new Date().toISOString(),
    project: options?.project,
    target: options?.target,
    summary: {
      total: diagnostics.length,
      errors,
      warnings,
      notes,
      infos,
    },
    diagnostics,
    rawLog: options?.rawLog,
  };
}

/**
 * Format a DiagnosticReport as human-readable text.
 */
export function formatReportAsText(report: DiagnosticReport): string {
  const lines: string[] = [];

  lines.push(`Diagnostic Report - ${report.timestamp}`);
  if (report.project) lines.push(`Project: ${report.project}`);
  if (report.target) lines.push(`Target: ${report.target}`);
  lines.push('');
  lines.push(`Summary: ${report.summary.total} issues (${report.summary.errors} errors, ${report.summary.warnings} warnings, ${report.summary.notes} notes)`);
  lines.push('─'.repeat(60));
  lines.push('');

  for (const d of report.diagnostics) {
    const loc = d.column ? `${d.file}:${d.line}:${d.column}` : `${d.file}:${d.line}`;
    const sev = String(d.severity).toUpperCase();
    lines.push(`${sev}: ${loc}: ${d.message}`);
    if (d.suggestion) {
      lines.push(`  Suggestion: ${d.suggestion}`);
    }
  }

  return lines.join('\n');
}

/**
 * Format a DiagnosticReport as Markdown.
 */
export function formatReportAsMarkdown(report: DiagnosticReport): string {
  const lines: string[] = [];

  lines.push(`# Diagnostic Report`);
  lines.push('');
  lines.push(`**Generated:** ${report.timestamp}`);
  if (report.project) lines.push(`**Project:** ${report.project}`);
  if (report.target) lines.push(`**Target:** ${report.target}`);
  lines.push('');
  lines.push(`## Summary`);
  lines.push('');
  lines.push(`| Category | Count |`);
  lines.push(`|----------|-------|`);
  lines.push(`| Errors   | ${report.summary.errors} |`);
  lines.push(`| Warnings | ${report.summary.warnings} |`);
  lines.push(`| Notes    | ${report.summary.notes} |`);
  lines.push(`| **Total** | **${report.summary.total}** |`);
  lines.push('');

  if (report.diagnostics.length > 0) {
    lines.push(`## Diagnostics`);
    lines.push('');

    for (const d of report.diagnostics) {
      const loc = d.column ? `${d.file}:${d.line}:${d.column}` : `${d.file}:${d.line}`;
      const sev = String(d.severity).toUpperCase();
      lines.push(`### [${sev}]`);
      lines.push(`**Location:** \`${loc}\``);
      lines.push(`**Message:** ${d.message}`);
      if (d.suggestion) {
        lines.push(`> **Suggestion:** ${d.suggestion}`);
      }
      lines.push('');
    }
  }

  return lines.join('\n');
}

import { readFile, access, constants } from 'node:fs/promises';

export interface BuildfileEntry {
  type: 'file' | 'directory' | 'link' | 'script' | 'comment' | 'attribute' | 'unknown';
  raw: string;
  targetPath?: string;
  sourcePath?: string;
  permissions?: string;
  lineNumber: number;
}

export interface BuildfileParseResult {
  entries: BuildfileEntry[];
  errors: string[];
  warnings: string[];
  valid: boolean;
}

/**
 * Parse a QNX .build file (used by mkifs to create IFS images).
 *
 * The format is line-based:
 *   [attr] target_path = source_path
 *   [+raw] script content
 *   # comments
 */
export function parseBuildfile(content: string): BuildfileParseResult {
  const lines = content.split('\n');
  const entries: BuildfileEntry[] = [];
  const errors: string[] = [];
  const warnings: string[] = [];

  let inScript = false;

  for (let i = 0; i < lines.length; i++) {
    const lineNumber = i + 1;
    const raw = lines[i]!;
    const trimmed = raw.trim();

    // Skip empty lines
    if (!trimmed) continue;

    // Comment lines
    if (trimmed.startsWith('#')) {
      entries.push({ type: 'comment', raw, lineNumber });
      continue;
    }

    // Script blocks: lines starting with a shebang or inside [+script]
    if (inScript) {
      if (trimmed === '}') {
        inScript = false;
      }
      entries.push({ type: 'script', raw, lineNumber });
      continue;
    }

    // Attribute lines: [attr=value]
    if (trimmed.startsWith('[')) {
      const closeBracket = trimmed.indexOf(']');
      if (closeBracket === -1) {
        errors.push(`Line ${lineNumber}: Unclosed attribute bracket: ${trimmed}`);
        entries.push({ type: 'unknown', raw, lineNumber });
        continue;
      }

      const attr = trimmed.slice(1, closeBracket);

      // Check for script attribute
      if (attr.includes('+script') || attr.includes('+raw')) {
        inScript = true;
      }

      const remainder = trimmed.slice(closeBracket + 1).trim();
      if (remainder) {
        const parsed = parseFileLine(remainder, lineNumber);
        parsed.permissions = attr;
        parsed.raw = raw;
        entries.push(parsed);
      } else {
        entries.push({ type: 'attribute', raw, lineNumber, permissions: attr });
      }
      continue;
    }

    // File/directory mapping lines: target = host_path
    const parsed = parseFileLine(trimmed, lineNumber);
    parsed.raw = raw;
    entries.push(parsed);
  }

  if (inScript) {
    errors.push('Unterminated script block at end of file.');
  }

  return {
    entries,
    errors,
    warnings,
    valid: errors.length === 0,
  };
}

/**
 * Parse a file mapping line: target_path = host_path or just target_path
 */
function parseFileLine(line: string, lineNumber: number): BuildfileEntry {
  const equalsIndex = line.indexOf('=');

  if (equalsIndex !== -1) {
    const targetPath = line.slice(0, equalsIndex).trim();
    const sourcePath = line.slice(equalsIndex + 1).trim();
    return {
      type: sourcePath.endsWith('/') ? 'directory' : 'file',
      raw: line,
      targetPath: targetPath || undefined,
      sourcePath: sourcePath || undefined,
      lineNumber,
    };
  }

  // No equals sign — could be a simple path include
  return {
    type: 'file',
    raw: line,
    targetPath: line.trim(),
    lineNumber,
  };
}

/**
 * Validate a buildfile and return issues.
 */
export function validateBuildfile(content: string): { valid: boolean; issues: string[] } {
  const result = parseBuildfile(content);
  const issues = [...result.errors, ...result.warnings];

  // Check for common issues
  const hasBootstrap = result.entries.some(
    (e) => e.targetPath && (e.targetPath.includes('startup') || e.targetPath.includes('procnto')),
  );

  if (!hasBootstrap) {
    issues.push('Warning: No startup or procnto entry found. The IFS may not be bootable.');
  }

  return { valid: result.valid && issues.length === 0, issues };
}

/**
 * Load and parse a buildfile from disk.
 */
export async function loadBuildfile(filePath: string): Promise<BuildfileParseResult> {
  await access(filePath, constants.R_OK);
  const content = await readFile(filePath, 'utf-8');
  return parseBuildfile(content);
}

/**
 * Extract target configuration from parsed buildfile entries.
 */
export function extractTargetConfig(entries: BuildfileEntry[]): {
  files: string[];
  scripts: number;
  hasStartup: boolean;
  hasProcnto: boolean;
} {
  const files: string[] = [];
  let scripts = 0;
  let hasStartup = false;
  let hasProcnto = false;

  for (const entry of entries) {
    if (entry.type === 'file' && entry.targetPath) {
      files.push(entry.targetPath);
      if (entry.targetPath.includes('startup')) hasStartup = true;
      if (entry.targetPath.includes('procnto')) hasProcnto = true;
    }
    if (entry.type === 'script') scripts++;
  }

  return { files, scripts, hasStartup, hasProcnto };
}

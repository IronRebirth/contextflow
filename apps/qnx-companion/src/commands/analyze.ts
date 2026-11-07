import { readFile, writeFile, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import chalk from 'chalk';
import {
  createDiagnosticReport,
  formatReportAsMarkdown,
  formatReportAsText,
} from '../qnx/diagnostics.js';
import type { DiagnosticReport, OutputFormat } from '../types.js';
import { logger } from '../utils/logger.js';

async function readStream(stream: NodeJS.ReadStream): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks).toString('utf-8');
}

export interface AnalyzeOptions {
  format?: OutputFormat;
  json?: boolean;
  output?: string;
  project?: string;
  target?: string;
}

export async function runAnalyze(
  targetPath?: string,
  options: AnalyzeOptions = {},
): Promise<DiagnosticReport> {
  let logContent = '';
  let project = options.project || 'qnx-project';

  if (!targetPath || targetPath === '-') {
    // Read from standard input
    if (process.stdin.isTTY && !targetPath) {
      throw new Error('Please specify a build log file or pipe build output to stdin.');
    }
    logContent = await readStream(process.stdin);
  } else {
    const fullPath = resolve(targetPath);
    try {
      const stats = await stat(fullPath);
      if (stats.isDirectory()) {
        project = fullPath;
        // Check if there's a build-errors.log or build.log in the directory
        const candidateFiles = [
          'build-errors.log',
          'build.log',
          'build/x86_64/build-errors.log',
          'build/aarch64/build-errors.log',
        ];
        let foundLog = false;
        for (const candidate of candidateFiles) {
          try {
            logContent = await readFile(resolve(fullPath, candidate), 'utf-8');
            foundLog = true;
            logger.info(`Analyzing log found at ${candidate}`);
            break;
          } catch {
            // keep searching
          }
        }
        if (!foundLog) {
          throw new Error(
            `No build log file found in directory ${targetPath}. Please provide the path to a compiler log or run 'contextflow-qnx build'.`,
          );
        }
      } else {
        logContent = await readFile(fullPath, 'utf-8');
      }
    } catch (err: any) {
      throw new Error(`Failed to read target path: ${err.message}`);
    }
  }

  // Generate structured report
  const report = createDiagnosticReport(logContent, {
    project,
    target: options.target ?? 'x86_64',
    rawLog: logContent,
  });

  const format = options.json ? 'json' : options.format ?? 'text';

  let formattedOutput = '';
  if (format === 'json') {
    formattedOutput = JSON.stringify(report, null, 2);
  } else if (format === 'markdown') {
    formattedOutput = formatReportAsMarkdown(report);
  } else {
    formattedOutput = formatReportAsText(report);
  }

  // Write to output file if requested
  if (options.output) {
    const outPath = resolve(options.output);
    await writeFile(outPath, formattedOutput, 'utf-8');
    logger.success(`Diagnostic report written to ${outPath}`);
  } else {
    console.log(formattedOutput);
  }

  return report;
}


import { spawn } from 'node:child_process';
import { access, constants, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import chalk from 'chalk';
import { detectQnxSdp, getQnxBuildEnv } from '../qnx/compiler.js';
import { createDiagnosticReport, formatReportAsText } from '../qnx/diagnostics.js';
import type { BuildResult, DiagnosticReport } from '../types.js';
import { logger } from '../utils/logger.js';

export interface BuildOptions {
  target?: string;
  dryRun?: boolean;
  clean?: boolean;
  output?: string;
  json?: boolean;
}

export async function runBuild(
  projectDir?: string,
  options: BuildOptions = {},
): Promise<BuildResult> {
  const target = options.target ?? 'x86_64';
  const dir = resolve(projectDir ?? process.cwd());
  const startTime = Date.now();

  logger.info(`ContextFlow QNX Build targeting [${chalk.cyan(target)}]`);
  logger.info(`Project path: ${dir}`);

  // Check if Makefile exists
  const makefilePath = join(dir, 'Makefile');
  let hasMakefile = false;
  try {
    await access(makefilePath, constants.R_OK);
    hasMakefile = true;
  } catch {
    hasMakefile = false;
  }

  const qnxEnv = await detectQnxSdp();

  // If dry-run requested or QNX is not installed, provide clean simulated/dry-run execution
  if (options.dryRun || !qnxEnv.installed) {
    if (!qnxEnv.installed && !options.dryRun) {
      logger.warn('QNX SDP not detected on this host. Falling back to dry-run demonstration mode.');
    } else {
      logger.info('Dry-run requested. Simulating QNX build invocation.');
    }

    const simulatedCmd = `qcc -V gcc_nto${target} -Wall -Wextra -g -o build/${target}/app src/main.c`;
    console.log('\n' + chalk.bold('Simulated Command Pipeline:'));
    console.log(`  ${chalk.cyan('$')} ${simulatedCmd}`);
    console.log(`  ${chalk.dim('Environment:')} QNX_HOST=${qnxEnv.qnxHost ?? '/opt/qnx800/host/linux/x86_64'}`);
    console.log(`  ${chalk.dim('Environment:')} QNX_TARGET=${qnxEnv.qnxTarget ?? '/opt/qnx800/target/qnx'}\n`);

    const result: BuildResult = {
      success: true,
      exitCode: 0,
      stdout: `[DRY-RUN] Would execute: ${simulatedCmd}\n`,
      stderr: '',
      durationMs: Date.now() - startTime,
      target,
      projectDir: dir,
      dryRun: true,
      report: null,
    };

    if (options.json) {
      console.log(JSON.stringify(result, null, 2));
    }
    return result;
  }

  // Real QNX Build Execution
  const buildEnv = getQnxBuildEnv(qnxEnv, target);
  const makeArgs = [`TARGET=${target}`];
  if (options.clean) {
    makeArgs.unshift('clean');
  }

  logger.info(`Running build: make ${makeArgs.join(' ')}`);

  return new Promise((resolveResult) => {
    const proc = spawn('make', makeArgs, {
      cwd: dir,
      env: { ...process.env, ...buildEnv },
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data) => {
      const text = data.toString();
      stdout += text;
      if (!options.json) process.stdout.write(text);
    });

    proc.stderr.on('data', (data) => {
      const text = data.toString();
      stderr += text;
      if (!options.json) process.stderr.write(chalk.red(text));
    });

    proc.on('close', async (code) => {
      const exitCode = code ?? 0;
      const combinedOutput = stdout + '\n' + stderr;
      const durationMs = Date.now() - startTime;

      // Generate structured diagnostic report
      const report = createDiagnosticReport(combinedOutput, {
        project: dir,
        target,
        rawLog: combinedOutput,
      });

      const result: BuildResult = {
        success: exitCode === 0 && report.summary.errors === 0,
        exitCode,
        stdout,
        stderr,
        durationMs,
        target,
        projectDir: dir,
        dryRun: false,
        report,
      };

      if (options.output) {
        const outPath = resolve(options.output);
        await writeFile(outPath, JSON.stringify(report, null, 2), 'utf-8');
        logger.success(`Diagnostic report saved to ${outPath}`);
      }

      if (options.json) {
        console.log(JSON.stringify(result, null, 2));
      } else {
        console.log('\n' + chalk.bold('Build Summary:'));
        if (result.success) {
          console.log(chalk.green(`[OK] Build SUCCEEDED in ${durationMs}ms with 0 errors`));
        } else {
          console.log(
            chalk.red(
              `[FAILED] Build FAILED with ${report.summary.errors} error(s) and ${report.summary.warnings} warning(s)`,
            ),
          );
        }
      }

      resolveResult(result);
    });
  });
}


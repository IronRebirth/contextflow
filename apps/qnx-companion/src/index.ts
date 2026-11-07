#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import { runDoctor } from './commands/doctor.js';
import { runAnalyze } from './commands/analyze.js';
import { runBuild } from './commands/build.js';
import { runPublish } from './commands/publish.js';
import { setLogLevel } from './utils/logger.js';

const program = new Command();

program
  .name('contextflow-qnx')
  .description('ContextFlow QNX Companion - Engineering context and build diagnostics for QNX 8.0 & Atlassian Jira')
  .version('0.1.0')
  .option('-q, --quiet', 'Suppress non-essential logging output', () => setLogLevel('error'))
  .option('--debug', 'Enable debug logging', () => setLogLevel('debug'));

// ── Command: doctor ──────────────────────────────────────────────────────────
program
  .command('doctor')
  .description('Check QNX SDP 8.0 environment variables, compilers, tools, and Forge readiness')
  .option('--json', 'Output results as machine-readable JSON')
  .action(async (options) => {
    try {
      await runDoctor(options);
    } catch (err: any) {
      console.error(chalk.red(`Doctor check failed: ${err.message}`));
      process.exit(1);
    }
  });

// ── Command: analyze ─────────────────────────────────────────────────────────
program
  .command('analyze [target]')
  .description('Analyze a build log or project directory to extract structured QNX diagnostics')
  .option('-f, --format <format>', 'Output format: text, markdown, or json', 'text')
  .option('-o, --output <file>', 'Write report to destination file')
  .option('-t, --target <arch>', 'Target architecture (e.g. x86_64, aarch64)', 'x86_64')
  .option('-p, --project <name>', 'Project name or path')
  .option('--json', 'Equivalent to --format json')
  .action(async (target, options) => {
    try {
      await runAnalyze(target, options);
    } catch (err: any) {
      console.error(chalk.red(`Analysis failed: ${err.message}`));
      process.exit(1);
    }
  });

// ── Command: build ───────────────────────────────────────────────────────────
program
  .command('build [dir]')
  .description('Invoke QNX build system (qcc/make) and capture structured diagnostics')
  .option('-t, --target <arch>', 'Target architecture (x86_64, aarch64)', 'x86_64')
  .option('-d, --dry-run', 'Simulate build without executing compiler commands')
  .option('-c, --clean', 'Run clean target before building')
  .option('-o, --output <file>', 'Write generated diagnostic report JSON to file')
  .option('--json', 'Output build result as machine-readable JSON')
  .action(async (dir, options) => {
    try {
      const res = await runBuild(dir, options);
      if (!res.success && !options.dryRun) {
        process.exit(1);
      }
    } catch (err: any) {
      console.error(chalk.red(`Build failed: ${err.message}`));
      process.exit(1);
    }
  });

// ── Command: publish ─────────────────────────────────────────────────────────
program
  .command('publish [report]')
  .description('Publish diagnostic report to an Atlassian Jira issue as structured evidence')
  .option('-i, --issue-key <key>', 'Target Jira issue key (e.g. PROJ-101)')
  .option('-u, --base-url <url>', 'Jira Cloud base URL')
  .option('-e, --email <email>', 'Atlassian account email')
  .option('-k, --api-token <token>', 'Atlassian API token')
  .option('-d, --dry-run', 'Generate and display Atlassian Document Format (ADF) payload without sending')
  .option('--json', 'Output results as JSON')
  .action(async (report, options) => {
    try {
      await runPublish(report || '-', options);
    } catch (err: any) {
      console.error(chalk.red(`Publish failed: ${err.message}`));
      process.exit(1);
    }
  });

program.parse(process.argv);


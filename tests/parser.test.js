import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Import compiled or source module
import { parseCompilerOutput, buildDiagnosticReport } from '../apps/qnx-companion/src/qnx/diagnostics.ts';

test('QNX Diagnostic Parser extracts compiler errors correctly', () => {
  const sampleLogPath = resolve('examples/qnx-hello/sample-build-output/failed-build.log');
  const logContent = readFileSync(sampleLogPath, 'utf-8');

  const diagnostics = parseCompilerOutput(logContent);
  assert.ok(diagnostics.length > 0, 'Should find diagnostic entries in log');

  const errors = diagnostics.filter((d) => d.severity === 'error');
  const warnings = diagnostics.filter((d) => d.severity === 'warning');

  assert.equal(errors.length, 7, 'Should parse exactly 7 errors');
  assert.equal(warnings.length, 2, 'Should parse exactly 2 warnings');

  // Verify intelligent suggestion is populated for missing function / declaration
  const pthreadDiag = diagnostics.find((d) => d.message.includes('pthread_create'));
  assert.ok(pthreadDiag, 'Should find pthread_create diagnostic');
  assert.ok(pthreadDiag.suggestion, 'Should provide actionable suggestion');
});

test('Diagnostic Report builder calculates summaries accurately', () => {
  const sampleLogPath = resolve('examples/qnx-hello/sample-build-output/failed-build.log');
  const logContent = readFileSync(sampleLogPath, 'utf-8');

  const diagnostics = parseCompilerOutput(logContent);
  const report = buildDiagnosticReport(diagnostics, {
    project: 'test-project',
    target: 'x86_64',
  });

  assert.equal(report.version, '1.0.0');
  assert.equal(report.project, 'test-project');
  assert.equal(report.target, 'x86_64');
  assert.equal(report.summary.errors, 7);
  assert.equal(report.summary.warnings, 2);
  assert.equal(report.summary.total, 10);
});

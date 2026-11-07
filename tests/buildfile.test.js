import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { parseBuildfile } from '../apps/qnx-companion/src/qnx/buildfile.ts';

test('QNX Buildfile parser parses IFS specification correctly', () => {
  const buildfilePath = resolve('examples/qnx-hello/qnx-hello.build');
  const content = readFileSync(buildfilePath, 'utf-8');

  const result = parseBuildfile(content);
  assert.equal(result.valid, true, 'Buildfile should be marked valid');
  assert.ok(result.entries.length > 0, 'Should extract entries');

  // Verify bootstrap attributes
  const bootstrap = result.entries.find((e) => e.raw.includes('virtual=x86_64'));
  assert.ok(bootstrap, 'Should parse bootstrap attribute line');

  // Verify application mapping
  const appMapping = result.entries.find((e) => e.targetPath === '/proc/boot/contextflow-hello');
  assert.ok(appMapping, 'Should parse application target mapping');
  assert.equal(appMapping?.sourcePath, 'build/x86_64/contextflow-hello');
});


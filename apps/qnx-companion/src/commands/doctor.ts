import os from 'node:os';
import { execFile } from 'node:child_process';
import chalk from 'chalk';
import { detectQnxSdp } from '../qnx/compiler.js';
import type { CheckStatus, DoctorCheck, DoctorResult } from '../types.js';
import { logger } from '../utils/logger.js';

function checkCommand(commandName: string): Promise<boolean> {
  return new Promise((resolve) => {
    execFile('which', [commandName], (err, stdout) => {
      resolve(!err && stdout.trim().length > 0);
    });
  });
}

export async function runDoctor(options: { json?: boolean } = {}): Promise<DoctorResult> {
  const checks: DoctorCheck[] = [];

  // 1. Host System Architecture
  const hostArch = os.arch();
  const hostPlatform = os.platform();
  const isArmMac = hostPlatform === 'darwin' && hostArch === 'arm64';

  if (isArmMac) {
    checks.push({
      name: 'Development Host Platform',
      status: 'warn',
      message: `macOS ARM64 (${hostPlatform}/${hostArch})`,
      detail:
        'QNX SDP 8.0 requires an x86-64 Linux (Ubuntu) or Windows host. On Apple Silicon, develop Forge locally and use a remote x86-64 Linux environment or VM for the QNX toolchain.',
    });
  } else if (hostPlatform === 'linux' && hostArch === 'x64') {
    checks.push({
      name: 'Development Host Platform',
      status: 'pass',
      message: `Supported QNX Host: Linux x86_64 (${os.release()})`,
    });
  } else {
    checks.push({
      name: 'Development Host Platform',
      status: 'warn',
      message: `${hostPlatform} ${hostArch}`,
      detail: 'QNX SDP 8.0 officially supports Ubuntu x86-64 and Windows x86-64 development hosts.',
    });
  }

  // 2. Node.js Environment
  const nodeVer = process.version;
  const majorNode = parseInt(nodeVer.replace('v', '').split('.')[0] ?? '0', 10);
  if (majorNode >= 18) {
    checks.push({
      name: 'Node.js Runtime',
      status: 'pass',
      message: `${nodeVer} (Node.js 18+ requirement met)`,
    });
  } else {
    checks.push({
      name: 'Node.js Runtime',
      status: 'fail',
      message: `${nodeVer} is outdated`,
      detail: 'ContextFlow requires Node.js 18.x, 20.x, or 22.x+.',
    });
  }

  // 3. QNX SDP Detection
  const qnxEnv = await detectQnxSdp();

  if (qnxEnv.qnxHost) {
    checks.push({
      name: 'QNX_HOST Environment Variable',
      status: 'pass',
      message: qnxEnv.qnxHost,
    });
  } else {
    checks.push({
      name: 'QNX_HOST Environment Variable',
      status: 'fail',
      message: 'Not set',
      detail: 'Set QNX_HOST pointing to your QNX SDP host installation (e.g. $HOME/qnx800/host/linux/x86_64).',
    });
  }

  if (qnxEnv.qnxTarget) {
    checks.push({
      name: 'QNX_TARGET Environment Variable',
      status: 'pass',
      message: qnxEnv.qnxTarget,
    });
  } else {
    checks.push({
      name: 'QNX_TARGET Environment Variable',
      status: 'fail',
      message: 'Not set',
      detail: 'Set QNX_TARGET pointing to your QNX SDP target directory (e.g. $HOME/qnx800/target/qnx).',
    });
  }

  // 4. QNX Compiler (qcc)
  if (qnxEnv.qccPath) {
    checks.push({
      name: 'QNX qcc Compiler',
      status: 'pass',
      message: `Found at ${qnxEnv.qccPath} (${qnxEnv.sdpVersion || 'version detected'})`,
    });
  } else {
    checks.push({
      name: 'QNX qcc Compiler',
      status: 'fail',
      message: 'qcc not found in PATH or QNX_HOST',
      detail: 'Install QNX SDP 8.0 and source qnxsdp-env.sh to add qcc to PATH.',
    });
  }

  // 5. QNX mkifs Image Builder
  if (qnxEnv.mkifsPath) {
    checks.push({
      name: 'QNX mkifs Tool',
      status: 'pass',
      message: `Found at ${qnxEnv.mkifsPath}`,
    });
  } else {
    checks.push({
      name: 'QNX mkifs Tool',
      status: 'warn',
      message: 'mkifs not found',
      detail: 'mkifs creates IFS boot images for QEMU/hardware. Required for target testing.',
    });
  }

  // 6. QEMU Emulator
  const hasQemu = await checkCommand('qemu-system-x86_64');
  if (hasQemu) {
    checks.push({
      name: 'QEMU x86_64 Emulator',
      status: 'pass',
      message: 'qemu-system-x86_64 is available for virtual QNX target testing',
    });
  } else {
    checks.push({
      name: 'QEMU x86_64 Emulator',
      status: 'warn',
      message: 'qemu-system-x86_64 not found',
      detail: 'Optional but recommended for testing QNX binaries without physical hardware.',
    });
  }

  // 7. Atlassian Forge CLI
  const hasForge = await checkCommand('forge');
  if (hasForge) {
    checks.push({
      name: 'Atlassian Forge CLI',
      status: 'pass',
      message: 'Forge CLI is available for Atlassian Cloud deployments',
    });
  } else {
    checks.push({
      name: 'Atlassian Forge CLI',
      status: 'warn',
      message: 'forge command not found in PATH',
      detail: 'Install globally with: npm install -g @forge/cli',
    });
  }

  // Evaluate Overall Health
  const hasFails = checks.some((c) => c.status === 'fail');
  const hasWarns = checks.some((c) => c.status === 'warn');
  const healthy = !hasFails && !hasWarns;
  const degraded = hasFails || hasWarns;

  const result: DoctorResult = {
    timestamp: new Date().toISOString(),
    healthy,
    degraded,
    checks,
  };

  if (options.json) {
    console.log(JSON.stringify(result, null, 2));
    return result;
  }

  // Colored Console Display
  console.log('\n' + chalk.bold.cyan('ContextFlow QNX Environment Doctor'));
  console.log(chalk.dim('Checking host environment, QNX 8.0 SDP toolchain, and Forge requirements...\n'));

  for (const check of checks) {
    let icon = chalk.green('[PASS]');
    if (check.status === 'fail') icon = chalk.red('[FAIL]');
    if (check.status === 'warn') icon = chalk.yellow('[WARN]');

    console.log(`  ${icon}  ${chalk.bold(check.name)}: ${check.message}`);
    if (check.detail) {
      console.log(`         ${chalk.dim(check.detail)}`);
    }
  }

  console.log('');
  if (healthy) {
    console.log(chalk.bold.green('[OK] All checks passed. Environment is ready for QNX 8.0 builds and Jira publishing.'));
  } else if (degraded && !hasFails) {
    console.log(chalk.bold.yellow('[WARN] System is ready with warnings. QNX analysis and Forge integration work.'));
  } else {
    console.log(chalk.bold.yellow('[INFO] ContextFlow running in Degraded/Demonstration Mode.'));
    console.log(chalk.dim('  You can still parse compiler logs, generate diagnostic schemas, and preview Jira reports.'));
    console.log(chalk.dim('  To run real QNX builds, point QNX_HOST/QNX_TARGET to an Ubuntu x86-64 machine with SDP 8.0.'));
  }
  console.log('');

  return result;
}


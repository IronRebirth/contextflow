import { execFile } from 'node:child_process';
import { access, constants } from 'node:fs/promises';
import { join } from 'node:path';
import type { QnxEnvironment } from '../types.js';

/**
 * Try to resolve a binary path, returning null if not found.
 */
async function which(binary: string): Promise<string | null> {
  return new Promise((resolve) => {
    execFile('which', [binary], (err, stdout) => {
      if (err) {
        resolve(null);
      } else {
        resolve(stdout.trim() || null);
      }
    });
  });
}

/**
 * Check if a file exists and is executable.
 */
async function isExecutable(filePath: string): Promise<boolean> {
  try {
    await access(filePath, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

/**
 * Detect the QNX SDP installation from environment variables.
 */
export async function detectQnxSdp(): Promise<QnxEnvironment> {
  const qnxHost = process.env['QNX_HOST'] ?? null;
  const qnxTarget = process.env['QNX_TARGET'] ?? null;

  let qccPath: string | null = null;
  let mkifsPath: string | null = null;

  // Try QNX_HOST/usr/bin first, then PATH
  if (qnxHost) {
    const hostQcc = join(qnxHost, 'usr', 'bin', 'qcc');
    if (await isExecutable(hostQcc)) {
      qccPath = hostQcc;
    }
    const hostMkifs = join(qnxHost, 'usr', 'bin', 'mkifs');
    if (await isExecutable(hostMkifs)) {
      mkifsPath = hostMkifs;
    }
  }

  if (!qccPath) {
    qccPath = await which('qcc');
  }
  if (!mkifsPath) {
    mkifsPath = await which('mkifs');
  }

  const sdpVersion = qccPath ? await getQccVersion(qccPath) : null;
  const availableTargets = qnxTarget ? await detectTargetArchitectures(qnxTarget) : [];

  return {
    qnxHost,
    qnxTarget,
    sdpVersion,
    qccPath,
    mkifsPath,
    availableTargets,
    installed: qccPath !== null,
  };
}

/**
 * Extract the QNX qcc compiler version string.
 */
export async function getQccVersion(qccPath: string): Promise<string | null> {
  return new Promise((resolve) => {
    execFile(qccPath, ['-V'], (err, _stdout, stderr) => {
      if (err) {
        resolve(null);
        return;
      }
      // qcc prints version info to stderr
      const output = stderr || _stdout;
      const match = output.match(/QNX\s+(\S+)/i) ?? output.match(/(\d+\.\d+\.\d+)/);
      resolve(match ? match[1]! : output.trim().split('\n')[0] ?? null);
    });
  });
}

/**
 * Detect available target architectures under QNX_TARGET.
 */
async function detectTargetArchitectures(qnxTarget: string): Promise<string[]> {
  const knownTargets = ['x86_64', 'aarch64', 'armv7'];
  const available: string[] = [];

  for (const target of knownTargets) {
    try {
      await access(join(qnxTarget, target), constants.R_OK);
      available.push(target);
    } catch {
      // Target arch not installed
    }
  }

  return available;
}

/**
 * Invoke the qcc compiler with given arguments.
 * Returns { exitCode, stdout, stderr }.
 */
export function invokeQcc(
  qccPath: string,
  args: string[],
  options?: { cwd?: string; env?: Record<string, string> },
): Promise<{ exitCode: number; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const proc = execFile(
      qccPath,
      args,
      {
        cwd: options?.cwd,
        env: { ...process.env, ...options?.env },
        maxBuffer: 10 * 1024 * 1024,
      },
      (err, stdout, stderr) => {
        resolve({
          exitCode: err && 'code' in err ? (err.code as number) : proc.exitCode ?? 0,
          stdout: stdout ?? '',
          stderr: stderr ?? '',
        });
      },
    );
  });
}

/**
 * Get the QNX environment variables needed for a build.
 */
export function getQnxBuildEnv(
  env: QnxEnvironment,
  target: string,
): Record<string, string> {
  const buildEnv: Record<string, string> = {};

  if (env.qnxHost) buildEnv['QNX_HOST'] = env.qnxHost;
  if (env.qnxTarget) buildEnv['QNX_TARGET'] = env.qnxTarget;
  if (env.qccPath) buildEnv['CC'] = env.qccPath;

  // Set platform/target vars commonly used by QNX recursive make
  buildEnv['CPUVARDIR'] = target;
  buildEnv['CPU'] = target;

  return buildEnv;
}

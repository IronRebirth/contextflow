import chalk from 'chalk';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'silent';

const LOG_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  silent: 4,
};

let currentLevel: LogLevel = 'info';

/**
 * Set the global log level.
 */
export function setLogLevel(level: LogLevel): void {
  currentLevel = level;
}

/**
 * Get the current global log level.
 */
export function getLogLevel(): LogLevel {
  return currentLevel;
}

function shouldLog(level: LogLevel): boolean {
  return LOG_PRIORITY[level] >= LOG_PRIORITY[currentLevel];
}

/**
 * Logger utility with colored, severity-based console output.
 */
export const logger = {
  debug(msg: string, ...args: unknown[]): void {
    if (shouldLog('debug')) {
      console.log(chalk.dim(`[DEBUG] ${msg}`), ...args);
    }
  },

  info(msg: string, ...args: unknown[]): void {
    if (shouldLog('info')) {
      console.log(chalk.blue('[INFO]'), msg, ...args);
    }
  },

  success(msg: string, ...args: unknown[]): void {
    if (shouldLog('info')) {
      console.log(chalk.green('[OK]'), msg, ...args);
    }
  },

  warn(msg: string, ...args: unknown[]): void {
    if (shouldLog('warn')) {
      console.warn(chalk.yellow('[WARN]'), chalk.yellow(msg), ...args);
    }
  },

  error(msg: string, ...args: unknown[]): void {
    if (shouldLog('error')) {
      console.error(chalk.red('[ERROR]'), chalk.red(msg), ...args);
    }
  },

  /** Print a doctor-style check result line. */
  check(status: 'pass' | 'fail' | 'warn', name: string, message: string): void {
    const icon =
      status === 'pass'
        ? chalk.green('[PASS]')
        : status === 'fail'
          ? chalk.red('[FAIL]')
          : chalk.yellow('[WARN]');
    console.log(`  ${icon}  ${chalk.bold(name)}: ${message}`);
  },

  /** Print a section header. */
  header(title: string): void {
    console.log();
    console.log(chalk.bold.underline(title));
    console.log();
  },

  /** Print a blank line. */
  blank(): void {
    console.log();
  },

  /** Print raw text (respects silent mode). */
  raw(text: string): void {
    if (shouldLog('info')) {
      process.stdout.write(text);
    }
  },
};

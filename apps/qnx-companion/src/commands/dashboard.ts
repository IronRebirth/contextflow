import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import chalk from 'chalk';
import { createDiagnosticReport } from '../qnx/diagnostics.js';
import type { DiagnosticReport } from '../types.js';
import { logger } from '../utils/logger.js';

const execAsync = promisify(exec);

export interface DashboardOptions {
  open?: boolean;
  output?: string;
  target?: string;
  project?: string;
  port?: number;
}

export function generateDashboardHtml(report: DiagnosticReport): string {
  const diagnostics = report.diagnostics || [];
  const errors = diagnostics.filter((d) => d.severity === 'error');
  const warnings = diagnostics.filter((d) => d.severity === 'warning');
  const notes = diagnostics.filter((d) => d.severity === 'note');

  const itemsJson = JSON.stringify(diagnostics);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ContextFlow - QNX 8.0 Diagnostic Dashboard</title>
  <style>
    :root {
      --bg: #0d1117;
      --panel: #161b22;
      --border: #30363d;
      --text: #e6edf3;
      --text-muted: #8b949e;
      --error: #f85149;
      --error-bg: rgba(248, 81, 73, 0.15);
      --warn: #d29922;
      --warn-bg: rgba(210, 153, 34, 0.15);
      --info: #58a6ff;
      --info-bg: rgba(88, 166, 255, 0.15);
      --success: #3fb950;
      --success-bg: rgba(63, 185, 80, 0.15);
      --accent: #1f6feb;
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background: var(--bg);
      color: var(--text);
      line-height: 1.5;
      padding: 24px;
    }

    .container {
      max-width: 1200px;
      margin: 0 auto;
    }

    header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding-bottom: 20px;
      border-bottom: 1px solid var(--border);
      margin-bottom: 24px;
      flex-wrap: wrap;
      gap: 16px;
    }

    .brand {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .brand-title {
      font-size: 24px;
      font-weight: 700;
      letter-spacing: -0.5px;
    }

    .badges {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }

    .badge {
      display: inline-block;
      padding: 4px 10px;
      border-radius: 12px;
      font-size: 12px;
      font-weight: 600;
      background: var(--panel);
      border: 1px solid var(--border);
      color: var(--text-muted);
    }

    .badge.qnx {
      border-color: #e02424;
      color: #ff6b6b;
      background: rgba(224, 36, 36, 0.1);
    }

    .badge.forge {
      border-color: #0052cc;
      color: #58a6ff;
      background: rgba(0, 82, 204, 0.15);
    }

    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 16px;
      margin-bottom: 24px;
    }

    .card {
      background: var(--panel);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 16px 20px;
    }

    .stat-label {
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: var(--text-muted);
      margin-bottom: 6px;
    }

    .stat-value {
      font-size: 32px;
      font-weight: 700;
      line-height: 1;
    }

    .stat-value.error { color: var(--error); }
    .stat-value.warn { color: var(--warn); }
    .stat-value.info { color: var(--info); }
    .stat-value.success { color: var(--success); }

    .jira-banner {
      background: rgba(0, 82, 204, 0.1);
      border: 1px solid rgba(88, 166, 255, 0.3);
      border-radius: 8px;
      padding: 16px 20px;
      margin-bottom: 24px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 16px;
    }

    .jira-info h4 {
      font-size: 15px;
      font-weight: 600;
      margin-bottom: 4px;
      color: #58a6ff;
    }

    .jira-info p {
      font-size: 13px;
      color: var(--text-muted);
    }

    .btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 8px 14px;
      border-radius: 6px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      text-decoration: none;
      border: 1px solid var(--border);
      background: var(--panel);
      color: var(--text);
      transition: all 0.15s ease;
    }

    .btn:hover {
      background: #21262d;
      border-color: #8b949e;
    }

    .btn-primary {
      background: var(--accent);
      border-color: var(--accent);
      color: #ffffff;
    }

    .btn-primary:hover {
      background: #388bfd;
    }

    .filter-bar {
      display: flex;
      gap: 8px;
      margin-bottom: 16px;
      flex-wrap: wrap;
    }

    .filter-btn {
      padding: 6px 14px;
      border-radius: 20px;
      font-size: 13px;
      font-weight: 600;
      border: 1px solid var(--border);
      background: transparent;
      color: var(--text-muted);
      cursor: pointer;
    }

    .filter-btn.active {
      background: var(--panel);
      color: var(--text);
      border-color: var(--text-muted);
    }

    .diagnostics-list {
      display: flex;
      flex-direction: column;
      gap: 12px;
      margin-bottom: 32px;
    }

    .diag-card {
      background: var(--panel);
      border: 1px solid var(--border);
      border-left: 4px solid var(--border);
      border-radius: 6px;
      padding: 16px;
    }

    .diag-card.error { border-left-color: var(--error); }
    .diag-card.warning { border-left-color: var(--warn); }
    .diag-card.note { border-left-color: var(--info); }

    .diag-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;
      gap: 12px;
    }

    .diag-loc {
      font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace;
      font-size: 13px;
      color: #58a6ff;
    }

    .diag-badge {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
    }

    .diag-badge.error { background: var(--error-bg); color: var(--error); }
    .diag-badge.warning { background: var(--warn-bg); color: var(--warn); }
    .diag-badge.note { background: var(--info-bg); color: var(--info); }

    .diag-message {
      font-size: 14px;
      font-weight: 500;
      margin-bottom: 8px;
    }

    .diag-code {
      background: #0d1117;
      border: 1px solid var(--border);
      border-radius: 4px;
      padding: 8px 12px;
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      font-size: 12px;
      margin-bottom: 8px;
      overflow-x: auto;
      color: #79c0ff;
    }

    .diag-suggestion {
      background: rgba(63, 185, 80, 0.1);
      border: 1px solid rgba(63, 185, 80, 0.25);
      border-radius: 4px;
      padding: 8px 12px;
      font-size: 13px;
      color: #7ee787;
    }

    .diag-suggestion strong {
      color: #a5d6ff;
    }

    footer {
      border-top: 1px solid var(--border);
      padding-top: 16px;
      display: flex;
      justify-content: space-between;
      font-size: 12px;
      color: var(--text-muted);
      flex-wrap: wrap;
      gap: 12px;
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <div class="brand">
        <div class="brand-title">ContextFlow Diagnostic Visualizer</div>
      </div>
      <div class="badges">
        <span class="badge qnx">QNX SDP 8.0</span>
        <span class="badge forge">Atlassian Forge</span>
        <span class="badge">Target: ${report.target || 'x86_64'}</span>
        <span class="badge">Project: ${report.project || 'qnx-project'}</span>
      </div>
    </header>

    <div class="stats-grid">
      <div class="card">
        <div class="stat-label">Total Diagnostics</div>
        <div class="stat-value">${diagnostics.length}</div>
      </div>
      <div class="card">
        <div class="stat-label">Errors</div>
        <div class="stat-value error">${errors.length}</div>
      </div>
      <div class="card">
        <div class="stat-label">Warnings</div>
        <div class="stat-value warn">${warnings.length}</div>
      </div>
      <div class="card">
        <div class="stat-label">Notes</div>
        <div class="stat-value info">${notes.length}</div>
      </div>
    </div>

    <div class="jira-banner">
      <div class="jira-info">
        <h4>Connected Jira Issue: CS-1</h4>
        <p>Live sync to Atlassian Cloud. Diagnostic reports published and accessible to Atlassian Rovo AI.</p>
      </div>
      <div style="display:flex; gap:8px;">
        <a href="https://one-atlas-kxer.atlassian.net/browse/CS-1" target="_blank" class="btn btn-primary">Open in Jira</a>
        <button onclick="copyRovoPrompt()" class="btn">Copy Rovo Prompt</button>
      </div>
    </div>

    <div class="filter-bar">
      <button class="filter-btn active" onclick="filterDiag('all')">All (${diagnostics.length})</button>
      <button class="filter-btn" onclick="filterDiag('error')">Errors (${errors.length})</button>
      <button class="filter-btn" onclick="filterDiag('warning')">Warnings (${warnings.length})</button>
      <button class="filter-btn" onclick="filterDiag('note')">Notes (${notes.length})</button>
    </div>

    <div id="diagnostics-container" class="diagnostics-list">
      ${diagnostics.map((d) => `
        <div class="diag-card ${d.severity}" data-severity="${d.severity}">
          <div class="diag-header">
            <span class="diag-loc">${d.file}:${d.line}${d.column ? `:${d.column}` : ''}</span>
            <span class="diag-badge ${d.severity}">${d.severity}</span>
          </div>
          <div class="diag-message">${escapeHtml(d.message)}</div>
          ${(d.source || d.context || d.code) ? `<div class="diag-code">${escapeHtml(d.source || d.context || d.code || '')}</div>` : ''}
          ${d.suggestion ? `<div class="diag-suggestion"><strong>Fix Suggestion:</strong> ${escapeHtml(d.suggestion)}</div>` : ''}
        </div>
      `).join('')}
    </div>

    <footer>
      <span>ContextFlow Dual Hackathon Project (QNX Global Hackathon & Atlassian Codegeist 2026)</span>
      <span>Generated ${new Date().toISOString()}</span>
    </footer>
  </div>

  <script>
    function filterDiag(sev) {
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      event.target.classList.add('active');
      const cards = document.querySelectorAll('.diag-card');
      cards.forEach(c => {
        if (sev === 'all' || c.getAttribute('data-severity') === sev) {
          c.style.display = 'block';
        } else {
          c.style.display = 'none';
        }
      });
    }

    function copyRovoPrompt() {
      const prompt = "What caused the build failure on CS-1, and how do I fix each error in src/broken_main.c for QNX 8.0?";
      navigator.clipboard.writeText(prompt);
      alert("Rovo prompt copied to clipboard! Paste it into the 'Ask Rovo' chat in Jira.");
    }
  </script>
</body>
</html>`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export async function runDashboard(
  targetPath?: string,
  options: DashboardOptions = {},
): Promise<void> {
  const filePath = targetPath || 'examples/qnx-hello/sample-build-output/failed-build.log';
  const fullPath = resolve(filePath);

  logger.info(`Generating diagnostic dashboard from ${fullPath}...`);

  let logContent = '';
  try {
    logContent = await readFile(fullPath, 'utf-8');
  } catch (err: any) {
    throw new Error(`Failed to read log file ${fullPath}: ${err.message}`);
  }

  const report = createDiagnosticReport(logContent, {
    project: options.project || 'qnx-hello',
    target: options.target || 'x86_64',
    rawLog: logContent,
  });

  const html = generateDashboardHtml(report);
  const outPath = options.output
    ? resolve(options.output)
    : resolve(process.cwd(), 'contextflow-dashboard.html');

  await writeFile(outPath, html, 'utf-8');
  logger.success(`Dashboard generated: ${outPath}`);

  if (options.open !== false) {
    try {
      const openCmd = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start' : 'xdg-open';
      await execAsync(`${openCmd} "${outPath}"`);
      logger.info(`Opened dashboard in default browser.`);
    } catch {
      logger.info(`Open in your browser: file://${outPath}`);
    }
  }
}

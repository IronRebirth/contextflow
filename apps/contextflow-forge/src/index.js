import Resolver from '@forge/resolver';
import api, { route } from '@forge/api';
import { kvs } from '@forge/kvs';

const resolver = new Resolver();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Convert Atlassian Document Format (ADF) into readable plain text.
 * Jira issue descriptions are normally returned as structured ADF.
 */
function extractDescription(node) {
  if (!node || typeof node !== 'object') {
    return '';
  }

  if (node.type === 'text') {
    return node.text || '';
  }

  if (!Array.isArray(node.content)) {
    return '';
  }

  const blockTypes = [
    'doc',
    'paragraph',
    'heading',
    'bulletList',
    'orderedList',
    'listItem',
    'blockquote',
    'codeBlock',
  ];

  const separator = blockTypes.includes(node.type) ? '\n' : '';

  return node.content
    .map(extractDescription)
    .join(separator);
}

/**
 * Build a Forge Storage key for a given issue's diagnostic report.
 */
function diagnosticKey(issueKey) {
  return `diagnostics:${issueKey}`;
}

// ---------------------------------------------------------------------------
// Resolvers
// ---------------------------------------------------------------------------

/**
 * Retrieve actual Jira issue information for the current user.
 *
 * Using asUser() ensures Jira checks the user's own permissions.
 */
resolver.define('getIssueContext', async (request) => {
  const issueKey = request?.context?.extension?.issue?.key;

  if (!issueKey) {
    throw new Error('Unable to identify the current Jira issue.');
  }

  const response = await api
    .asUser()
    .requestJira(
      route`/rest/api/3/issue/${issueKey}?fields=summary,description,status,priority,issuetype,assignee,project,labels,components`
    );

  if (!response.ok) {
    throw new Error(
      `Jira returned error ${response.status} while retrieving ${issueKey}. Check issue access and app permissions.`
    );
  }

  const issue = await response.json();
  const fields = issue.fields || {};

  return {
    key: issue.key,
    summary: fields.summary || 'No summary available',
    description:
      extractDescription(fields.description).trim() ||
      'No description provided.',
    status: fields.status?.name || 'Unknown',
    priority: fields.priority?.name || 'Unassigned',
    issueType: fields.issuetype?.name || 'Unknown',
    assignee: fields.assignee?.displayName || 'Unassigned',
    project: fields.project?.name || 'Unknown',
    labels: fields.labels || [],
    components: (fields.components || []).map((c) => c.name),
  };
});

/**
 * Retrieve the latest diagnostic report stored for the current issue.
 */
resolver.define('getDiagnosticReport', async (request) => {
  const issueKey =
    request?.payload?.issueKey ||
    request?.context?.extension?.issue?.key;

  if (!issueKey) {
    return null;
  }

  try {
    const report = await kvs.get(diagnosticKey(issueKey));
    if (report) {
      return report;
    }

    // Fallback: check Jira issue property synced by CLI publish
    const propRes = await api
      .asUser()
      .requestJira(route`/rest/api/3/issue/${issueKey}/properties/contextflow_diagnostics`);
    if (propRes.ok) {
      const propData = await propRes.json();
      if (propData?.value) {
        // Cache in kvs for subsequent loads
        try {
          await kvs.set(diagnosticKey(issueKey), propData.value);
        } catch {
          // ignore cache write error
        }
        return propData.value;
      }
    }

    return null;
  } catch (err) {
    console.error(`Failed to retrieve diagnostic report for ${issueKey}:`, err);
    return null;
  }
});

/**
 * Store a diagnostic report for a given issue.
 *
 * Expects payload: { issueKey, report }
 * The report must contain at minimum `schemaVersion` and a `diagnostics` array.
 */
resolver.define('storeDiagnosticReport', async (request) => {
  const { issueKey, report } = request?.payload || {};

  if (!issueKey) {
    return { success: false, error: 'Missing issueKey.' };
  }

  if (!report || typeof report !== 'object') {
    return { success: false, error: 'Missing or invalid report object.' };
  }

  if (!report.schemaVersion) {
    return { success: false, error: 'Report must include schemaVersion.' };
  }

  if (!Array.isArray(report.diagnostics)) {
    return { success: false, error: 'Report must include a diagnostics array.' };
  }

  try {
    const storedReport = {
      ...report,
      storedAt: new Date().toISOString(),
    };

    await kvs.set(diagnosticKey(issueKey), storedReport);
    return { success: true, issueKey };
  } catch (err) {
    console.error(`Failed to store diagnostic report for ${issueKey}:`, err);
    return { success: false, error: 'Storage operation failed.' };
  }
});

/**
 * Find related Jira issues using JQL based on shared labels or components.
 *
 * Expects payload: { issueKey, labels?, components? }
 */
resolver.define('getRelatedIssues', async (request) => {
  const issueKey =
    request?.payload?.issueKey ||
    request?.context?.extension?.issue?.key;
  const labels = request?.payload?.labels || [];
  const components = request?.payload?.components || [];

  if (!issueKey) {
    return [];
  }

  const clauses = [];

  if (labels.length > 0) {
    const labelClauses = labels.map((l) => `"${l}"`).join(', ');
    clauses.push(`labels in (${labelClauses})`);
  }

  if (components.length > 0) {
    const compClauses = components.map((c) => `"${c}"`).join(', ');
    clauses.push(`component in (${compClauses})`);
  }

  if (clauses.length === 0) {
    return [];
  }

  const jql = `(${clauses.join(' OR ')}) AND key != ${issueKey} ORDER BY updated DESC`;

  try {
    const response = await api
      .asUser()
      .requestJira(
        route`/rest/api/3/search?jql=${jql}&maxResults=5&fields=summary,status`
      );

    if (!response.ok) {
      console.warn(`JQL search returned ${response.status}`);
      return [];
    }

    const data = await response.json();
    return (data.issues || []).map((issue) => ({
      key: issue.key,
      summary: issue.fields?.summary || 'No summary',
      status: issue.fields?.status?.name || 'Unknown',
    }));
  } catch (err) {
    console.error('Related issues search failed:', err);
    return [];
  }
});

/**
 * Search Confluence for documentation relevant to the diagnostics.
 *
 * Expects payload: { searchTerms }
 */
resolver.define('searchConfluence', async (request) => {
  const searchTerms = request?.payload?.searchTerms;

  if (!searchTerms) {
    return [];
  }

  try {
    const cql = `type = page AND text ~ "${searchTerms}"`;
    const response = await api
      .asUser()
      .requestConfluence(
        route`/wiki/rest/api/content/search?cql=${cql}&limit=5&expand=excerpt`
      );

    if (!response.ok) {
      console.warn(`Confluence search returned ${response.status}`);
      return [];
    }

    const data = await response.json();
    return (data.results || []).map((page) => ({
      title: page.title || 'Untitled',
      url: page._links?.webui
        ? `${data._links?.base || ''}${page._links.webui}`
        : '#',
      excerpt: page.excerpt || '',
    }));
  } catch (err) {
    console.error('Confluence search failed:', err);
    return [];
  }
});

/**
 * Webhook / REST resolver that the QNX CLI can call to push diagnostic
 * reports into Forge Storage.
 *
 * Expects payload: { issueKey, report }
 */
resolver.define('receiveReport', async (request) => {
  const { issueKey, report } = request?.payload || {};

  if (!issueKey) {
    return { success: false, error: 'Missing issueKey.' };
  }

  if (
    !report ||
    typeof report !== 'object' ||
    !report.schemaVersion ||
    !Array.isArray(report.diagnostics)
  ) {
    return {
      success: false,
      error:
        'Invalid report. Must be an object with schemaVersion and diagnostics array.',
    };
  }

  try {
    const storedReport = {
      ...report,
      receivedAt: new Date().toISOString(),
    };

    await kvs.set(diagnosticKey(issueKey), storedReport);
    return { success: true, issueKey, diagnosticsCount: report.diagnostics.length };
  } catch (err) {
    console.error(`receiveReport storage failed for ${issueKey}:`, err);
    return { success: false, error: 'Storage operation failed.' };
  }
});

export const handler = resolver.getDefinitions();

// ---------------------------------------------------------------------------
// Rovo Agent Action Handler
// ---------------------------------------------------------------------------

/**
 * Analyze diagnostics for a given issue – invoked by the Rovo agent action.
 */
export async function analyzeDiagnosticsHandler(event) {
  const issueKey = event?.payload?.issueKey;

  if (!issueKey) {
    return {
      body: 'No issue key was provided. Please specify a Jira issue key to analyze.',
    };
  }

  let report;
  try {
    report = await kvs.get(diagnosticKey(issueKey));
    if (!report) {
      const propRes = await api
        .asUser()
        .requestJira(route`/rest/api/3/issue/${issueKey}/properties/contextflow_diagnostics`);
      if (propRes.ok) {
        const propData = await propRes.json();
        report = propData?.value;
      }
    }
  } catch (err) {
    console.error(`analyzeDiagnosticsHandler storage read failed:`, err);
    return {
      body: `Failed to read diagnostic data for ${issueKey}.`,
    };
  }

  if (!report) {
    return {
      body: `No diagnostic report found for ${issueKey}. Ask the developer to push a build report from the QNX Companion CLI first.`,
    };
  }

  // Build a structured summary for the Rovo agent to interpret.
  const diagnostics = report.diagnostics || [];
  const errors = diagnostics.filter((d) => d.severity === 'error');
  const warnings = diagnostics.filter((d) => d.severity === 'warning');
  const notes = diagnostics.filter((d) => d.severity === 'note');

  const lines = [
    `## Diagnostic Report for ${issueKey}`,
    '',
    `**Build Status:** ${report.buildStatus || 'unknown'}`,
    `**Compiler:** ${report.compiler || 'N/A'}`,
    `**Platform:** ${report.platform || 'N/A'}`,
    `**Target:** ${report.target || 'N/A'}`,
    `**Duration:** ${report.duration || 'N/A'}`,
    `**Timestamp:** ${report.timestamp || report.storedAt || 'N/A'}`,
    '',
    `### Summary`,
    `- **Errors:** ${errors.length}`,
    `- **Warnings:** ${warnings.length}`,
    `- **Notes:** ${notes.length}`,
    '',
  ];

  if (errors.length > 0) {
    lines.push('### Errors');
    errors.forEach((d, i) => {
      lines.push(`${i + 1}. **${d.file || 'unknown'}:${d.line || '?'}** - ${d.message || 'No message'}`);
      if (d.suggestion) {
        lines.push(`   Suggestion: ${d.suggestion}`);
      }
    });
    lines.push('');
  }

  if (warnings.length > 0) {
    lines.push('### Warnings');
    warnings.forEach((d, i) => {
      lines.push(`${i + 1}. **${d.file || 'unknown'}:${d.line || '?'}** - ${d.message || 'No message'}`);
      if (d.suggestion) {
        lines.push(`   Suggestion: ${d.suggestion}`);
      }
    });
    lines.push('');
  }

  if (notes.length > 0) {
    lines.push('### Notes');
    notes.forEach((d, i) => {
      lines.push(`${i + 1}. **${d.file || 'unknown'}:${d.line || '?'}** — ${d.message || 'No message'}`);
    });
    lines.push('');
  }

  lines.push('Please analyze each error, explain what went wrong, and suggest specific fixes.');

  return {
    body: lines.join('\n'),
  };
}

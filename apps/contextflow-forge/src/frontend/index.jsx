import React, { useEffect, useState } from 'react';

import ForgeReconciler, {
  Badge,
  Box,
  Button,
  Heading,
  Inline,
  Lozenge,
  SectionMessage,
  Spinner,
  Stack,
  Tab,
  TabList,
  TabPanel,
  Tabs,
  Tag,
  TagGroup,
  Text,
} from '@forge/react';

import { invoke } from '@forge/bridge';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getStatusAppearance(status) {
  const s = (status || '').toLowerCase();
  if (['done', 'resolved', 'closed', 'complete', 'completed'].includes(s)) return 'success';
  if (['blocked', 'failed'].includes(s)) return 'removed';
  if (['in progress', 'in review', 'active'].includes(s)) return 'inprogress';
  if (['to do', 'open', 'backlog'].includes(s)) return 'default';
  return 'default';
}

function severityAppearance(severity) {
  switch (severity) {
    case 'error': return 'removed';
    case 'warning': return 'moved';
    case 'note': return 'new';
    default: return 'default';
  }
}

function severityLabel(severity) {
  switch (severity) {
    case 'error': return 'ERROR';
    case 'warning': return 'WARNING';
    case 'note': return 'NOTE';
    default: return (severity || 'UNKNOWN').toUpperCase();
  }
}

// ---------------------------------------------------------------------------
// Diagnostics Tab
// ---------------------------------------------------------------------------

function DiagnosticsTab() {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    invoke('getDiagnosticReport')
      .then((data) => { if (mounted) setReport(data); })
      .catch((err) => console.error('getDiagnosticReport failed:', err))
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, []);

  if (loading) {
    return (
      <Box padding="space.300">
        <Inline alignBlock="center" space="space.100">
          <Spinner />
          <Text>Loading diagnostics…</Text>
        </Inline>
      </Box>
    );
  }

  if (!report) {
    return (
      <Box padding="space.300">
        <SectionMessage appearance="information" title="No build reports yet">
          <Text>
            Push a diagnostic report from the QNX Companion CLI to see build
            results here. Run `contextflow push --issue ISSUE-KEY` after your
            build completes.
          </Text>
        </SectionMessage>
      </Box>
    );
  }

  const diagnostics = report.diagnostics || [];
  const errors = diagnostics.filter((d) => d.severity === 'error');
  const warnings = diagnostics.filter((d) => d.severity === 'warning');
  const notes = diagnostics.filter((d) => d.severity === 'note');
  const buildPassed = report.buildStatus === 'success';

  return (
    <Box padding="space.200">
      <Stack space="space.300">

        {/* Build status banner */}
        <Box
          padding="space.200"
          backgroundColor={
            buildPassed
              ? 'color.background.success'
              : 'color.background.danger'
          }
        >
          <Inline alignBlock="center" space="space.100">
            <Heading size="medium">
              {buildPassed ? 'Build Passed' : 'Build Failed'}
            </Heading>
          </Inline>
        </Box>

        {/* Summary counts */}
        <Inline space="space.200" alignBlock="center">
          <Inline space="space.050" alignBlock="center">
            <Text weight="semibold">Errors</Text>
            <Badge appearance={errors.length > 0 ? 'removed' : 'default'}>
              {errors.length}
            </Badge>
          </Inline>
          <Inline space="space.050" alignBlock="center">
            <Text weight="semibold">Warnings</Text>
            <Badge appearance={warnings.length > 0 ? 'moved' : 'default'}>
              {warnings.length}
            </Badge>
          </Inline>
          <Inline space="space.050" alignBlock="center">
            <Text weight="semibold">Notes</Text>
            <Badge appearance="default">{notes.length}</Badge>
          </Inline>
        </Inline>

        {/* Build metadata */}
        <Box padding="space.200" backgroundColor="color.background.neutral">
          <Stack space="space.100">
            <Text weight="semibold">Build Metadata</Text>
            <Inline space="space.200">
              <Text size="small">Compiler: {report.compiler || 'N/A'}</Text>
              <Text size="small">Platform: {report.platform || 'N/A'}</Text>
            </Inline>
            <Inline space="space.200">
              <Text size="small">Target: {report.target || 'N/A'}</Text>
              <Text size="small">Duration: {report.duration || 'N/A'}</Text>
            </Inline>
            <Text size="small" color="color.text.subtle">
              {report.timestamp || report.storedAt || ''}
            </Text>
          </Stack>
        </Box>

        {/* Diagnostic entries */}
        {diagnostics.length > 0 && (
          <Stack space="space.100">
            <Heading size="small">Diagnostic Details</Heading>

            {diagnostics.map((d, i) => (
              <Box
                key={`diag-${i}`}
                padding="space.200"
                backgroundColor="color.background.neutral"
              >
                <Stack space="space.100">
                  <Inline alignBlock="center" space="space.100">
                    <Lozenge appearance={severityAppearance(d.severity)}>
                      {severityLabel(d.severity)}
                    </Lozenge>
                    <Text size="small" weight="semibold">
                      {d.file || 'unknown'}{d.line ? `:${d.line}` : ''}
                    </Text>
                  </Inline>

                  <Text>{d.message || 'No message'}</Text>

                  {d.suggestion && (
                    <Box
                      padding="space.100"
                      backgroundColor="color.background.discovery"
                    >
                      <Text size="small">Recommendation: {d.suggestion}</Text>
                    </Box>
                  )}
                </Stack>
              </Box>
            ))}
          </Stack>
        )}

      </Stack>
    </Box>
  );
}

// ---------------------------------------------------------------------------
// Context Tab
// ---------------------------------------------------------------------------

function ContextTab() {
  const [issue, setIssue] = useState(null);
  const [related, setRelated] = useState([]);
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        const issueData = await invoke('getIssueContext');
        if (!mounted) return;
        setIssue(issueData);

        // Fire related issues and confluence searches in parallel.
        const [relatedResult, docsResult] = await Promise.all([
          invoke('getRelatedIssues', {
            issueKey: issueData.key,
            labels: issueData.labels || [],
            components: issueData.components || [],
          }).catch(() => []),
          invoke('searchConfluence', {
            searchTerms: issueData.summary || '',
          }).catch(() => []),
        ]);

        if (mounted) {
          setRelated(relatedResult || []);
          setDocs(docsResult || []);
        }
      } catch (err) {
        console.error('ContextTab load failed:', err);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    load();
    return () => { mounted = false; };
  }, []);

  if (loading) {
    return (
      <Box padding="space.300">
        <Inline alignBlock="center" space="space.100">
          <Spinner />
          <Text>Loading context…</Text>
        </Inline>
      </Box>
    );
  }

  if (!issue) {
    return (
      <Box padding="space.300">
        <Text>Unable to load issue context.</Text>
      </Box>
    );
  }

  return (
    <Box padding="space.200">
      <Stack space="space.300">

        {/* Issue identity */}
        <Stack space="space.100">
          <Text weight="semibold">{issue.key}</Text>
          <Heading size="medium">{issue.summary}</Heading>
          <Inline alignBlock="center" space="space.100">
            <Lozenge appearance={getStatusAppearance(issue.status)}>
              {issue.status}
            </Lozenge>
            <Lozenge appearance="default">{issue.priority}</Lozenge>
            <Lozenge appearance="default">{issue.issueType}</Lozenge>
          </Inline>
        </Stack>

        {/* Assignee & project */}
        <Box padding="space.200" backgroundColor="color.background.neutral">
          <Stack space="space.100">
            <Inline space="space.200">
              <Stack space="space.050">
                <Text size="small" color="color.text.subtle">Assignee</Text>
                <Text weight="semibold">{issue.assignee}</Text>
              </Stack>
              <Stack space="space.050">
                <Text size="small" color="color.text.subtle">Project</Text>
                <Text weight="semibold">{issue.project}</Text>
              </Stack>
            </Inline>
          </Stack>
        </Box>

        {/* Labels */}
        {issue.labels && issue.labels.length > 0 && (
          <Stack space="space.100">
            <Text weight="semibold" size="small">Labels</Text>
            <TagGroup>
              {issue.labels.map((label) => (
                <Tag key={label} text={label} />
              ))}
            </TagGroup>
          </Stack>
        )}

        {/* Description */}
        <Stack space="space.100">
          <Heading size="small">Description</Heading>
          <Text>{issue.description}</Text>
        </Stack>

        {/* Related issues */}
        <Stack space="space.100">
          <Heading size="small">Related Issues</Heading>
          {related.length === 0 ? (
            <Text size="small" color="color.text.subtle">
              No related issues found.
            </Text>
          ) : (
            related.map((ri) => (
              <Box
                key={ri.key}
                padding="space.150"
                backgroundColor="color.background.neutral"
              >
                <Inline alignBlock="center" space="space.100">
                  <Text weight="semibold" size="small">{ri.key}</Text>
                  <Text size="small">{ri.summary}</Text>
                  <Lozenge appearance={getStatusAppearance(ri.status)}>
                    {ri.status}
                  </Lozenge>
                </Inline>
              </Box>
            ))
          )}
        </Stack>

        {/* Confluence docs */}
        <Stack space="space.100">
          <Heading size="small">Relevant Documentation</Heading>
          {docs.length === 0 ? (
            <Text size="small" color="color.text.subtle">
              No relevant Confluence pages found.
            </Text>
          ) : (
            docs.map((doc, i) => (
              <Box
                key={`doc-${i}`}
                padding="space.150"
                backgroundColor="color.background.neutral"
              >
                <Stack space="space.050">
                  <Text weight="semibold" size="small">{doc.title}</Text>
                  {doc.excerpt && (
                    <Text size="small" color="color.text.subtle">
                      {doc.excerpt}
                    </Text>
                  )}
                </Stack>
              </Box>
            ))
          )}
        </Stack>

      </Stack>
    </Box>
  );
}

// ---------------------------------------------------------------------------
// AI Assist Tab
// ---------------------------------------------------------------------------

function AIAssistTab() {
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleAnalyze() {
    setLoading(true);
    setError('');
    setAnalysis(null);

    try {
      // Get the issue key first.
      const issue = await invoke('getIssueContext');
      const result = await invoke('getDiagnosticReport', {
        issueKey: issue.key,
      });

      if (!result) {
        setError(
          'No diagnostic report found for this issue. Push a build report first.'
        );
        return;
      }

      // Build a client-side summary since the Rovo action may not be
      // directly invocable from the frontend. We present the structured
      // analysis ourselves.
      const diagnostics = result.diagnostics || [];
      const errors = diagnostics.filter((d) => d.severity === 'error');
      const warnings = diagnostics.filter((d) => d.severity === 'warning');

      const analysisData = {
        buildStatus: result.buildStatus || 'unknown',
        totalErrors: errors.length,
        totalWarnings: warnings.length,
        errors: errors.map((d) => ({
          file: d.file || 'unknown',
          line: d.line || '?',
          message: d.message || 'No message',
          suggestion: d.suggestion || null,
        })),
        warnings: warnings.map((d) => ({
          file: d.file || 'unknown',
          line: d.line || '?',
          message: d.message || 'No message',
          suggestion: d.suggestion || null,
        })),
        suggestedActions: [
          errors.length > 0
            ? 'Fix all compilation errors before proceeding'
            : null,
          warnings.length > 0
            ? 'Review warnings for potential issues'
            : null,
          'Run a clean rebuild after applying fixes',
          'Check QNX documentation for platform-specific errors',
        ].filter(Boolean),
      };

      setAnalysis(analysisData);
    } catch (err) {
      console.error('AI analysis failed:', err);
      setError(err?.message || 'Analysis failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Box padding="space.200">
      <Stack space="space.300">

        <Stack space="space.100">
          <Heading size="small">AI-Powered Analysis</Heading>
          <Text size="small" color="color.text.subtle">
            Analyze your build diagnostics with ContextFlow Assistant to get
            actionable insights and fix suggestions.
          </Text>
        </Stack>

        <Button
          appearance="primary"
          onClick={handleAnalyze}
          isDisabled={loading}
        >
          {loading ? 'Analyzing…' : 'Get AI Analysis'}
        </Button>

        {loading && (
          <Inline alignBlock="center" space="space.100">
            <Spinner />
            <Text>Analyzing diagnostics…</Text>
          </Inline>
        )}

        {error && (
          <SectionMessage appearance="warning" title="Analysis unavailable">
            <Text>{error}</Text>
          </SectionMessage>
        )}

        {analysis && (
          <Stack space="space.300">

            {/* Overall status */}
            <Box
              padding="space.200"
              backgroundColor={
                analysis.buildStatus === 'success'
                  ? 'color.background.success'
                  : 'color.background.danger'
              }
            >
              <Stack space="space.100">
                <Heading size="small">
                  Build {analysis.buildStatus === 'success' ? 'Passed' : 'Failed'}
                </Heading>
                <Text>
                  {analysis.totalErrors} error(s), {analysis.totalWarnings} warning(s)
                </Text>
              </Stack>
            </Box>

            {/* Error analysis */}
            {analysis.errors.length > 0 && (
              <Stack space="space.100">
                <Heading size="small">Error Analysis</Heading>
                {analysis.errors.map((e, i) => (
                  <Box
                    key={`err-${i}`}
                    padding="space.200"
                    backgroundColor="color.background.neutral"
                  >
                    <Stack space="space.100">
                      <Inline alignBlock="center" space="space.100">
                        <Lozenge appearance="removed">ERROR</Lozenge>
                        <Text size="small" weight="semibold">
                          {e.file}:{e.line}
                        </Text>
                      </Inline>
                      <Text>{e.message}</Text>
                      {e.suggestion && (
                        <Box
                          padding="space.100"
                          backgroundColor="color.background.discovery"
                        >
                          <Text size="small">Recommendation: {e.suggestion}</Text>
                        </Box>
                      )}
                    </Stack>
                  </Box>
                ))}
              </Stack>
            )}

            {/* Warning analysis */}
            {analysis.warnings.length > 0 && (
              <Stack space="space.100">
                <Heading size="small">Warning Review</Heading>
                {analysis.warnings.map((w, i) => (
                  <Box
                    key={`warn-${i}`}
                    padding="space.200"
                    backgroundColor="color.background.neutral"
                  >
                    <Stack space="space.100">
                      <Inline alignBlock="center" space="space.100">
                        <Lozenge appearance="moved">WARNING</Lozenge>
                        <Text size="small" weight="semibold">
                          {w.file}:{w.line}
                        </Text>
                      </Inline>
                      <Text>{w.message}</Text>
                      {w.suggestion && (
                        <Box
                          padding="space.100"
                          backgroundColor="color.background.discovery"
                        >
                          <Text size="small">Recommendation: {w.suggestion}</Text>
                        </Box>
                      )}
                    </Stack>
                  </Box>
                ))}
              </Stack>
            )}

            {/* Suggested next actions */}
            <Stack space="space.100">
              <Heading size="small">Suggested Next Actions</Heading>
              {analysis.suggestedActions.map((action, i) => (
                <Box
                  key={`action-${i}`}
                  padding="space.150"
                  backgroundColor="color.background.neutral"
                >
                  <Inline alignBlock="center" space="space.100">
                    <Text size="small">→</Text>
                    <Text size="small">{action}</Text>
                  </Inline>
                </Box>
              ))}
            </Stack>

          </Stack>
        )}

      </Stack>
    </Box>
  );
}

// ---------------------------------------------------------------------------
// Main App
// ---------------------------------------------------------------------------

function App() {
  return (
    <Box padding="space.200">
      <Stack space="space.200">

        {/* Header */}
        <Inline alignBlock="center" space="space.100">
          <Heading size="large">ContextFlow</Heading>
          <Lozenge appearance="new">Diagnostics</Lozenge>
        </Inline>

        {/* Tabbed interface */}
        <Tabs id="contextflow-tabs">
          <TabList>
            <Tab>Diagnostics</Tab>
            <Tab>Context</Tab>
            <Tab>AI Assist</Tab>
          </TabList>

          <TabPanel>
            <DiagnosticsTab />
          </TabPanel>

          <TabPanel>
            <ContextTab />
          </TabPanel>

          <TabPanel>
            <AIAssistTab />
          </TabPanel>
        </Tabs>

      </Stack>
    </Box>
  );
}

ForgeReconciler.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

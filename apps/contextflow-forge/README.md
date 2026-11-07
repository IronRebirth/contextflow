# ContextFlow - Atlassian Forge App

This is the Atlassian Forge application component of **ContextFlow**. It connects low-level embedded software build diagnostics directly into Jira Cloud, Confluence, and Atlassian Rovo AI.

## Features

- **Jira Issue Panel (`jira:issuePanel`)**:
  - **Diagnostics Tab**: Displays compiler diagnostics, severity tags (`[ERROR]`, `[WARNING]`, `[NOTE]`), source line numbers, and actionable remediation steps.
  - **Context Tab**: Displays real-time Jira issue details, assignee information, and related Confluence documentation.
  - **AI Assist Tab**: Interactive interface to invoke the Atlassian Rovo AI assistant on the build failure.
- **Atlassian Rovo Agent (`rovo:agent`)**:
  - Defined in `manifest.yml` as `contextflow-rovo-agent`.
  - Powered by the `contextflow-analyze-action` action.
  - Reads compiler diagnostic data stored in Forge Key-Value Storage (`@forge/kvs`) or synchronized Jira Issue Properties.
- **Cross-Product Confluence Search**:
  - Automatically queries linked Confluence spaces for relevant setup and troubleshooting runbooks based on compiler diagnostic error terms.

## Development & Deployment

### Prerequisites
- Node.js 20.x, 22.x, or 24.x
- Atlassian Forge CLI: `npm install -g @forge/cli`
- Authenticated Forge session: `forge login`

### Deploying
```bash
# Validate manifest and permissions
forge lint

# Deploy to development environment
forge deploy

# Install onto your Jira Cloud site
forge install
```

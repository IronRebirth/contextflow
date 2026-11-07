# QNX Hello World - ContextFlow Demo

A sample QNX Neutrino program used to demonstrate ContextFlow's build analysis capabilities.

## Prerequisites

- QNX SDP 8.0 installed and configured
- QNX environment variables set (`QNX_HOST`, `QNX_TARGET`)
- x86-64 Linux or Windows development host

## Building

```bash
# Build the working version
make

# Build the intentionally broken version (for demo)
make broken

# Build for a different target
make TARGET=aarch64
```

## With ContextFlow

```bash
# Check your QNX environment
contextflow-qnx doctor

# Build and analyze
contextflow-qnx build ./examples/qnx-hello

# Analyze an existing build log
contextflow-qnx analyze build/x86_64/build-errors.log

# Publish results to Jira
contextflow-qnx publish --issue-key PROJ-123
```

## Demo Scenario

1. Build the broken version: `make broken`
2. Analyze the errors: `contextflow-qnx analyze build/x86_64/build-errors.log`
3. View the structured diagnostic report
4. Publish to Jira: `contextflow-qnx publish --issue-key PROJ-123`
5. Open the Jira issue to see ContextFlow panel with diagnostics
6. Ask Rovo: "What's wrong with this build?"

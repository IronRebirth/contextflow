# ContextFlow Test Suite

This directory contains automated unit and integration tests for ContextFlow.

## Running Tests

From the repository root:

```bash
# Run unit tests
./apps/qnx-companion/node_modules/.bin/tsx --test tests/parser.test.js
```

## Test Coverage
- **`tests/parser.test.js`**:
  - Validates extraction of GCC / QNX `qcc` error lines, warnings, and notes from compiler logs.
  - Validates generation of contextual remediation suggestions for QNX-specific APIs.
  - Verifies summary calculation (`totalErrors`, `totalWarnings`, `totalNotes`).


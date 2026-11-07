# ContextFlow QNX Companion CLI

The host-side development companion for **QNX SDP 8.0**. Analyzes real-time C/C++ builds, inspects host toolchain requirements, normalizes diagnostic evidence, and connects to Atlassian Jira.

## Commands

- **`doctor`**: Checks host architecture compatibility (accounting for x86_64 requirements and alerting on macOS ARM64 limitations), validates `QNX_HOST`, `QNX_TARGET`, compiler executable `qcc`, boot image generator `mkifs`, and QEMU.
- **`analyze [path]`**: Parses GCC/qcc compiler error output into normalized JSON diagnostics conforming to the formal schema, with embedded QNX remediation heuristics.
- **`build [dir]`**: Wraps the native QNX cross-compilation pipeline (`qcc -V gcc_ntox86_64`) with automated diagnostic capture and dry-run execution support.
- **`publish [report]`**: Converts diagnostic reports into Atlassian Document Format (ADF) comments and synchronizes structured JSON data to Jira Issue Properties.

## Quick Start

```bash
# Install dependencies
npm install

# Build standalone binary
npm run build

# Run environment doctor
./dist/index.js doctor

# Analyze sample compiler failure
./dist/index.js analyze ../../examples/qnx-hello/sample-build-output/failed-build.log

# Publish to Jira
./dist/index.js publish ../../examples/qnx-hello/sample-build-output/failed-build.log \
  --issue-key "PROJ-101" \
  --base-url "https://your-domain.atlassian.net" \
  --email "user@example.com" \
  --api-token "YOUR_TOKEN"
```


# ContextFlow

<div align="center">



### **Engineering context. Connected intelligence.**

A unified developer companion bridging **QNX SDP 8.0 real-time systems** with **Atlassian Cloud (Jira, Confluence, and Rovo AI)**.

[![CI](https://github.com/IronRebirth/contextflow/actions/workflows/ci.yml/badge.svg)](https://github.com/IronRebirth/contextflow/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![QNX SDP](https://img.shields.io/badge/QNX-SDP%208.0-red.svg)](https://blackberry.qnx.com/en/products/neutrino-rtos)
[![Atlassian Forge](https://img.shields.io/badge/Atlassian-Forge%20CLI%2015.0-0052CC.svg)](https://developer.atlassian.com/platform/forge/)
[![Rovo Agent](https://img.shields.io/badge/Atlassian-Rovo%20AI-orange.svg)](https://www.atlassian.com/software/rovo)

</div>

---

## The Core Problem & Central Story

Developing mission-critical embedded systems targeting real-time operating systems like **QNX Neutrino 8.0** involves complex cross-compilation environments (`qcc`, `mkifs`, POSIX real-time headers, target boards/QEMU). When an embedded build fails:
- Error outputs are buried in lengthy terminal scrollbacks.
- Cross-architecture subtle bugs (e.g. 64-bit pointer truncation, QNX 8.0 `ChannelCreate` API shifts, missing `-lsocket`) leave developers hunting across forums and documentation.
- Project managers and agile teams in **Jira** only see "Task Blocked" without actionable diagnostic evidence.

**ContextFlow bridges this divide:**
1. **Host Tool (`contextflow-qnx`)**: Inspects QNX SDP 8.0 host configuration, cross-compiles with `qcc`, parses compiler diagnostics, and extracts structured reports conforming to a shared JSON schema.
2. **Jira Integration**: Publishes formatted diagnostic summaries in Atlassian Document Format (ADF) directly to the corresponding Jira issue.
3. **Forge App (`@contextflow/forge-app`)**: Displays a multi-tab Diagnostics & Context panel in Jira with severity badges, line-accurate code previews, and linked Confluence knowledge.
4. **Atlassian Rovo AI Agent**: Equips Rovo with the exact compiler diagnostic evidence to explain low-level QNX failures in plain language and propose concrete code fixes.

---

## Dual Hackathon Alignment

| Hackathon | Submission Category | Qualifying Technologies |
| :--- | :--- | :--- |
| **QNX Global Hackathon** | Developer Tooling & Host Tools | QNX SDP 8.0, `qcc` cross-compiler, `mkifs` image generator, QEMU emulator |
| **Codegeist 2026** | Apps for Software Teams | Atlassian Forge UI Kit, Jira Issue Panel, Forge Storage, Rovo AI Agent |

---

## Quick Start

### 1. Host Tool: ContextFlow QNX Companion

```bash
# Navigate to the CLI workspace
cd apps/qnx-companion
npm install

# Check your environment (QNX SDP 8.0, compilers, tools)
npm run dev -- doctor

# Analyze a sample QNX build failure
npm run dev -- analyze ../../examples/qnx-hello/sample-build-output/failed-build.log

# Launch the visual web dashboard
npm run dev -- dashboard ../../examples/qnx-hello/sample-build-output/failed-build.log

# Export structured report in JSON Schema v1.0 format
npm run dev -- analyze ../../examples/qnx-hello/sample-build-output/failed-build.log --json

# Preview Atlassian Document Format (ADF) Jira comment payload (Dry Run)
npm run dev -- publish ../../packages/contracts/examples/sample-report.json --issue-key PROJ-101 --dry-run
```

### 2. Atlassian Forge App

```bash
# Navigate to Forge app directory
cd apps/contextflow-forge

# Lint the manifest and resolvers
forge lint

# Deploy to development environment
forge deploy

# Install onto your Jira Cloud site
forge install
```

---

## QNX Host Requirement Note

QNX SDP 8.0 officially supports **x86-64 Linux (Ubuntu 20.04/22.04 LTS)** and **Windows x86-64**. It explicitly excludes ARM hosts (such as Apple Silicon Macs).

- When running on an Apple Silicon Mac, `contextflow-qnx doctor` detects your platform and operates in **Demonstration / Offline Analysis Mode**, allowing full log parsing, schema validation, and Jira publishing.
- For real `qcc` binary compilation and `mkifs` image building, install QNX SDP 8.0 on an x86-64 Ubuntu machine and source `qnxsdp-env.sh`.

---

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
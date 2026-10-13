# AGY-Notebook-Bridge

> **A standalone Antigravity IDE extension that brings Google NotebookLM directly into your editor — workspace source sync, grounded research queries, and Audio Overview playback, without leaving the IDE.**

[![VS Code Extension](https://img.shields.io/badge/VS%20Code-Extension-007ACC?logo=visualstudiocode)](https://code.visualstudio.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Status: WIP](https://img.shields.io/badge/Status-WIP-orange)]()

---

## What is AGY-Notebook-Bridge?

AGY-Notebook-Bridge is a **project-agnostic Antigravity IDE extension** that eliminates the context-switch between your code editor and Google NotebookLM.

Instead of manually copying files, opening Chrome tabs, and switching windows, you get:

- A **dedicated Activity Bar panel** showing your NotebookLM notebooks and their status
- **1-click source ingestion** from `docs/notebooklm_sources/` directly into your active notebook
- **Grounded research queries** (Fast / Deep Research) streamed back as Markdown files into your project
- **Audio Overview playback** directly inside the IDE

Architecture is inspired by Eren Yüksel's decoupled reverse-engineering patterns from `ag-multi-account-switchboard`: server discovery, direct RPC/HTTP loops, and a decoupled Webview UI — adapted for NotebookLM's internal APIs.

---

## Core Features

### Notebook Panel (Activity Bar)
- Lists all your NotebookLM notebooks with source count and last-updated status
- Switch active notebook with 1 click
- Create new notebooks scoped to the current project

### Workspace Source Sync Engine
- Watches `docs/notebooklm_sources/` for changes
- 1-click (or auto) sync of Markdown files, PDFs, and URLs into the active notebook
- Supports YouTube video URLs and web pages as sources
- Delta sync — only uploads changed or new files

### Grounded Research Query Runner
- Submit Fast or Deep Research queries from a sidebar input
- Streams synthesis results back into the IDE as Markdown artifacts saved in `docs/research/`
- Persists the query and result with source citations

### Audio Overview Player
- Trigger NotebookLM Audio Overview (podcast) generation from the IDE
- Embedded audio player in the Webview panel — no browser required
- Download and save audio files locally

### Authentication & Session Bridge
- Pre-flight auth gate: verifies NotebookLM session before any operation
- Automatic token refresh via stored Google session
- Clear error messaging and re-auth flow if session expires

---

## Architecture

```
AGY-Notebook-Bridge
├── src/
│   ├── extension.ts              # Activation, panel registration, command wiring
│   ├── auth/
│   │   ├── sessionBridge.ts      # Google session discovery & token management
│   │   └── preflight.ts          # Pre-flight auth gate (notebooklm status check)
│   ├── api/
│   │   ├── notebookClient.ts     # NotebookLM internal HTTP/RPC client
│   │   ├── sourceIngestion.ts    # Source upload: files, URLs, YouTube
│   │   └── queryRunner.ts        # Fast / Deep Research query executor
│   ├── sync/
│   │   ├── workspaceWatcher.ts   # docs/notebooklm_sources/ file watcher
│   │   └── deltaSync.ts          # Changed-file detection and batch upload
│   ├── audio/
│   │   └── audioOverview.ts      # Audio Overview generation + download
│   └── ui/
│       ├── notebookPanel.ts      # Activity Bar Webview host
│       └── researchPanel.ts      # Query input + streaming result display
├── webview-ui/                   # Vite + React panel UI
│   ├── NotebookPanel.tsx
│   ├── ResearchPanel.tsx
│   └── AudioPlayer.tsx
├── package.json
└── README.md
```

---

## Installation (Development)

```bash
git clone https://github.com/norbe88/AGY-Notebook-Bridge.git
cd AGY-Notebook-Bridge
npm install
npm run compile
# F5 in VS Code / Antigravity IDE to launch Extension Development Host
```

---

## Commands

| Command | ID | Description |
|---|---|---|
| Notebook Bridge: Open Panel | `notebook-bridge.open` | Open the NotebookLM sidebar panel |
| Notebook Bridge: Sync Sources | `notebook-bridge.syncSources` | Sync `docs/notebooklm_sources/` to active notebook |
| Notebook Bridge: Run Query | `notebook-bridge.query` | Submit a Fast/Deep Research query |
| Notebook Bridge: Generate Audio Overview | `notebook-bridge.audioOverview` | Trigger Audio Overview generation |
| Notebook Bridge: Switch Notebook | `notebook-bridge.switchNotebook` | Select active notebook |
| Notebook Bridge: Auth Status | `notebook-bridge.authStatus` | Check current session authentication |

---

## Configuration

```jsonc
{
  // Path to workspace sources directory (relative to workspace root)
  "notebookBridge.sourcesDir": "docs/notebooklm_sources",

  // Output path for research synthesis results
  "notebookBridge.researchOutputDir": "docs/research",

  // Auto-sync sources on file change
  "notebookBridge.autoSync": true,

  // Default research mode: "fast" | "deep"
  "notebookBridge.defaultResearchMode": "fast"
}
```

---

## Workspace Convention

The extension expects (and creates) the following directory structure:

```
your-project/
├── docs/
│   ├── notebooklm_sources/   # Drop files/URLs here → auto-synced to NotebookLM
│   └── research/             # Query results written here as .md files
```

---

## Roadmap

| # | Ticket | Status |
|---|---|---|
| 01 | Reverse-Engineering & Architecture Blueprint | TODO |
| 02 | NotebookLM CLI & Token Daemon Bridge | TODO |
| 03 | Workspace Source Ingestion & Sync Engine | TODO |
| 04 | Native Sidebar Webview UI & Audio Overview Player | TODO |

---

## License

MIT — free to use, fork, and extend across any Antigravity IDE project.

---

## Credits

Extension architecture patterns borrowed from **erennyuksell**'s `ag-multi-account-switchboard` — the decoupled RPC/Webview approach proved to be the ideal template for NotebookLM integration.

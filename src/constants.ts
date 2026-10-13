/**
 * AGY-Notebook-Bridge — Constants & Identification Keys
 */

export const EXTENSION_ID = 'agy-notebook-bridge';
export const EXTENSION_NAME = 'AGY Notebook Bridge';

export const VIEW_CONTAINER_ID = 'ag-notebook';
export const PANEL_VIEW_ID = 'ag-notebook.panel';

export const COMMANDS = {
  OPEN_PANEL: 'notebook-bridge.open',
  SYNC_SOURCES: 'notebook-bridge.syncSources',
  RUN_QUERY: 'notebook-bridge.query',
  AUDIO_OVERVIEW: 'notebook-bridge.audioOverview',
  SWITCH_NOTEBOOK: 'notebook-bridge.switchNotebook',
  AUTH_STATUS: 'notebook-bridge.authStatus'
} as const;

export const CONFIG_KEYS = {
  SOURCES_DIR: 'notebookBridge.sourcesDir',
  RESEARCH_OUTPUT_DIR: 'notebookBridge.researchOutputDir',
  AUTO_SYNC: 'notebookBridge.autoSync',
  DEFAULT_RESEARCH_MODE: 'notebookBridge.defaultResearchMode',
  ACTIVE_NOTEBOOK_ID: 'notebookBridge.activeNotebookId'
} as const;

export const DEFAULTS = {
  SOURCES_DIR: 'docs/notebooklm_sources',
  RESEARCH_OUTPUT_DIR: 'docs/research',
  RESEARCH_MODE: 'fast' as 'fast' | 'deep',
  SESSION_CHECK_INTERVAL_MS: 30 * 60 * 1000 // 30 minutes
} as const;

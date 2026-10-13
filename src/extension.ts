/**
 * AGY Notebook Bridge — Main Extension Entrypoint
 * Activates on startup, mounts research panel in Activity Bar, handles commands & subscriptions.
 */

import * as vscode from 'vscode';
import { COMMANDS, PANEL_VIEW_ID, CONFIG_KEYS, DEFAULTS } from './constants';
import { checkNotebookLMAuth, AuthStatus } from './auth/preflight';
import { SessionWatcher } from './auth/sessionWatcher';
import { NotebookClient } from './api/notebookClient';
import { QueryRunner } from './api/queryRunner';
import { DeltaSyncEngine } from './sync/deltaSync';
import { WorkspaceWatcher } from './sync/workspaceWatcher';
import { AudioOverviewService } from './audio/audioOverview';
import { StatusBarController } from './ui/statusBarItem';
import { NotebookPanelProvider } from './ui/notebookPanel';

let _sessionWatcher: SessionWatcher | null = null;
let _statusBar: StatusBarController | null = null;
let _workspaceWatcher: WorkspaceWatcher | null = null;
let _panelProvider: NotebookPanelProvider | null = null;

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  // 1. Initialize core service layer
  const client = new NotebookClient();
  const queryRunner = new QueryRunner();
  const deltaSync = new DeltaSyncEngine(client);
  const audioService = new AudioOverviewService();

  // 2. Initialize UI controllers
  _statusBar = new StatusBarController();
  context.subscriptions.push(_statusBar);

  // 3. Initialize background watchers
  _sessionWatcher = new SessionWatcher();
  context.subscriptions.push(_sessionWatcher);

  _sessionWatcher.onDidChangeStatus((status) => {
    _statusBar?.updateStatus(status);
    _panelProvider?.postMessage({ type: 'authStatus', status });
  });

  // 4. Register Webview Provider for Activity Bar
  _panelProvider = new NotebookPanelProvider(
    context.extensionUri,
    client,
    queryRunner,
    deltaSync,
    () => _sessionWatcher?.getStatus() ?? null
  );
  context.subscriptions.push(_panelProvider);

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(PANEL_VIEW_ID, _panelProvider, {
      webviewOptions: { retainContextWhenHidden: true }
    })
  );

  // 5. Register Workspace file watcher for source sync
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (workspaceFolders && workspaceFolders.length > 0) {
    const config = vscode.workspace.getConfiguration();
    const sourcesDir = config.get<string>(CONFIG_KEYS.SOURCES_DIR) || DEFAULTS.SOURCES_DIR;
    const autoSync = config.get<boolean>(CONFIG_KEYS.AUTO_SYNC) ?? true;

    if (autoSync) {
      _workspaceWatcher = new WorkspaceWatcher(
        workspaceFolders[0].uri.fsPath,
        sourcesDir,
        async () => {
          const activeNotebookId = config.get<string>(CONFIG_KEYS.ACTIVE_NOTEBOOK_ID);
          if (activeNotebookId) {
            _statusBar?.setSyncing(true);
            const syncResult = await deltaSync.syncSourcesToNotebook(sourcesDir, activeNotebookId);
            _statusBar?.updateStatus(_sessionWatcher?.getStatus() ?? null);
            _panelProvider?.postMessage({ type: 'syncResult', result: syncResult });
          }
        }
      );
      _workspaceWatcher.start();
      context.subscriptions.push(_workspaceWatcher);
    }
  }

  // 6. Register commands
  context.subscriptions.push(
    vscode.commands.registerCommand(COMMANDS.OPEN_PANEL, () => {
      vscode.commands.executeCommand(`${PANEL_VIEW_ID}.focus`);
    }),

    vscode.commands.registerCommand(COMMANDS.AUTH_STATUS, async () => {
      const status = await checkNotebookLMAuth();
      if (status.ok) {
        vscode.window.showInformationMessage(
          `NotebookLM Connected: ${status.email || 'Authenticated'}`
        );
      } else {
        vscode.window.showWarningMessage(
          `NotebookLM Disconnected: ${status.error || 'Token expired'}`
        );
      }
    }),

    vscode.commands.registerCommand(COMMANDS.SWITCH_NOTEBOOK, async () => {
      const notebooks = await client.listNotebooks();
      if (notebooks.length === 0) {
        vscode.window.showWarningMessage('No notebooks found or failed to fetch notebook list.');
        return;
      }

      const items = notebooks.map((nb) => ({
        label: nb.title,
        description: `${nb.sourceCount} sources`,
        detail: nb.id,
        notebook: nb
      }));

      const selected = await vscode.window.showQuickPick(items, {
        placeHolder: 'Select active NotebookLM notebook for current workspace'
      });

      if (selected) {
        const config = vscode.workspace.getConfiguration();
        await config.update(
          CONFIG_KEYS.ACTIVE_NOTEBOOK_ID,
          selected.notebook.id,
          vscode.ConfigurationTarget.Workspace
        );
        vscode.window.showInformationMessage(
          `Active notebook set to: ${selected.notebook.title}`
        );
        _panelProvider?.postMessage({
          type: 'activeNotebookChanged',
          notebookId: selected.notebook.id
        });
      }
    }),

    vscode.commands.registerCommand(COMMANDS.SYNC_SOURCES, async () => {
      const folders = vscode.workspace.workspaceFolders;
      if (!folders || folders.length === 0) {
        vscode.window.showErrorMessage('No workspace open to sync sources.');
        return;
      }

      const config = vscode.workspace.getConfiguration();
      const notebookId = config.get<string>(CONFIG_KEYS.ACTIVE_NOTEBOOK_ID);
      if (!notebookId) {
        vscode.window.showWarningMessage(
          'No active notebook selected. Run "Notebook Bridge: Switch Active Notebook" first.'
        );
        return;
      }

      const sourcesDir = config.get<string>(CONFIG_KEYS.SOURCES_DIR) || DEFAULTS.SOURCES_DIR;
      _statusBar?.setSyncing(true);

      const syncResult = await deltaSync.syncSourcesToNotebook(sourcesDir, notebookId);
      _statusBar?.updateStatus(_sessionWatcher?.getStatus() ?? null);

      vscode.window.showInformationMessage(
        `NotebookLM: Synced ${syncResult.uploaded.length} sources (${syncResult.skipped.length} unchanged)`
      );
      _panelProvider?.postMessage({ type: 'syncResult', result: syncResult });
    }),

    vscode.commands.registerCommand(COMMANDS.RUN_QUERY, async () => {
      vscode.commands.executeCommand(`${PANEL_VIEW_ID}.focus`);
    }),

    vscode.commands.registerCommand(COMMANDS.AUDIO_OVERVIEW, async () => {
      const folders = vscode.workspace.workspaceFolders;
      if (!folders || folders.length === 0) {
        vscode.window.showErrorMessage('No workspace open.');
        return;
      }

      const config = vscode.workspace.getConfiguration();
      const notebookId = config.get<string>(CONFIG_KEYS.ACTIVE_NOTEBOOK_ID);
      if (!notebookId) {
        vscode.window.showWarningMessage('No active notebook selected.');
        return;
      }

      vscode.window.showInformationMessage('Generating Audio Overview podcast... this may take 1-2 minutes.');
      const result = await audioService.generateAudioOverview(
        notebookId,
        vscode.Uri.joinPath(folders[0].uri, 'docs', 'audio').fsPath
      );

      if (result.ok && result.filePath) {
        vscode.window.showInformationMessage(`Audio Overview ready: ${result.filePath}`);
        _panelProvider?.postMessage({ type: 'audioReady', filePath: result.filePath });
      } else {
        vscode.window.showErrorMessage(`Audio Overview failed: ${result.error}`);
      }
    })
  );

  // 7. Non-blocking initial check
  _sessionWatcher.start();
}

export function deactivate(): void {
  try {
    _sessionWatcher?.dispose();
    _sessionWatcher = null;
  } catch {}

  try {
    _workspaceWatcher?.dispose();
    _workspaceWatcher = null;
  } catch {}

  try {
    _statusBar?.dispose();
    _statusBar = null;
  } catch {}

  try {
    _panelProvider?.dispose();
    _panelProvider = null;
  } catch {}
}

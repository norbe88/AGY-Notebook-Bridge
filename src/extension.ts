/**
 * AGY Notebook Bridge — Main Extension Entrypoint
 * Activates on startup, mounts research panel in Activity Bar, handles commands & subscriptions.
 */

import * as vscode from 'vscode';
import * as path from 'path';
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
import { ProfileManager } from './auth/profileManager';

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
  const profileManager = new ProfileManager();

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

  _sessionWatcher.start();
  profileManager.ensureAGYDefaultSync().catch(() => {});

  const handleAccountSwitched = async () => {
    const newStatus = await _sessionWatcher?.checkNow();
    if (newStatus?.ok) {
      const nbs = await client.listNotebooks();
      _panelProvider?.postMessage({ type: 'notebookList', notebooks: nbs });
    }
  };

  // 4. Register Webview Provider for Activity Bar
  _panelProvider = new NotebookPanelProvider(
    context.extensionUri,
    client,
    queryRunner,
    deltaSync,
    () => _sessionWatcher?.getStatus() ?? null,
    () => _sessionWatcher?.triggerReauthentication(),
    () => profileManager.promptSwitchAccount(handleAccountSwitched)
  );
  context.subscriptions.push(_panelProvider);

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(PANEL_VIEW_ID, _panelProvider, {
      webviewOptions: { retainContextWhenHidden: true }
    })
  );

  // 5. Register Workspace file watcher for source sync (< 10s auto-sync)
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (workspaceFolders && workspaceFolders.length > 0) {
    const config = vscode.workspace.getConfiguration();
    const sourcesDir = config.get<string>(CONFIG_KEYS.SOURCES_DIR) || DEFAULTS.SOURCES_DIR;
    const autoSync = config.get<boolean>(CONFIG_KEYS.AUTO_SYNC) ?? true;

    if (autoSync) {
      const fullSourcesPath = path.isAbsolute(sourcesDir)
        ? sourcesDir
        : path.join(workspaceFolders[0].uri.fsPath, sourcesDir);

      _workspaceWatcher = new WorkspaceWatcher(
        workspaceFolders[0].uri.fsPath,
        sourcesDir,
        async () => {
          const activeNotebookId = config.get<string>(CONFIG_KEYS.ACTIVE_NOTEBOOK_ID);
          if (activeNotebookId) {
            _statusBar?.setSyncing(true);
            const syncResult = await deltaSync.syncSourcesToNotebook(
              fullSourcesPath,
              activeNotebookId,
              (current, total, file) => {
                _statusBar?.setSyncProgress(current, total, file);
              }
            );
            _statusBar?.updateStatus(_sessionWatcher?.getStatus() ?? null);
            _panelProvider?.postMessage({ type: 'syncResult', result: syncResult });
            if (syncResult.uploaded.length > 0) {
              vscode.window.showInformationMessage(
                `NotebookLM: Auto-synced ${syncResult.uploaded.length} source(s) in < 10s`
              );
            }
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
          `NotebookLM: ${status.error || 'Authentication token expired.'}`,
          'Re-authenticate'
        ).then((choice) => {
          if (choice === 'Re-authenticate') {
            _sessionWatcher?.triggerReauthentication();
          }
        });
      }
    }),

    vscode.commands.registerCommand(COMMANDS.REAUTHENTICATE, () => {
      _sessionWatcher?.triggerReauthentication();
    }),

    vscode.commands.registerCommand(COMMANDS.SWITCH_ACCOUNT, () => {
      profileManager.promptSwitchAccount(handleAccountSwitched);
    }),

    vscode.commands.registerCommand(COMMANDS.SWITCH_NOTEBOOK, async () => {
      const config = vscode.workspace.getConfiguration();
      const currentId = config.get<string>(CONFIG_KEYS.ACTIVE_NOTEBOOK_ID) || '';

      const notebooks = await client.listNotebooks();

      type QuickPickItemWithId = vscode.QuickPickItem & { notebookId?: string; isManual?: boolean };
      const items: QuickPickItemWithId[] = notebooks.map((nb) => ({
        label: `${nb.id === currentId ? '$(check) ' : ''}${nb.title}`,
        description: `${nb.sourceCount} sources`,
        detail: nb.id,
        notebookId: nb.id
      }));

      items.push({
        label: '$(edit) Enter Notebook ID manually...',
        description: 'Set custom or shared Notebook ID',
        isManual: true
      });

      const selected = await vscode.window.showQuickPick(items, {
        placeHolder: currentId
          ? `Current: ${currentId} — Select or enter Notebook ID`
          : 'Select active NotebookLM notebook for current workspace'
      });

      if (!selected) return;

      let chosenId: string | undefined;
      let chosenTitle = 'Custom Notebook';

      if (selected.isManual) {
        chosenId = await vscode.window.showInputBox({
          prompt: 'Enter NotebookLM Notebook ID or UUID',
          value: currentId,
          placeHolder: 'e.g. 773c0f5a-f01b-431e-8a56-b2fedce397ac'
        });
        if (!chosenId?.trim()) return;
        chosenId = chosenId.trim();
      } else {
        chosenId = selected.notebookId;
        chosenTitle = selected.label.replace('$(check) ', '');
      }

      if (chosenId) {
        await config.update(
          CONFIG_KEYS.ACTIVE_NOTEBOOK_ID,
          chosenId,
          vscode.ConfigurationTarget.Workspace
        );
        vscode.window.showInformationMessage(
          `Active notebook set to: ${chosenTitle} (${chosenId})`
        );
        _panelProvider?.postMessage({
          type: 'activeNotebookChanged',
          notebookId: chosenId
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

      const sourcesRelDir = config.get<string>(CONFIG_KEYS.SOURCES_DIR) || DEFAULTS.SOURCES_DIR;
      const fullSourcesPath = path.isAbsolute(sourcesRelDir)
        ? sourcesRelDir
        : path.join(folders[0].uri.fsPath, sourcesRelDir);

      _statusBar?.setSyncing(true);

      const syncResult = await deltaSync.syncSourcesToNotebook(
        fullSourcesPath,
        notebookId,
        (current, total, file) => {
          _statusBar?.setSyncProgress(current, total, file);
        }
      );
      _statusBar?.updateStatus(_sessionWatcher?.getStatus() ?? null);

      vscode.window.showInformationMessage(
        `NotebookLM: Synced ${syncResult.uploaded.length} sources (${syncResult.skipped.length} unchanged)`
      );
      _panelProvider?.postMessage({ type: 'syncResult', result: syncResult });
    }),

    vscode.commands.registerCommand(COMMANDS.ADD_FILE_AS_SOURCE, async (fileUri?: vscode.Uri) => {
      let targetUri = fileUri;
      if (!targetUri) {
        const activeEditor = vscode.window.activeTextEditor;
        if (activeEditor) {
          targetUri = activeEditor.document.uri;
        }
      }

      if (!targetUri || targetUri.scheme !== 'file') {
        vscode.window.showErrorMessage('Please select a local Markdown, PDF, or text file.');
        return;
      }

      const ext = path.extname(targetUri.fsPath).toLowerCase();
      if (!['.md', '.pdf', '.txt'].includes(ext)) {
        vscode.window.showWarningMessage(
          `NotebookLM supports .md, .pdf, and .txt files. "${ext}" is not supported.`
        );
        return;
      }

      const config = vscode.workspace.getConfiguration();
      let notebookId = config.get<string>(CONFIG_KEYS.ACTIVE_NOTEBOOK_ID);
      if (!notebookId) {
        await vscode.commands.executeCommand(COMMANDS.SWITCH_NOTEBOOK);
        notebookId = config.get<string>(CONFIG_KEYS.ACTIVE_NOTEBOOK_ID);
        if (!notebookId) return;
      }

      const folders = vscode.workspace.workspaceFolders;
      const workspaceRoot = folders && folders.length > 0 ? folders[0].uri.fsPath : '';
      const sourcesRelDir = config.get<string>(CONFIG_KEYS.SOURCES_DIR) || DEFAULTS.SOURCES_DIR;
      const sourcesDir = workspaceRoot ? path.join(workspaceRoot, sourcesRelDir) : undefined;

      const filename = path.basename(targetUri.fsPath);
      _statusBar?.setSyncing(true, `$(sync~spin) Adding ${filename}...`);

      const res = await deltaSync.syncSingleFile(targetUri.fsPath, notebookId, sourcesDir);
      _statusBar?.updateStatus(_sessionWatcher?.getStatus() ?? null);

      if (res.ok) {
        if (res.skipped) {
          vscode.window.showInformationMessage(
            `NotebookLM: ${filename} is already up to date (hash matches).`
          );
        } else {
          vscode.window.showInformationMessage(
            `NotebookLM: Added ${filename} as source!`
          );
        }
        _panelProvider?.postMessage({ type: 'sourceAdded', file: filename });
      } else {
        vscode.window.showErrorMessage(`Failed to add source: ${res.error}`);
      }
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

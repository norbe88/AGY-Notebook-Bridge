/**
 * Notebook Panel Webview Provider
 * Renders the Research Panel in the Activity Bar sidebar.
 */

import * as vscode from 'vscode';
import * as path from 'path';
import { NotebookClient } from '../api/notebookClient';
import { QueryRunner } from '../api/queryRunner';
import { DeltaSyncEngine } from '../sync/deltaSync';
import { AuthStatus } from '../auth/preflight';
import { COMMANDS, CONFIG_KEYS, DEFAULTS } from '../constants';

export class NotebookPanelProvider implements vscode.WebviewViewProvider, vscode.Disposable {
  private view?: vscode.WebviewView;

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly client: NotebookClient,
    private readonly queryRunner: QueryRunner,
    private readonly deltaSync: DeltaSyncEngine,
    private getLatestAuthStatus: () => AuthStatus | null
  ) {}

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ): void {
    this.view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this.extensionUri]
    };

    webviewView.webview.html = this.getHtmlForWebview(webviewView.webview);

    webviewView.webview.onDidReceiveMessage(async (message) => {
      try {
        await this.handleMessage(message);
      } catch (err: any) {
        this.postMessage({
          type: 'error',
          message: err.message || 'Internal Webview Error'
        });
      }
    });

    // Send initial bootstrap state
    this.postMessage({
      type: 'authStatus',
      status: this.getLatestAuthStatus()
    });
  }

  public postMessage(message: any): void {
    try {
      this.view?.webview.postMessage(message);
    } catch {}
  }

  private async handleMessage(message: any): Promise<void> {
    switch (message.type) {
      case 'ready': {
        this.postMessage({
          type: 'authStatus',
          status: this.getLatestAuthStatus()
        });
        const config = vscode.workspace.getConfiguration();
        const activeNotebookId = config.get<string>(CONFIG_KEYS.ACTIVE_NOTEBOOK_ID);
        if (activeNotebookId) {
          this.postMessage({
            type: 'activeNotebookChanged',
            notebookId: activeNotebookId
          });
        }
        const notebooks = await this.client.listNotebooks();
        this.postMessage({
          type: 'notebookList',
          notebooks
        });
        break;
      }

      case 'selectNotebook': {
        const { notebookId } = message;
        if (notebookId) {
          const config = vscode.workspace.getConfiguration();
          await config.update(
            CONFIG_KEYS.ACTIVE_NOTEBOOK_ID,
            notebookId,
            vscode.ConfigurationTarget.Workspace
          );
        }
        break;
      }

      case 'reauthenticate': {
        vscode.commands.executeCommand(COMMANDS.REAUTHENTICATE);
        break;
      }

      case 'getAuthStatus': {
        this.postMessage({
          type: 'authStatus',
          status: this.getLatestAuthStatus()
        });
        break;
      }

      case 'listNotebooks': {
        const notebooks = await this.client.listNotebooks();
        this.postMessage({
          type: 'notebookList',
          notebooks
        });
        break;
      }

      case 'runQuery': {
        const { notebookId, query, mode } = message;
        if (!notebookId || !query) {
          this.postMessage({ type: 'queryError', error: 'Missing notebook ID or query' });
          return;
        }

        try {
          this.postMessage({ type: 'queryStart' });
          const result = await this.queryRunner.executeQuery({
            notebookId,
            query,
            mode: mode || 'fast',
            onChunk: (chunk) => {
              this.postMessage({ type: 'queryChunk', chunk });
            }
          });
          this.postMessage({ type: 'queryDone', content: result.content });
        } catch (err: any) {
          this.postMessage({ type: 'queryError', error: err.message });
        }
        break;
      }

      case 'saveResult': {
        const { query, content } = message;
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) {
          vscode.window.showErrorMessage('No workspace open to save research notes.');
          return;
        }

        const config = vscode.workspace.getConfiguration();
        const outputDir =
          config.get<string>(CONFIG_KEYS.RESEARCH_OUTPUT_DIR) ||
          DEFAULTS.RESEARCH_OUTPUT_DIR;

        const savedPath = this.queryRunner.saveResult(
          workspaceFolders[0].uri.fsPath,
          outputDir,
          query,
          content
        );

        vscode.window.showInformationMessage(`Research saved to: ${savedPath}`);
        this.postMessage({ type: 'savedSuccess', path: savedPath });
        break;
      }

      case 'syncSources': {
        const { notebookId } = message;
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) {
          vscode.window.showErrorMessage('No workspace open to sync sources.');
          return;
        }

        const config = vscode.workspace.getConfiguration();
        const sourcesRelDir =
          config.get<string>(CONFIG_KEYS.SOURCES_DIR) || DEFAULTS.SOURCES_DIR;
        const fullSourcesPath = path.isAbsolute(sourcesRelDir)
          ? sourcesRelDir
          : path.join(workspaceFolders[0].uri.fsPath, sourcesRelDir);

        const syncResult = await this.deltaSync.syncSourcesToNotebook(
          fullSourcesPath,
          notebookId
        );

        this.postMessage({ type: 'syncResult', result: syncResult });
        vscode.window.showInformationMessage(
          `NotebookLM: Synced ${syncResult.uploaded.length} sources (${syncResult.skipped.length} unchanged)`
        );
        break;
      }
    }
  }

  private getHtmlForWebview(webview: vscode.Webview): string {
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'out', 'webview', 'panel.js')
    );
    const cssUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'out', 'webview', 'global.css')
    );

    const nonce = getNonce();

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}'; img-src ${webview.cspSource} data:; font-src ${webview.cspSource}; media-src ${webview.cspSource} blob: data:;">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="stylesheet" href="${cssUri}">
  <title>NotebookLM Research</title>
</head>
<body>
  <div id="root"></div>
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
  }

  public dispose(): void {
    try {
      this.view = undefined;
    } catch {}
  }
}

function getNonce(): string {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}

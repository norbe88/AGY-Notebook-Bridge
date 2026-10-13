/**
 * Status Bar Controller
 * Displays NotebookLM connection status, active notebook, and sync state in status bar.
 */

import * as vscode from 'vscode';
import { COMMANDS } from '../constants';
import { AuthStatus } from '../auth/preflight';

export class StatusBarController implements vscode.Disposable {
  private item: vscode.StatusBarItem;

  constructor() {
    this.item = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Right,
      100
    );
    this.item.command = COMMANDS.OPEN_PANEL;
    this.item.text = '$(book) NotebookLM: Initializing...';
    this.item.show();
  }

  public updateStatus(status: AuthStatus | null): void {
    if (!status) {
      this.item.text = '$(book) NotebookLM: Unknown';
      this.item.tooltip = 'Click to open NotebookLM Research Panel';
      this.item.backgroundColor = undefined;
      return;
    }

    if (status.ok) {
      const emailSuffix = status.email ? ` (${status.email})` : '';
      this.item.text = `$(book) NotebookLM: Connected${emailSuffix}`;
      this.item.tooltip = `NotebookLM Connected${emailSuffix}\nClick to open Research Panel`;
      this.item.backgroundColor = undefined;
    } else {
      this.item.text = '$(warning) NotebookLM: Auth Expired';
      this.item.tooltip = status.error || 'Authentication token expired. Click to re-authenticate.';
      this.item.backgroundColor = new vscode.ThemeColor(
        'statusBarItem.warningBackground'
      );
    }
  }

  public setSyncing(isSyncing: boolean, text?: string): void {
    if (isSyncing) {
      this.item.text = text || '$(sync~spin) NotebookLM: Syncing...';
    }
  }

  public dispose(): void {
    try {
      this.item.dispose();
    } catch {}
  }
}

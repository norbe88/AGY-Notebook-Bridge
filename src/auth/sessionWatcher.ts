/**
 * Session Watcher Daemon
 * Monitors NotebookLM auth status every 30 minutes and notifies UI.
 */

import * as vscode from 'vscode';
import { checkNotebookLMAuth, AuthStatus } from './preflight';
import { DEFAULTS } from '../constants';

export class SessionWatcher implements vscode.Disposable {
  private timer: NodeJS.Timeout | null = null;
  private currentStatus: AuthStatus | null = null;
  private readonly onDidChangeStatusEmitter = new vscode.EventEmitter<AuthStatus>();
  public readonly onDidChangeStatus = this.onDidChangeStatusEmitter.event;

  constructor(private readonly intervalMs: number = DEFAULTS.SESSION_CHECK_INTERVAL_MS) {}

  public start(): void {
    // Immediate initial check
    this.checkNow().catch(() => {});

    // Periodic daemon timer
    this.timer = setInterval(() => {
      this.checkNow().catch(() => {});
    }, this.intervalMs);
  }

  public async checkNow(): Promise<AuthStatus> {
    const status = await checkNotebookLMAuth();
    this.currentStatus = status;
    this.onDidChangeStatusEmitter.fire(status);

    if (!status.ok && status.error?.toLowerCase().includes('expired')) {
      this.notifyExpired();
    }

    return status;
  }

  public getStatus(): AuthStatus | null {
    return this.currentStatus;
  }

  private notifyExpired(): void {
    vscode.window.showWarningMessage(
      'NotebookLM authentication token has expired.',
      'Re-authenticate'
    ).then((choice) => {
      if (choice === 'Re-authenticate') {
        const terminal = vscode.window.createTerminal('NotebookLM Auth');
        terminal.show();
        terminal.sendText('notebooklm login --browser chrome');
      }
    });
  }

  public dispose(): void {
    try {
      if (this.timer) {
        clearInterval(this.timer);
        this.timer = null;
      }
    } catch {}

    try {
      this.onDidChangeStatusEmitter.dispose();
    } catch {}
  }
}

/**
 * Session Watcher Daemon
 * Monitors NotebookLM auth status every 30 minutes, updates status bar, and triggers 1-click re-auth.
 */

import * as vscode from 'vscode';
import { checkNotebookLMAuth, AuthStatus } from './preflight';
import { DEFAULTS } from '../constants';

export class SessionWatcher implements vscode.Disposable {
  private timer: NodeJS.Timeout | null = null;
  private currentStatus: AuthStatus | null = null;
  private hasPromptedThisSession = false;
  private readonly onDidChangeStatusEmitter = new vscode.EventEmitter<AuthStatus>();
  public readonly onDidChangeStatus = this.onDidChangeStatusEmitter.event;

  constructor(private readonly intervalMs: number = DEFAULTS.SESSION_CHECK_INTERVAL_MS) {}

  public start(): void {
    // Immediate non-blocking check on startup (< 3s SLA)
    this.checkNow().catch(() => {});

    // Periodic 30-minute keepalive check
    this.timer = setInterval(() => {
      this.checkNow().catch(() => {});
    }, this.intervalMs);
  }

  public async checkNow(): Promise<AuthStatus> {
    const status = await checkNotebookLMAuth();
    this.currentStatus = status;
    this.onDidChangeStatusEmitter.fire(status);

    if (!status.ok && !this.hasPromptedThisSession) {
      this.hasPromptedThisSession = true;
      this.notifyExpired(status.error);
    } else if (status.ok) {
      this.hasPromptedThisSession = false;
    }

    return status;
  }

  public getStatus(): AuthStatus | null {
    return this.currentStatus;
  }

  public notifyExpired(errorMessage?: string): void {
    const msg = errorMessage
      ? `NotebookLM: ${errorMessage}`
      : 'NotebookLM authentication token has expired.';

    vscode.window.showWarningMessage(msg, 'Re-authenticate').then((choice) => {
      if (choice === 'Re-authenticate') {
        this.triggerReauthentication();
      }
    });
  }

  public triggerReauthentication(): void {
    const terminal = vscode.window.createTerminal('NotebookLM Auth');
    terminal.show();
    terminal.sendText('notebooklm login --browser chrome');

    vscode.window.showInformationMessage(
      'NotebookLM browser login launched. After completing login, click "Check Auth Status".'
    );
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

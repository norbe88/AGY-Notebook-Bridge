/**
 * Session Watcher Daemon
 * Monitors NotebookLM auth status every 30 minutes, watches storage_state.json delta,
 * updates status bar, and triggers reliable 1-click re-auth.
 */

import * as vscode from 'vscode';
import * as fs from 'fs';
import { spawn } from 'child_process';
import { checkNotebookLMAuth, AuthStatus, getNotebookLMCli, resolveStoragePath } from './preflight';
import { DEFAULTS } from '../constants';

export class SessionWatcher implements vscode.Disposable {
  private timer: NodeJS.Timeout | null = null;
  private fileWatcher: fs.FSWatcher | null = null;
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

    // Watch storage_state.json delta for instant token detection
    const storagePath = resolveStoragePath();
    if (storagePath && fs.existsSync(storagePath)) {
      try {
        this.fileWatcher = fs.watch(storagePath, (eventType) => {
          if (eventType === 'change') {
            setTimeout(() => {
              this.checkNow().catch(() => {});
            }, 500);
          }
        });
      } catch (err) {
        console.warn('[SessionWatcher] Could not attach file watcher to storage_state.json:', err);
      }
    }
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
    const { cmd, baseArgs } = getNotebookLMCli();
    const loginArgs = [...baseArgs, 'login', '--browser', 'chrome'];

    // 1. Launch detached external process so Chrome opens unconditionally on Windows
    try {
      if (process.platform === 'win32') {
        const fullCmd = `& "${cmd}" ${loginArgs.map((a) => `"${a}"`).join(' ')}`;
        const child = spawn('powershell.exe', ['-NoProfile', '-Command', fullCmd], {
          detached: true,
          stdio: 'ignore'
        });
        child.unref();
      } else {
        const child = spawn(cmd, loginArgs, { detached: true, stdio: 'ignore' });
        child.unref();
      }
    } catch (err) {
      console.error('[SessionWatcher] Failed to spawn login process:', err);
    }

    // 2. Open integrated terminal for full transparency and fallback interaction
    const terminal = vscode.window.createTerminal('NotebookLM Auth');
    terminal.show(true);
    setTimeout(() => {
      const execLine = process.platform === 'win32'
        ? `& "${cmd}" ${loginArgs.map((a) => `"${a}"`).join(' ')}`
        : `${cmd} ${loginArgs.join(' ')}`;
      terminal.sendText(execLine);
    }, 600);

    vscode.window.showInformationMessage(
      'NotebookLM: Chrome login launched. Sign in to your Google account in Chrome.',
      'Check Status'
    ).then((choice) => {
      if (choice === 'Check Status') {
        this.checkNow();
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
      if (this.fileWatcher) {
        this.fileWatcher.close();
        this.fileWatcher = null;
      }
    } catch {}

    try {
      this.onDidChangeStatusEmitter.dispose();
    } catch {}
  }
}

/**
 * Workspace File Watcher
 * Watches docs/notebooklm_sources/ for changes and triggers delta sync.
 */

import * as vscode from 'vscode';

export class WorkspaceWatcher implements vscode.Disposable {
  private watcher: vscode.FileSystemWatcher | null = null;
  private debounceTimer: NodeJS.Timeout | null = null;

  constructor(
    private readonly workspaceRoot: string,
    private readonly sourcesRelativeDir: string,
    private readonly onFilesChanged: () => void
  ) {}

  public start(): void {
    const pattern = new vscode.RelativePattern(
      this.workspaceRoot,
      `${this.sourcesRelativeDir}/**`
    );

    this.watcher = vscode.workspace.createFileSystemWatcher(pattern);

    this.watcher.onDidCreate(() => this.triggerDebounced());
    this.watcher.onDidChange(() => this.triggerDebounced());
    this.watcher.onDidDelete(() => this.triggerDebounced());
  }

  private triggerDebounced(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
    this.debounceTimer = setTimeout(() => {
      this.onFilesChanged();
    }, 2000);
  }

  public dispose(): void {
    try {
      if (this.debounceTimer) {
        clearTimeout(this.debounceTimer);
        this.debounceTimer = null;
      }
    } catch {}

    try {
      this.watcher?.dispose();
      this.watcher = null;
    } catch {}
  }
}

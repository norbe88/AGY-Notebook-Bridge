/**
 * Profile & Account Manager
 * Manages multiple Google NotebookLM profiles and accounts via CLI.
 */

import * as vscode from 'vscode';
import { execFile, spawn } from 'child_process';
import { promisify } from 'util';
import { getNotebookLMCli } from './preflight';

const execFileAsync = promisify(execFile);

export interface ProfileInfo {
  name: string;
  active: boolean;
  authenticated: boolean;
  account?: string;
}

export class ProfileManager {
  /**
   * Retrieves all profiles and accounts from NotebookLM CLI
   */
  public async listProfiles(): Promise<ProfileInfo[]> {
    const { cmd, baseArgs } = getNotebookLMCli();
    try {
      const args = [...baseArgs, 'profile', 'list', '--json'];
      const { stdout } = await execFileAsync(cmd, args, { timeout: 6000 });
      const parsed = JSON.parse(stdout.trim());
      if (parsed && Array.isArray(parsed.profiles)) {
        return parsed.profiles;
      }
    } catch (err) {
      console.warn('[ProfileManager] Failed to list profiles via CLI:', err);
    }

    return [{ name: 'default', active: true, authenticated: true }];
  }

  /**
   * Retrieves the current logged-in Google / Antigravity account in Antigravity IDE
   */
  public async getAGYDefaultAccount(): Promise<string | null> {
    for (const provider of ['google', 'antigravity-auth']) {
      try {
        const session = await vscode.authentication.getSession(
          provider,
          ['https://www.googleapis.com/auth/userinfo.email'],
          { createIfNone: false }
        );
        if (session?.account?.label) {
          return session.account.label.toLowerCase();
        }
      } catch {}
    }
    return null;
  }

  /**
   * Automatically sets active profile to match AGY logged-in user if available
   */
  public async ensureAGYDefaultSync(): Promise<void> {
    const agyEmail = await this.getAGYDefaultAccount();
    if (!agyEmail) return;

    const profiles = await this.listProfiles();
    const active = profiles.find((p) => p.active);

    if (active?.account?.toLowerCase() === agyEmail) return;

    const matchingProfile = profiles.find((p) => p.account?.toLowerCase() === agyEmail);
    if (matchingProfile) {
      await this.switchProfile(matchingProfile.name);
    }
  }

  /**
   * Switches the active default profile
   */
  public async switchProfile(name: string): Promise<boolean> {
    const { cmd, baseArgs } = getNotebookLMCli();
    try {
      const args = [...baseArgs, 'profile', 'switch', name, '--json'];
      await execFileAsync(cmd, args, { timeout: 6000 });
      return true;
    } catch (err) {
      console.error(`[ProfileManager] Failed to switch profile to ${name}:`, err);
      return false;
    }
  }

  /**
   * Creates a new profile directory
   */
  public async createProfile(name: string): Promise<boolean> {
    const { cmd, baseArgs } = getNotebookLMCli();
    try {
      const args = [...baseArgs, 'profile', 'create', name, '--json'];
      await execFileAsync(cmd, args, { timeout: 6000 });
      return true;
    } catch (err) {
      console.error(`[ProfileManager] Failed to create profile ${name}:`, err);
      return false;
    }
  }

  /**
   * Spawns detached Google Chrome login for a specific profile or fresh account
   */
  public loginProfile(profileName?: string, fresh: boolean = false): void {
    const { cmd, baseArgs } = getNotebookLMCli();
    const loginArgs = [...baseArgs];

    if (profileName && profileName !== 'default') {
      loginArgs.push('-p', profileName);
    }

    loginArgs.push('login', '--browser', 'chrome');
    if (fresh) {
      loginArgs.push('--fresh');
    }

    // Open integrated terminal directly with full desktop interactive station
    const terminal = vscode.window.createTerminal(`NotebookLM Auth${profileName ? ` (${profileName})` : ''}`);
    terminal.show(true);
    setTimeout(() => {
      const execLine = process.platform === 'win32'
        ? `& "${cmd}" ${loginArgs.map((a) => `"${a}"`).join(' ')}`
        : `${cmd} ${loginArgs.join(' ')}`;
      terminal.sendText(execLine);
    }, 600);
  }

  /**
   * Interactive QuickPick to switch account profile or add a new one
   */
  public async promptSwitchAccount(onSwitched?: () => void): Promise<void> {
    const profiles = await this.listProfiles();
    const agyEmail = await this.getAGYDefaultAccount();

    type ProfilePickItem = vscode.QuickPickItem & {
      profileName?: string;
      action?: 'switch' | 'create' | 'fresh' | 'agy-link';
    };

    const items: ProfilePickItem[] = [
      {
        label: 'Profiles / Google Accounts',
        kind: vscode.QuickPickItemKind.Separator
      }
    ];

    for (const p of profiles) {
      const isCurrent = p.active;
      const isAgyMatch = agyEmail && p.account?.toLowerCase() === agyEmail.toLowerCase();
      const accountLabel = p.account ? ` (${p.account})` : '';
      let desc = isCurrent ? 'Active Account' : p.authenticated ? 'Configured' : 'Needs Auth';
      if (isAgyMatch) {
        desc = isCurrent ? 'Active (Default AGY Account)' : 'Default AGY Account';
      }

      items.push({
        label: `${isCurrent ? '$(check) ' : '$(account) '}${p.name}${accountLabel}`,
        description: desc,
        detail: `Profile: ${p.name}`,
        profileName: p.name,
        action: 'switch'
      });
    }

    items.push(
      {
        label: 'Actions',
        kind: vscode.QuickPickItemKind.Separator
      }
    );

    if (agyEmail && !profiles.some((p) => p.account?.toLowerCase() === agyEmail.toLowerCase())) {
      items.push({
        label: `$(sparkle) Connect Active AGY Account: ${agyEmail}...`,
        description: 'Auto-detected from Antigravity IDE session',
        action: 'fresh'
      });
    }

    items.push(
      {
        label: '$(add) Add New Google Account / Profile...',
        description: 'Create a new named profile and sign in via Chrome',
        action: 'create'
      },
      {
        label: '$(sync) Switch Google Account in Current Profile (Fresh Sign-in)...',
        description: 'Opens clean Chrome session to pick/switch Google account',
        action: 'fresh'
      }
    );

    const selected = await vscode.window.showQuickPick(items, {
      placeHolder: 'Select active Google NotebookLM account or create a new profile'
    });

    if (!selected || !selected.action) return;

    if (selected.action === 'switch' && selected.profileName) {
      const ok = await this.switchProfile(selected.profileName);
      if (ok) {
        vscode.window.showInformationMessage(`Switched active NotebookLM profile to: ${selected.profileName}`);
        onSwitched?.();
      } else {
        vscode.window.showErrorMessage(`Failed to switch profile to: ${selected.profileName}`);
      }
    } else if (selected.action === 'create') {
      const newName = await vscode.window.showInputBox({
        prompt: 'Enter a name for the new profile (e.g. personal, client, work):',
        placeHolder: 'work',
        validateInput: (val) => {
          if (!val || !val.trim()) return 'Profile name cannot be empty';
          if (!/^[a-zA-Z0-9_-]+$/.test(val.trim())) return 'Only letters, numbers, hyphens, and underscores allowed';
          return null;
        }
      });

      if (newName) {
        const cleanName = newName.trim();
        await this.createProfile(cleanName);
        await this.switchProfile(cleanName);
        this.loginProfile(cleanName, true);
        vscode.window.showInformationMessage(
          `Created and switched to profile "${cleanName}". Complete Google sign-in in Chrome.`,
          'Refresh Status'
        ).then((choice) => {
          if (choice === 'Refresh Status') {
            onSwitched?.();
          }
        });
      }
    } else if (selected.action === 'fresh') {
      this.loginProfile(undefined, true);
      vscode.window.showInformationMessage(
        'Fresh Google Chrome login opened. Complete Google sign-in to update account session.',
        'Refresh Status'
      ).then((choice) => {
        if (choice === 'Refresh Status') {
          onSwitched?.();
        }
      });
    }
  }
}

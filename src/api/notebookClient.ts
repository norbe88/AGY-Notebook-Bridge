/**
 * NotebookLM API Client
 * Orchestrates calls to NotebookLM CLI / Internal Endpoints.
 */

import { execFile } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';

const execFileAsync = promisify(execFile);

export interface NotebookInfo {
  id: string;
  title: string;
  sourceCount: number;
  updatedAt?: string;
}

export interface SourceInfo {
  id: string;
  title: string;
  hash?: string;
  type: string;
}

export class NotebookClient {
  private readonly isWin = process.platform === 'win32';
  private readonly cliCommand = this.isWin ? 'notebooklm.cmd' : 'notebooklm';

  /**
   * Retrieves all available notebooks
   */
  public async listNotebooks(): Promise<NotebookInfo[]> {
    try {
      const { stdout } = await execFileAsync(this.cliCommand, ['list', '--json'], {
        timeout: 10000,
        shell: this.isWin
      });

      const parsed = JSON.parse(stdout.trim());
      if (Array.isArray(parsed)) {
        return parsed.map((item: any) => ({
          id: item.id || item.notebook_id,
          title: item.title || item.name || 'Untitled Notebook',
          sourceCount: item.source_count || item.sources?.length || 0,
          updatedAt: item.updated_at
        }));
      }
      return [];
    } catch {
      return [];
    }
  }

  /**
   * Returns a map of filename -> hash for remote sources in a notebook
   */
  public async getSourceHashes(notebookId: string): Promise<Map<string, string>> {
    const hashes = new Map<string, string>();
    try {
      const { stdout } = await execFileAsync(
        this.cliCommand,
        ['sources', 'list', notebookId, '--json'],
        { timeout: 10000, shell: this.isWin }
      );

      const parsed = JSON.parse(stdout.trim());
      if (Array.isArray(parsed)) {
        for (const s of parsed) {
          const name = s.title || s.name || s.filename;
          const hash = s.hash || s.checksum || '';
          if (name) {
            hashes.set(path.basename(name), hash);
          }
        }
      }
    } catch {}

    return hashes;
  }

  /**
   * Uploads a local file source into the specified notebook
   */
  public async uploadSource(notebookId: string, filePath: string): Promise<boolean> {
    try {
      await execFileAsync(
        this.cliCommand,
        ['sources', 'add', notebookId, filePath],
        { timeout: 30000, shell: this.isWin }
      );
      return true;
    } catch {
      return false;
    }
  }
}

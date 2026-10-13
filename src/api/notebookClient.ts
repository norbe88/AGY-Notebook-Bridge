/**
 * NotebookLM API Client
 * Orchestrates calls to NotebookLM CLI / Internal Endpoints.
 */

import { execFile } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import { getNotebookLMCli } from '../auth/preflight';

const execFileAsync = promisify(execFile);

export interface NotebookInfo {
  id: string;
  title: string;
  sourceCount: number;
  updatedAt?: string;
  isOwner?: boolean;
}

export interface SourceInfo {
  id: string;
  title: string;
  hash?: string;
  type: string;
}

export class NotebookClient {
  /**
   * Retrieves all available notebooks
   */
  public async listNotebooks(): Promise<NotebookInfo[]> {
    const { cmd, baseArgs } = getNotebookLMCli();
    try {
      const args = [...baseArgs, 'list', '--json'];
      const { stdout } = await execFileAsync(cmd, args, { timeout: 12000 });

      const parsed = JSON.parse(stdout.trim());
      if (Array.isArray(parsed)) {
        return parsed.map((item: any) => ({
          id: item.id || item.notebook_id,
          title: item.title || item.name || 'Untitled Notebook',
          sourceCount: item.source_count || item.sources?.length || 0,
          updatedAt: item.updated_at,
          isOwner: item.is_owner
        }));
      }
      return [];
    } catch {
      // Check if context has active notebook from `status --json`
      return this.getActiveContextNotebook();
    }
  }

  /**
   * Fallback to retrieve current context notebook if list fails or is restricted
   */
  public async getActiveContextNotebook(): Promise<NotebookInfo[]> {
    const { cmd, baseArgs } = getNotebookLMCli();
    try {
      const args = [...baseArgs, 'status', '--json'];
      const { stdout } = await execFileAsync(cmd, args, { timeout: 5000 });
      const parsed = JSON.parse(stdout.trim());
      if (parsed.has_context && parsed.notebook) {
        return [
          {
            id: parsed.notebook.id,
            title: parsed.notebook.title || 'Active Notebook',
            sourceCount: 0,
            isOwner: parsed.notebook.is_owner
          }
        ];
      }
    } catch {}
    return [];
  }

  /**
   * Returns a map of filename -> hash for remote sources in a notebook
   */
  public async getSourceHashes(notebookId: string): Promise<Map<string, string>> {
    const hashes = new Map<string, string>();
    const { cmd, baseArgs } = getNotebookLMCli();
    try {
      const args = [...baseArgs, 'source', 'list', notebookId, '--json'];
      const { stdout } = await execFileAsync(cmd, args, { timeout: 10000 });

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
    const { cmd, baseArgs } = getNotebookLMCli();
    try {
      const args = [...baseArgs, 'source', 'add', notebookId, filePath];
      await execFileAsync(cmd, args, { timeout: 30000 });
      return true;
    } catch {
      return false;
    }
  }
}

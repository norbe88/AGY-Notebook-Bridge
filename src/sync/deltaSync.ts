/**
 * Delta Sync Engine
 * Computes sha256 checksums of local sources, compares with local/remote cache,
 * and batch-uploads only new or modified files with granular progress reporting.
 */

import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { NotebookClient } from '../api/notebookClient';

export interface SyncResult {
  uploaded: string[];
  skipped: string[];
  failed: string[];
}

export interface ProgressCallback {
  (current: number, total: number, filename: string): void;
}

interface LocalHashStore {
  [notebookId: string]: {
    [filename: string]: string;
  };
}

export class DeltaSyncEngine {
  constructor(private readonly client: NotebookClient) {}

  public static computeFileHash(filePath: string): string {
    return crypto
      .createHash('sha256')
      .update(fs.readFileSync(filePath))
      .digest('hex');
  }

  private getHashCacheFilePath(sourcesDir: string): string {
    const parentDir = path.dirname(sourcesDir);
    const vscodeDir = path.join(parentDir, '.vscode');
    if (fs.existsSync(vscodeDir)) {
      return path.join(vscodeDir, 'notebook_hashes.json');
    }
    return path.join(sourcesDir, '.hashes.json');
  }

  private loadLocalHashes(cachePath: string): LocalHashStore {
    try {
      if (fs.existsSync(cachePath)) {
        const raw = fs.readFileSync(cachePath, 'utf8');
        return JSON.parse(raw);
      }
    } catch {}
    return {};
  }

  private saveLocalHashes(cachePath: string, store: LocalHashStore): void {
    try {
      const dir = path.dirname(cachePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(cachePath, JSON.stringify(store, null, 2), 'utf8');
    } catch {}
  }

  /**
   * Syncs all matching sources in sourcesDir to the target notebook
   */
  public async syncSourcesToNotebook(
    sourcesDir: string,
    notebookId: string,
    onProgress?: ProgressCallback
  ): Promise<SyncResult> {
    const result: SyncResult = {
      uploaded: [],
      skipped: [],
      failed: []
    };

    if (!fs.existsSync(sourcesDir)) {
      return result;
    }

    const localFiles = fs
      .readdirSync(sourcesDir)
      .filter((f) => !f.startsWith('.'))
      .filter((f) => ['.md', '.pdf', '.txt'].includes(path.extname(f).toLowerCase()));

    if (localFiles.length === 0) {
      return result;
    }

    const cachePath = this.getHashCacheFilePath(sourcesDir);
    const hashStore = this.loadLocalHashes(cachePath);
    if (!hashStore[notebookId]) {
      hashStore[notebookId] = {};
    }
    const notebookCache = hashStore[notebookId];

    // Fetch remote hashes if provided by API/CLI
    const remoteHashes = await this.client.getSourceHashes(notebookId);

    const total = localFiles.length;
    let current = 0;

    for (const file of localFiles) {
      current++;
      const fullPath = path.join(sourcesDir, file);

      try {
        const hash = DeltaSyncEngine.computeFileHash(fullPath);
        const cachedHash = notebookCache[file];
        const remoteHash = remoteHashes.get(file);

        // If file hash matches either the remote hash or our local synced cache, skip!
        if ((remoteHash && remoteHash === hash) || (cachedHash && cachedHash === hash)) {
          result.skipped.push(file);
          continue;
        }

        // Notify progress before uploading
        onProgress?.(current, total, file);

        const success = await this.client.uploadSource(notebookId, fullPath);
        if (success) {
          result.uploaded.push(file);
          notebookCache[file] = hash;
        } else {
          result.failed.push(file);
        }
      } catch {
        result.failed.push(file);
      }
    }

    // Persist updated hash store
    this.saveLocalHashes(cachePath, hashStore);

    return result;
  }

  /**
   * Syncs a single external or workspace file to the notebook
   */
  public async syncSingleFile(
    filePath: string,
    notebookId: string,
    sourcesDir?: string
  ): Promise<{ ok: boolean; skipped?: boolean; error?: string }> {
    try {
      if (!fs.existsSync(filePath)) {
        return { ok: false, error: 'File does not exist' };
      }

      const filename = path.basename(filePath);
      const ext = path.extname(filename).toLowerCase();
      if (!['.md', '.pdf', '.txt'].includes(ext)) {
        return { ok: false, error: `Unsupported file extension (${ext}). Supported: .md, .pdf, .txt` };
      }

      let targetPath = filePath;

      // If sourcesDir is provided and the file is outside it, copy it into sourcesDir
      if (sourcesDir) {
        if (!fs.existsSync(sourcesDir)) {
          fs.mkdirSync(sourcesDir, { recursive: true });
        }
        const destination = path.join(sourcesDir, filename);
        if (path.resolve(filePath) !== path.resolve(destination)) {
          fs.copyFileSync(filePath, destination);
          targetPath = destination;
        }
      }

      const hash = DeltaSyncEngine.computeFileHash(targetPath);
      const cachePath = sourcesDir ? this.getHashCacheFilePath(sourcesDir) : '';
      let hashStore: LocalHashStore = {};
      if (cachePath) {
        hashStore = this.loadLocalHashes(cachePath);
        if (!hashStore[notebookId]) hashStore[notebookId] = {};
        if (hashStore[notebookId][filename] === hash) {
          return { ok: true, skipped: true };
        }
      }

      const success = await this.client.uploadSource(notebookId, targetPath);
      if (success) {
        if (cachePath && hashStore[notebookId]) {
          hashStore[notebookId][filename] = hash;
          this.saveLocalHashes(cachePath, hashStore);
        }
        return { ok: true };
      }

      return { ok: false, error: 'Failed to upload source into NotebookLM' };
    } catch (err: any) {
      return { ok: false, error: err.message };
    }
  }
}

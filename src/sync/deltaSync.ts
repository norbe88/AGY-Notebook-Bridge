/**
 * Delta Sync Engine
 * Computes sha256 checksums of local sources and uploads only new/modified files.
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

export class DeltaSyncEngine {
  constructor(private readonly client: NotebookClient) {}

  public static computeFileHash(filePath: string): string {
    return crypto
      .createHash('sha256')
      .update(fs.readFileSync(filePath))
      .digest('hex');
  }

  public async syncSourcesToNotebook(
    sourcesDir: string,
    notebookId: string
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
      .filter((f) => ['.md', '.pdf', '.txt'].includes(path.extname(f).toLowerCase()));

    if (localFiles.length === 0) {
      return result;
    }

    const remoteHashes = await this.client.getSourceHashes(notebookId);

    for (const file of localFiles) {
      const fullPath = path.join(sourcesDir, file);
      try {
        const hash = DeltaSyncEngine.computeFileHash(fullPath);
        const remoteHash = remoteHashes.get(file);

        if (remoteHash && remoteHash === hash) {
          result.skipped.push(file);
          continue;
        }

        const success = await this.client.uploadSource(notebookId, fullPath);
        if (success) {
          result.uploaded.push(file);
        } else {
          result.failed.push(file);
        }
      } catch {
        result.failed.push(file);
      }
    }

    return result;
  }
}

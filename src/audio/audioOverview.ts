/**
 * Audio Overview Service
 * Triggers podcast overview generation & handles local storage of audio files.
 */

import { execFile } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import * as fs from 'fs';
import { getNotebookLMCli } from '../auth/preflight';

const execFileAsync = promisify(execFile);

export interface AudioOverviewResult {
  ok: boolean;
  filePath?: string;
  error?: string;
}

export class AudioOverviewService {
  /**
   * Generates a conversational 2-host Audio Overview podcast and downloads the artifact
   */
  public async generateAudioOverview(
    notebookId: string,
    outputDir: string
  ): Promise<AudioOverviewResult> {
    const { cmd, baseArgs } = getNotebookLMCli();
    try {
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      // Step 1: Trigger audio generation with deep-dive format and wait
      const genArgs = [
        ...baseArgs,
        'generate',
        'audio',
        '-n',
        notebookId,
        '--format',
        'deep-dive',
        '--wait'
      ];
      await execFileAsync(cmd, genArgs, { timeout: 300000 });

      // Step 2: Download artifact to output directory
      const timestamp = new Date().toISOString().slice(0, 10);
      const targetPath = path.join(outputDir, `audio_overview_${timestamp}.m4a`);

      const dlArgs = [
        ...baseArgs,
        'download',
        'audio',
        '-n',
        notebookId,
        targetPath,
        '--force'
      ];
      await execFileAsync(cmd, dlArgs, { timeout: 60000 });

      return {
        ok: true,
        filePath: targetPath
      };
    } catch (err: any) {
      return {
        ok: false,
        error: err.message || 'Audio Overview generation failed'
      };
    }
  }
}

/**
 * Audio Overview Service
 * Triggers podcast generation & handles local storage of audio overviews.
 */

import { execFile } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import * as fs from 'fs';

const execFileAsync = promisify(execFile);

export interface AudioOverviewResult {
  ok: boolean;
  filePath?: string;
  error?: string;
}

export class AudioOverviewService {
  private readonly isWin = process.platform === 'win32';
  private readonly cliCommand = this.isWin ? 'notebooklm.cmd' : 'notebooklm';

  /**
   * Triggers audio overview generation or downloads existing audio
   */
  public async generateAudioOverview(
    notebookId: string,
    outputDir: string
  ): Promise<AudioOverviewResult> {
    try {
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const targetPath = path.join(outputDir, `audio_overview_${timestamp}.mp3`);

      await execFileAsync(
        this.cliCommand,
        ['audio', 'generate', notebookId, '--out', targetPath],
        { timeout: 120000, shell: this.isWin }
      );

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

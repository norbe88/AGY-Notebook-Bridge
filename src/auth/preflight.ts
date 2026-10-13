/**
 * Preflight Authentication Gate & Status Validator
 * Inspects `notebooklm status --json` or environment credentials.
 */

import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

export interface AuthStatus {
  ok: boolean;
  email?: string;
  expiresAt?: number;
  error?: string;
}

/**
 * Checks authentication status with NotebookLM CLI
 */
export async function checkNotebookLMAuth(): Promise<AuthStatus> {
  try {
    // Windows supports notebooklm or notebooklm.cmd
    const isWin = process.platform === 'win32';
    const command = isWin ? 'notebooklm.cmd' : 'notebooklm';

    const { stdout } = await execFileAsync(command, ['status', '--json'], {
      timeout: 6000,
      shell: isWin
    });

    const parsed = JSON.parse(stdout.trim());
    return {
      ok: Boolean(parsed.authenticated),
      email: parsed.email,
      expiresAt: parsed.expires_at,
      error: parsed.error
    };
  } catch (err: any) {
    if (err.code === 'ENOENT') {
      return {
        ok: false,
        error: 'notebooklm CLI not found in PATH. Install with: pip install notebooklm'
      };
    }

    // Try fallback check or return clean error message
    return {
      ok: false,
      error: err.message || 'Failed to query NotebookLM auth status'
    };
  }
}

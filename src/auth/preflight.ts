/**
 * Preflight Authentication Gate & Status Validator
 * Fast-path storage inspection + live RPC verification.
 */

import { execFile } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const execFileAsync = promisify(execFile);

export interface AuthStatus {
  ok: boolean;
  email?: string;
  expiresAt?: number;
  error?: string;
  storagePath?: string;
}

export function getNotebookLMCli(): { cmd: string; baseArgs: string[] } {
  if (process.platform === 'win32' && fs.existsSync('C:\\Python314\\python.exe')) {
    return { cmd: 'C:\\Python314\\python.exe', baseArgs: ['-m', 'notebooklm'] };
  }
  return { cmd: 'notebooklm', baseArgs: [] };
}

export function resolveStoragePath(): string | null {
  const envHome = process.env.NOTEBOOKLM_HOME;
  if (envHome) {
    const candidate = path.join(envHome, 'profiles', 'default', 'storage_state.json');
    if (fs.existsSync(candidate)) return candidate;
  }

  const holdingCandidate = 'I:\\My Drive\\CARVANA_SRL\\00_HOLDING_CORE\\00_SECRETS_VAULT\\NotebookLM_Auth\\profiles\\default\\storage_state.json';
  if (fs.existsSync(holdingCandidate)) return holdingCandidate;

  const localCandidate = path.join(os.homedir(), '.notebooklm', 'profiles', 'default', 'storage_state.json');
  if (fs.existsSync(localCandidate)) return localCandidate;

  return null;
}

export async function checkNotebookLMAuth(): Promise<AuthStatus> {
  const storagePath = resolveStoragePath();
  let email: string | undefined;
  let expiresAt: number | undefined;

  // 1. Fast-path: inspect storage state JSON (< 5ms)
  if (storagePath) {
    try {
      const content = fs.readFileSync(storagePath, 'utf8');
      const data = JSON.parse(content);
      email = data.notebooklm?.account?.email;

      const sidts = (data.cookies || []).find((c: any) => c.name === '__Secure-1PSIDTS');
      if (sidts?.expires) {
        expiresAt = sidts.expires;
      }
    } catch {}
  }

  // 2. Live verification against NotebookLM CLI RPC
  const { cmd, baseArgs } = getNotebookLMCli();
  try {
    const args = [...baseArgs, 'list', '--json', '--limit', '1'];
    const { stdout } = await execFileAsync(cmd, args, { timeout: 4000 });

    const trimmed = stdout.trim();
    if (trimmed.startsWith('{')) {
      const parsed = JSON.parse(trimmed);
      if (parsed.error || parsed.code === 'NOTEBOOKLM_ERROR') {
        return {
          ok: false,
          email,
          expiresAt,
          storagePath: storagePath || undefined,
          error: parsed.message || 'Token expired. Run notebooklm login'
        };
      }
    }

    return {
      ok: true,
      email: email || 'Connected',
      expiresAt,
      storagePath: storagePath || undefined
    };
  } catch (err: any) {
    if (err.code === 'ENOENT') {
      return {
        ok: false,
        error: 'notebooklm CLI not found in PATH. Install with: pip install notebooklm-py'
      };
    }

    // Process exited with non-zero (e.g. 1 on unauthenticated)
    const stdout = err.stdout?.toString?.() || '';
    if (stdout.includes('unauthenticated') || stdout.includes('NOTEBOOKLM_ERROR')) {
      return {
        ok: false,
        email,
        expiresAt,
        storagePath: storagePath || undefined,
        error: 'Token expired. Click Re-authenticate to renew session.'
      };
    }

    return {
      ok: false,
      email,
      expiresAt,
      storagePath: storagePath || undefined,
      error: err.message || 'NotebookLM auth check failed'
    };
  }
}

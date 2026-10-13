/**
 * Research Query Runner
 * Handles execution of Fast & Deep research queries with real-time chunk streaming
 * and workspace markdown persistence with mandatory date/time stamps.
 */

import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { getNotebookLMCli } from '../auth/preflight';

export interface QueryOptions {
  notebookId: string;
  query: string;
  mode: 'fast' | 'deep';
  onChunk?: (chunk: string) => void;
}

export interface QueryResult {
  content: string;
  savedPath?: string;
}

export class QueryRunner {
  /**
   * Executes a research query and streams chunks back in real-time
   */
  public async executeQuery(options: QueryOptions): Promise<QueryResult> {
    const { notebookId, query, onChunk } = options;
    const { cmd, baseArgs } = getNotebookLMCli();

    return new Promise((resolve, reject) => {
      const args = [...baseArgs, 'ask', '-n', notebookId, query];

      const child = spawn(cmd, args, {
        shell: false
      });

      let accumulated = '';

      child.stdout.on('data', (data: Buffer) => {
        const text = data.toString('utf8');
        accumulated += text;
        onChunk?.(text);
      });

      child.stderr.on('data', (_data: Buffer) => {
        // Stderr logging / telemetry
      });

      child.on('error', (err) => {
        reject(err);
      });

      child.on('close', (code) => {
        if (code === 0 || accumulated.trim().length > 0) {
          resolve({ content: accumulated });
        } else {
          reject(new Error(`NotebookLM Query failed (exit code ${code})`));
        }
      });
    });
  }

  /**
   * Persists research result as a markdown file inside the workspace docs/research/
   */
  public saveResult(
    workspaceRoot: string,
    outputSubdir: string,
    query: string,
    content: string
  ): string {
    const targetDir = path.resolve(workspaceRoot, outputSubdir);
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10);
    const timeStr = now.toTimeString().slice(0, 8).replace(/:/g, '');
    const sanitizedTitle = query
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .slice(0, 40)
      .replace(/^-|-$/g, '');

    const filename = `${dateStr}_${timeStr}_${sanitizedTitle || 'research'}.md`;
    const fullPath = path.join(targetDir, filename);

    const fileContent = `# NotebookLM Research: ${query}
> **Data & Ora:** ${now.toISOString()}  
> **Mod:** Grounded Research (${now.toLocaleTimeString()})  

---

${content}
`;

    fs.writeFileSync(fullPath, fileContent, 'utf8');
    return fullPath;
  }
}

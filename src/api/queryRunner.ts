/**
 * Research Query Runner
 * Handles execution of Fast & Deep research queries with streaming and workspace persistence.
 */

import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

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
  private readonly isWin = process.platform === 'win32';
  private readonly cliCommand = this.isWin ? 'notebooklm.cmd' : 'notebooklm';

  /**
   * Executes a research query and streams chunks back
   */
  public async executeQuery(options: QueryOptions): Promise<QueryResult> {
    const { notebookId, query, mode, onChunk } = options;

    return new Promise((resolve, reject) => {
      const args = ['query', notebookId, query, '--mode', mode];

      const child = spawn(this.cliCommand, args, {
        shell: this.isWin
      });

      let accumulated = '';

      child.stdout.on('data', (data: Buffer) => {
        const text = data.toString('utf8');
        accumulated += text;
        onChunk?.(text);
      });

      child.stderr.on('data', (_data: Buffer) => {
        // Log or handle stderr streaming if necessary
      });

      child.on('error', (err) => {
        reject(err);
      });

      child.on('close', (code) => {
        if (code === 0) {
          resolve({ content: accumulated });
        } else {
          // If CLI query exited with non-zero, still return whatever accumulated or an error
          if (accumulated.trim().length > 0) {
            resolve({ content: accumulated });
          } else {
            reject(new Error(`Query process exited with code ${code}`));
          }
        }
      });
    });
  }

  /**
   * Persists research result as a markdown file inside the workspace
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

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const sanitizedTitle = query
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .slice(0, 40)
      .replace(/^-|-$/g, '');

    const filename = `${timestamp}_${sanitizedTitle || 'research'}.md`;
    const fullPath = path.join(targetDir, filename);

    const fileContent = `# NotebookLM Research: ${query}
> **Data & Ora:** ${new Date().toISOString()}  
> **Mod:** Fast/Deep Research  

---

${content}
`;

    fs.writeFileSync(fullPath, fileContent, 'utf8');
    return fullPath;
  }
}

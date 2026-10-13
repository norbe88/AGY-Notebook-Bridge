/**
 * esbuild script for Extension Host bundle
 * Compiles src/extension.ts -> out/extension.js (CommonJS, Node platform)
 */
import { build, context } from 'esbuild';
import { existsSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const isProduction = process.argv.includes('--production');
const isWatch = process.argv.includes('--watch');

const outDir = resolve(__dirname, 'out');
if (!existsSync(outDir)) {
  mkdirSync(outDir, { recursive: true });
}

/** @type {import('esbuild').BuildOptions} */
const buildOptions = {
  entryPoints: [resolve(__dirname, 'src/extension.ts')],
  bundle: true,
  outfile: resolve(outDir, 'extension.js'),
  format: 'cjs',
  platform: 'node',
  target: 'node20',
  external: ['vscode'],
  minify: isProduction,
  sourcemap: !isProduction,
  tsconfig: resolve(__dirname, 'tsconfig.extension.json')
};

if (isWatch) {
  const ctx = await context(buildOptions);
  await ctx.watch();
  console.log('[extension] watching for changes...');
} else {
  await build(buildOptions);
  console.log('[extension] bundle -> out/extension.js' + (isProduction ? ' (minified)' : ''));
}

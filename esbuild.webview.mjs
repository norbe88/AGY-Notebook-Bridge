/**
 * esbuild script for Webview bundle
 * Compiles webview-ui/panel.tsx -> out/webview/panel.js (IIFE, browser platform)
 * Copies CSS and static assets to out/webview/
 */
import { build, context } from 'esbuild';
import { copyFileSync, existsSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const isProduction = process.argv.includes('--production');
const isWatch = process.argv.includes('--watch');

const outDir = resolve(__dirname, 'out/webview');
if (!existsSync(outDir)) {
  mkdirSync(outDir, { recursive: true });
}

function copyStaticAssets() {
  const cssSrc = resolve(__dirname, 'webview-ui/global.css');
  if (existsSync(cssSrc)) {
    copyFileSync(cssSrc, resolve(outDir, 'global.css'));
    console.log('[webview] global.css -> out/webview/global.css');
  }
}

copyStaticAssets();

/** @type {import('esbuild').BuildOptions} */
const buildOptions = {
  entryPoints: [resolve(__dirname, 'webview-ui/panel.tsx')],
  bundle: true,
  outfile: resolve(outDir, 'panel.js'),
  format: 'iife',
  platform: 'browser',
  target: 'es2022',
  minify: isProduction,
  sourcemap: !isProduction,
  tsconfig: resolve(__dirname, 'tsconfig.webview.json')
};

if (isWatch) {
  const ctx = await context(buildOptions);
  await ctx.watch();
  console.log('[webview] watching for changes...');
} else {
  await build(buildOptions);
  console.log('[webview] bundle -> out/webview/panel.js' + (isProduction ? ' (minified)' : ''));
}

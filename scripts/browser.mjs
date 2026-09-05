import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

export function browserTools() {
  const require = createRequire(import.meta.url);
  try { return require('playwright'); } catch { /* Use the installed browser QA CLI. */ }
  const root = process.platform === 'win32'
    ? execFileSync('cmd.exe', ['/c', 'npm root -g'], { encoding: 'utf8', windowsHide: true }).trim()
    : execFileSync('npm', ['root', '-g'], { encoding: 'utf8' }).trim();
  return require(join(root, '@playwright', 'cli', 'node_modules', 'playwright'));
}

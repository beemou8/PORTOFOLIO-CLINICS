import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const webDir = path.join(rootDir, 'web');

const tsxCli = path.join(rootDir, 'node_modules', 'tsx', 'dist', 'cli.mjs');
const viteCli = path.join(webDir, 'node_modules', 'vite', 'bin', 'vite.js');

function run(label, args, cwd) {
  const child = spawn(process.execPath, args, {
    stdio: 'inherit',
    cwd,
    env: process.env,
  });

  child.on('error', (error) => {
    console.error(`\n[${label}] gagal dijalankan: ${error.message}`);
  });

  return child;
}

console.log('BIM CLINICS starting...');
console.log('API      : http://localhost:3000');
console.log('Web      : http://localhost:5173');
console.log('Buka Web : http://localhost:5173');
console.log('Tekan Ctrl+C untuk menghentikan keduanya.\n');

const api = run('API', [tsxCli, 'watch', path.join(rootDir, 'src', 'app.ts')], rootDir);
const web = run('WEB', [viteCli, '--host', '0.0.0.0'], webDir);

let closing = false;
function shutdown(code = 0) {
  if (closing) return;
  closing = true;

  for (const child of [api, web]) {
    if (child && !child.killed) {
      try {
        child.kill('SIGTERM');
      } catch {
        // Process may already have stopped.
      }
    }
  }

  setTimeout(() => process.exit(code), 250);
}

api.on('exit', (code) => {
  if (!closing && code && code !== 0) {
    console.error(`\n[API] berhenti dengan kode ${code}.`);
    shutdown(code);
  }
});

web.on('exit', (code) => {
  if (!closing && code && code !== 0) {
    console.error(`\n[WEB] berhenti dengan kode ${code}.`);
    shutdown(code);
  }
});

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

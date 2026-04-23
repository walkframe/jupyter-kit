import { spawn } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { watch } from 'chokidar';

const __dirname = dirname(fileURLToPath(import.meta.url));
const lessDir = resolve(__dirname, 'less');
const syntaxSrcDir = resolve(__dirname, 'src-syntax');

let running = false;
let pending = false;

function build() {
  if (running) {
    pending = true;
    return;
  }
  running = true;
  const t0 = Date.now();
  const proc = spawn('node', ['build.mjs'], {
    cwd: __dirname,
    stdio: 'inherit',
    env: { ...process.env, THEME_BUILD_SKIP_PUBLISH: '1' },
  });
  proc.on('exit', (code) => {
    running = false;
    console.log(`[theme:watch] build finished (${Date.now() - t0}ms, exit=${code})`);
    if (pending) {
      pending = false;
      build();
    }
  });
}

build();

const watcher = watch([lessDir, syntaxSrcDir], { ignoreInitial: true });
watcher.on('all', (event, path) => {
  console.log(`[theme:watch] ${event} ${path}`);
  build();
});

console.log('[theme:watch] watching less/ and src-syntax/ ...');

#!/usr/bin/env node
// Bump every workspace package.json (root + packages/*/) to the target
// version. Skips packages that are explicitly internal (`version: "0.0.0"`),
// since those are not published. Then rebuilds @jupyter-kit/theme so the
// generated dist-publish/theme-*/ packages pick up the new version too.
//
// Usage:  node scripts/bump-version.mjs 3.0.0-rc.9
// Or:     pnpm bump 3.0.0-rc.9
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const target = process.argv[2];
if (!target || !/^\d+\.\d+\.\d+(-[\w.]+)?$/.test(target)) {
  console.error('usage: bump-version.mjs <semver>');
  console.error('example: bump-version.mjs 3.0.0-rc.9');
  process.exit(1);
}

const files = [
  resolve(REPO_ROOT, 'package.json'),
  ...readdirSync(resolve(REPO_ROOT, 'packages'))
    .map((d) => resolve(REPO_ROOT, 'packages', d, 'package.json'))
    .filter(existsSync),
];

let bumped = 0;
let skipped = 0;
for (const f of files) {
  const json = JSON.parse(readFileSync(f, 'utf8'));
  // Workspace-internal packages stay at 0.0.0 (docs/e2e/fixtures/storybook).
  if (json.version === '0.0.0' && f !== resolve(REPO_ROOT, 'package.json')) {
    console.log(`skip   ${json.name} (private 0.0.0)`);
    skipped++;
    continue;
  }
  if (json.version === target) {
    console.log(`keep   ${json.name} (already ${target})`);
    continue;
  }
  const old = json.version;
  json.version = target;
  writeFileSync(f, JSON.stringify(json, null, 2) + '\n');
  console.log(`bump   ${json.name} ${old} → ${target}`);
  bumped++;
}

console.log(`\n${bumped} bumped, ${skipped} skipped`);

// Rebuild @jupyter-kit/theme so dist-publish/theme-*/package.json files
// (read by build.mjs from the source theme package.json at build time)
// reflect the new version.
console.log('\n→ rebuilding @jupyter-kit/theme to propagate to dist-publish/theme-*');
const r = spawnSync(
  'pnpm',
  ['--filter', '@jupyter-kit/theme', 'run', 'build'],
  { cwd: REPO_ROOT, stdio: 'inherit' },
);
if (r.status !== 0) {
  console.error('theme build failed');
  process.exit(r.status ?? 1);
}

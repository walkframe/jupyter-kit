import {
  cp,
  mkdir,
  readFile,
  readdir,
  rm,
  writeFile,
} from 'node:fs/promises';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import less from 'less';
import { transform as esbuildTransform } from 'esbuild';

async function minifyCss(source) {
  const { code } = await esbuildTransform(source, { loader: 'css', minify: true });
  return code;
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const lessDir = resolve(__dirname, 'less');
const syntaxSrcDir = resolve(__dirname, 'src-syntax');
const themesDir = resolve(__dirname, 'themes');
const chromeDir = join(themesDir, 'chrome');
const syntaxDir = join(themesDir, 'syntax');
const publishDir = resolve(__dirname, 'dist-publish');

const VERSION = '3.0.0-rc.0';
const SKIP = new Set(['base.less', 'variables.less', '_widget-patch.less']);

// Don't wipe `themesDir` — in watch mode, Vite may try to read a CSS file
// during the wipe-then-regenerate window and fail with "Failed to load url".
// Files are overwritten in-place below; stale files from deleted sources will
// only linger in a dev session (a clean `pnpm run clean` resets fully).
await mkdir(chromeDir, { recursive: true });
await mkdir(syntaxDir, { recursive: true });

// 1. Compile each chrome .less → themes/chrome/<name>.css.
const chromeNames = [];
for (const file of await readdir(lessDir)) {
  if (extname(file) !== '.less' || SKIP.has(file)) continue;
  const inputPath = join(lessDir, file);
  const source = await readFile(inputPath, 'utf8');
  const result = await less.render(source, {
    filename: inputPath,
    paths: [lessDir],
    javascriptEnabled: true,
  });
  const name = file.replace(/\.less$/, '');
  const minified = await minifyCss(result.css);
  await writeFile(join(chromeDir, `${name}.css`), minified, 'utf8');
  chromeNames.push(name);
  console.log(`chrome/${name}.css`);
}

// 2. Copy hand-authored syntax CSS into themes/syntax/.
const syntaxFiles = (await readdir(syntaxSrcDir)).filter((f) =>
  f.endsWith('.css'),
);
for (const f of syntaxFiles) {
  const src = await readFile(join(syntaxSrcDir, f), 'utf8');
  const minified = await minifyCss(src);
  await writeFile(join(syntaxDir, f), minified, 'utf8');
  console.log(`syntax/${f}`);
}
const syntaxNames = syntaxFiles.map((f) => f.replace(/\.css$/, ''));

// 3. Generate per-package publish dirs:
//    - dist-publish/theme-<chrome>/{style.css, syntax/<all>.css, package.json}
//    - dist-publish/theme-all/{chrome/*, syntax/*, package.json}
// Skipped in watch mode (dev) — only needed for publishing, pure overhead
// for the live dev loop.
if (process.env.THEME_BUILD_SKIP_PUBLISH === '1') {
  console.log(`done — ${chromeNames.length} chrome + ${syntaxNames.length} syntax themes (publish skipped)`);
  process.exit(0);
}
await rm(publishDir, { recursive: true, force: true });
await mkdir(publishDir, { recursive: true });

for (const chrome of chromeNames) {
  const dir = join(publishDir, `theme-${chrome}`);
  await mkdir(join(dir, 'syntax'), { recursive: true });
  // Publish the chrome stylesheet under its own name (e.g.
  // `theme-monokai/monokai.css`) rather than `style.css`. Matches
  // `theme-all/chrome/<name>.css` so authors can reason about a single
  // naming convention across both distributions.
  await cp(join(chromeDir, `${chrome}.css`), join(dir, `${chrome}.css`));
  for (const s of syntaxFiles) {
    await cp(join(syntaxDir, s), join(dir, 'syntax', s));
  }
  const pkg = {
    name: `@jupyter-kit/theme-${chrome}`,
    version: VERSION,
    description: `${chrome} chrome + syntax themes for @jupyter-kit.`,
    type: 'module',
    exports: {
      [`./${chrome}.css`]: `./${chrome}.css`,
      ...Object.fromEntries(
        syntaxFiles.map((s) => [`./syntax/${s}`, `./syntax/${s}`]),
      ),
      './package.json': './package.json',
    },
    files: [`${chrome}.css`, 'syntax'],
    author: 'righ',
    license: 'Apache-2.0',
    repository: {
      type: 'git',
      url: 'git+https://github.com/walkframe/jupyter-kit.git',
      directory: 'packages/theme',
    },
  };
  await writeFile(join(dir, 'package.json'), JSON.stringify(pkg, null, 2));
  console.log(`pkg theme-${chrome}`);
}

// theme-all: every chrome + every syntax under chrome/* and syntax/*.
{
  const dir = join(publishDir, 'theme-all');
  await mkdir(join(dir, 'chrome'), { recursive: true });
  await mkdir(join(dir, 'syntax'), { recursive: true });
  for (const c of chromeNames) {
    await cp(join(chromeDir, `${c}.css`), join(dir, 'chrome', `${c}.css`));
  }
  for (const s of syntaxFiles) {
    await cp(join(syntaxDir, s), join(dir, 'syntax', s));
  }
  const exports = { './package.json': './package.json' };
  for (const c of chromeNames) exports[`./chrome/${c}.css`] = `./chrome/${c}.css`;
  for (const s of syntaxFiles) exports[`./syntax/${s}`] = `./syntax/${s}`;
  const pkg = {
    name: '@jupyter-kit/theme-all',
    version: VERSION,
    description:
      'All chrome + syntax themes for @jupyter-kit in one package. Use subpaths to import the variant you want.',
    type: 'module',
    exports,
    files: ['chrome', 'syntax'],
    author: 'righ',
    license: 'Apache-2.0',
    repository: {
      type: 'git',
      url: 'git+https://github.com/walkframe/jupyter-kit.git',
      directory: 'packages/theme',
    },
  };
  await writeFile(join(dir, 'package.json'), JSON.stringify(pkg, null, 2));
  console.log(`pkg theme-all (${chromeNames.length} chromes, ${syntaxNames.length} syntaxes)`);
}

console.log(`done — ${chromeNames.length + 1} publishable packages under dist-publish/`);

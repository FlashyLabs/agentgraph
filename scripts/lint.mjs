#!/usr/bin/env node
// Zero-install lint: every .mjs parses, every .json parses, nothing imports
// outside node: builtins, no credential shape sits in any file, and the README
// ends on the licence line the estate register requires. A lint that needs an
// install is a lint that can quietly not run — this repository is
// dependency-free on purpose, so its lint is too.
import { spawnSync } from 'node:child_process';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const files = [];
const walk = (d) => {
  for (const e of readdirSync(d)) {
    if (['node_modules', '.git'].includes(e)) continue;
    const full = join(d, e);
    if (statSync(full).isDirectory()) walk(full);
    else files.push(full);
  }
};
walk(ROOT);

let failed = 0;
const problem = (msg) => { failed++; console.error(msg); };

const mjs = files.filter((f) => f.endsWith('.mjs'));
for (const f of mjs) {
  const r = spawnSync(process.execPath, ['--check', f], { encoding: 'utf8' });
  if (r.status !== 0) problem(`syntax: ${relative(ROOT, f)}\n${r.stderr}`);
  const src = readFileSync(f, 'utf8');
  for (const m of src.matchAll(/^\s*import\s[^;]*?from\s+['"]([^'"]+)['"]/gm)) {
    if (!/^(node:|\.\.?\/)/.test(m[1])) problem(`dependency: ${relative(ROOT, f)} imports "${m[1]}" — node: builtins and relative files only`);
  }
}

for (const f of files.filter((x) => x.endsWith('.json'))) {
  try { JSON.parse(readFileSync(f, 'utf8')); } catch (e) { problem(`json: ${relative(ROOT, f)}: ${e.message}`); }
}

const SECRET = /(?:secret|token|apikey|api_key|password)\s*[:=]\s*['"][A-Za-z0-9_\-]{16,}['"]/i;
for (const f of files) {
  const m = readFileSync(f, 'utf8').match(SECRET);
  if (m) problem(`credential shape: ${relative(ROOT, f)}: "${m[0]}" — Secret Manager only`);
}

const LICENCE = 'Licence: to be declared at launch. The estate licence register in flashyos governs; this repository is not yet open-sourced.';
const readme = readFileSync(join(ROOT, 'README.md'), 'utf8').trimEnd().split('\n');
if (readme.at(-1) !== LICENCE) problem('README.md: the final line must be the estate licence line, verbatim');
if (files.some((f) => relative(ROOT, f) === 'LICENSE')) problem('LICENSE: the licence is declared once, in the estate register in flashyos, never here');

if (failed) {
  console.error(`lint: ${failed} problem(s)`);
  process.exit(1);
}
console.log(`lint: ${mjs.length} modules parse, ${files.length} files clean, house rules hold`);

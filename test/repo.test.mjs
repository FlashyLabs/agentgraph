// The scaffold's own promises, held by a test: dependency-free, node: builtins
// only, the licence line exactly as the estate register requires, the CI that
// installs nothing, and a SPEC that names every closed-list member the module
// enforces. A README claim the code does not keep is the failure these catch.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { NODE_KINDS, EDGE_KINDS, REFUSED_KEYS, WELL_KNOWN } from '../vendor-graph.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(ROOT, p), 'utf8');

const mjsFiles = [];
const walk = (d) => {
  for (const e of readdirSync(d)) {
    if (['node_modules', '.git'].includes(e)) continue;
    const full = join(d, e);
    if (statSync(full).isDirectory()) walk(full);
    else if (e.endsWith('.mjs')) mjsFiles.push(full);
  }
};
walk(ROOT);

describe('dependency-free', () => {
  test('package.json declares no dependencies of any kind, ESM, Node 22, private', () => {
    const pkg = JSON.parse(read('package.json'));
    assert.equal(pkg.name, '@flashylabs/agentgraph');
    assert.equal(pkg.private, true);
    assert.equal(pkg.type, 'module');
    assert.equal(pkg.engines.node, '>=22');
    for (const k of ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies']) {
      assert.equal(pkg[k], undefined, `${k} must not exist`);
    }
    assert.ok(pkg.scripts.test && pkg.scripts.lint);
    assert.equal(pkg.license, undefined, 'the licence is declared in the estate register, not here');
  });
  test('every .mjs imports only node: builtins or relative files', () => {
    for (const f of mjsFiles) {
      const specs = [...read(relative(ROOT, f)).matchAll(/^\s*import\s[^;]*?from\s+['"]([^'"]+)['"]/gm)].map((m) => m[1]);
      for (const s of specs) assert.ok(s.startsWith('node:') || s.startsWith('./') || s.startsWith('../'), `${relative(ROOT, f)} imports ${s}`);
    }
  });
  test('the LICENSE is Apache-2.0 (holder Flashy Labs); the README ends on the estate licence line', () => {
    assert.equal(existsSync(join(ROOT, 'LICENSE')), true, 'the estate register names this repository Apache-2.0 — the LICENSE file must be present');
    const licence = read('LICENSE');
    assert.ok(licence.includes('Apache License'), 'the LICENSE must carry the Apache License text');
    assert.ok(licence.includes('Copyright 2026 Flashy Labs'), 'the LICENSE must name the copyright holder');
    const lines = read('README.md').trimEnd().split('\n');
    assert.equal(lines.at(-1), 'Licensed under Apache-2.0 (holder Flashy Labs); the estate register in flashyos `tools/estate-licences.mjs` is the authority.');
  });
  test('CI installs nothing and runs lint and test on Node 22 and 24', () => {
    const ci = read('.github/workflows/ci.yml');
    assert.doesNotMatch(ci, /npm (ci|install)\b/);
    assert.match(ci, /actions\/checkout@v4/);
    assert.match(ci, /actions\/setup-node@v4/);
    assert.match(ci, /node:\s*\[[^\]]*'22'/);
    assert.match(ci, /npm run lint/);
    assert.match(ci, /npm test/);
    assert.match(ci, /pull_request/);
  });
});

describe('the documents keep the code\'s promises', () => {
  const spec = read('SPEC.md');
  const readme = read('README.md');
  const claude = read('CLAUDE.md');
  test('SPEC and README are honest about maturity', () => {
    assert.match(spec, /^Status: draft/m);
    assert.match(readme, /Status: draft/);
  });
  test('SPEC names every closed-list member and every refused key the module enforces', () => {
    for (const k of NODE_KINDS) assert.ok(spec.includes(`\`${k}\``), `node kind ${k}`);
    for (const k of EDGE_KINDS) assert.ok(spec.includes(`\`${k}\``), `edge kind ${k}`);
    for (const k of REFUSED_KEYS) assert.ok(spec.includes(`\`${k}\``), `refused key ${k}`);
    assert.ok(spec.includes(WELL_KNOWN));
    assert.ok(spec.includes('realm/1'));
  });
  test('the README quick start names commands the CLI has, against files that exist', () => {
    for (const m of readme.matchAll(/node vendor-graph\.mjs (check|query|from-realm) ([\w./-]+)/g)) {
      assert.ok(existsSync(join(ROOT, m[2])), `${m[0]}: ${m[2]} does not exist`);
    }
    assert.match(readme, /node vendor-graph\.mjs check vectors\/estate-minimal\.json/);
    assert.match(readme, /node vendor-graph\.mjs query /);
  });
  test('CLAUDE.md carries the estate house rules verbatim', () => {
    assert.ok(claude.includes('## House rules — true in every repository in this estate'));
    assert.ok(claude.includes('git symbolic-ref --short refs/remotes/origin/HEAD'));
    assert.ok(claude.includes('**Report what happened, including when it is worse than expected.**'));
  });
  test('no unverified adoption claim anywhere in the prose', () => {
    for (const f of ['README.md', 'SPEC.md', 'CLAUDE.md']) {
      assert.doesNotMatch(read(f), /\b(thousands|millions) of (agents|organi[sz]ations|users)\b/i, f);
      assert.doesNotMatch(read(f), /\bwidely adopted\b|\bindustry standard\b/i, f);
    }
  });
  test('the SPEC example is fictional — every URL in it is under .example', () => {
    for (const u of spec.match(/https:\/\/[^"\s)`]+/g) ?? []) {
      const host = new URL(u).hostname;
      if (host.endsWith('.example')) continue;
      // the only non-fictional URLs a spec may cite are the standards it points at
      assert.ok(['github.com', 'json-schema.org', 'therealm.live', 'flashyos.com', 'ritualos.com'].includes(host), u);
    }
  });
});

describe('no credential shape anywhere', () => {
  test('source, docs and vectors carry nothing that looks like a secret', () => {
    const files = [];
    const w = (d) => {
      for (const e of readdirSync(d)) {
        if (['node_modules', '.git'].includes(e)) continue;
        const full = join(d, e);
        if (statSync(full).isDirectory()) w(full); else files.push(full);
      }
    };
    w(ROOT);
    const shape = /(?:secret|token|apikey|api_key|password)\s*[:=]\s*['"][A-Za-z0-9_\-]{16,}['"]/i;
    for (const f of files) assert.doesNotMatch(readFileSync(f, 'utf8'), shape, relative(ROOT, f));
  });
});

// graph/1 — every rule in the SPEC, held by a test. The vectors under
// vectors/invalid/ are each named for the refusal code they must trigger, so
// the filename is the assertion.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  validate, fromRealm, query, main,
  CONTRACT, NODE_KINDS, EDGE_KINDS, ENDPOINTS, REFUSED_KEYS, WELL_KNOWN,
} from '../vendor-graph.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const VECTORS = join(ROOT, 'vectors');
const CLI = join(ROOT, 'vendor-graph.mjs');
const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'));
const clone = (v) => structuredClone(v);
const minimal = () => readJson(join(VECTORS, 'estate-minimal.json'));
const estate = () => readJson(join(VECTORS, 'estate-fictional.json'));
const codes = (doc) => validate(doc).errors.map((e) => e.code);

const validVectors = readdirSync(VECTORS).filter((f) => f.endsWith('.json'));
const invalidVectors = readdirSync(join(VECTORS, 'invalid')).filter((f) => f.endsWith('.json'));

describe('vectors', () => {
  test('there are at least three valid and six invalid vectors', () => {
    assert.ok(validVectors.length >= 3, `valid: ${validVectors.length}`);
    assert.ok(invalidVectors.length >= 6, `invalid: ${invalidVectors.length}`);
  });
  for (const f of validVectors) {
    test(`valid: ${f}`, () => {
      const r = validate(readJson(join(VECTORS, f)));
      assert.deepEqual(r.errors, []);
      assert.equal(r.valid, true);
    });
  }
  for (const f of invalidVectors) {
    test(`invalid: ${f} is refused as "${basename(f, '.json')}"`, () => {
      const r = validate(readJson(join(VECTORS, 'invalid', f)));
      assert.equal(r.valid, false);
      assert.ok(r.errors.map((e) => e.code).includes(basename(f, '.json')),
        `expected code ${basename(f, '.json')}, got ${JSON.stringify(r.errors)}`);
    });
  }
  test('every vector is clearly fictional — every URL is under a reserved .example domain', () => {
    const all = [...validVectors.map((f) => join(VECTORS, f)), ...invalidVectors.map((f) => join(VECTORS, 'invalid', f))];
    for (const p of all) {
      const urls = readFileSync(p, 'utf8').match(/https:\/\/[^"\s]+/g) ?? [];
      for (const u of urls) assert.match(new URL(u).hostname, /\.example$/, `${basename(p)}: ${u}`);
    }
  });
});

describe('document shape', () => {
  test('a non-object is refused', () => {
    for (const v of [null, 'x', 7, [], undefined]) assert.deepEqual(codes(v), ['not-an-object']);
  });
  test('the contract is graph/1', () => {
    const d = minimal(); d.contract = 'graph/2';
    assert.ok(codes(d).includes('bad-contract'));
    assert.equal(CONTRACT, 'graph/1');
  });
  test('the subject is an org/ id and a node in its own graph', () => {
    const d = minimal(); d.subject = 'person/quill';
    assert.ok(codes(d).includes('bad-subject'));
    const e = minimal(); e.subject = 'org/nobody';
    assert.ok(codes(e).includes('subject-not-a-node'));
  });
  test('generated and at are ISO 8601', () => {
    const d = minimal(); d.generated = '28/09/2026';
    assert.ok(codes(d).includes('bad-date'));
    const e = minimal(); e.edges[0].at = '2026-09-28';
    assert.ok(codes(e).includes('bad-date'));
    const f = minimal(); f.edges[0].at = '2026-13-45T00:00:00Z';
    assert.ok(codes(f).includes('bad-date'));
  });
  test('unknown top-level keys are refused; x- keys are not', () => {
    const d = minimal(); d.publisher = 'x';
    assert.ok(codes(d).includes('unknown-key'));
    const e = minimal(); e['x-anything'] = { nested: true };
    assert.equal(validate(e).valid, true);
  });
  test('unknown node, edge and external keys are refused; x- keys are not', () => {
    const d = minimal(); d.nodes[0].website = 'x';
    assert.ok(codes(d).includes('unknown-key'));
    const e = minimal(); e.edges[0].weight = 1;
    assert.ok(codes(e).includes('unknown-key'));
    const f = estate(); f.externals[0].note = 'x';
    assert.ok(codes(f).includes('unknown-key'));
    const g = minimal(); g.nodes[0]['x-role'] = 'courier'; g.edges[0]['x-note'] = 'n';
    assert.equal(validate(g).valid, true);
  });
  test('a graph with nodes and no edges is valid — it carries no claims', () => {
    const d = minimal(); d.edges = [];
    assert.equal(validate(d).valid, true);
  });
  test('validate returns every refusal, not the first', () => {
    const d = minimal(); d.publisher = 'x'; d.edges[0].basis = undefined; d.nodes[1].kind = 'wallet';
    const c = codes(d);
    assert.ok(c.includes('unknown-key') && c.includes('edge-no-basis') && c.includes('bad-kind'));
  });
});

describe('nodes', () => {
  test('the kind list is closed', () => {
    assert.deepEqual(NODE_KINDS, ['person', 'org', 'agent', 'capability', 'tool', 'asset']);
    const d = minimal(); d.nodes[1].kind = 'wallet';
    assert.ok(codes(d).includes('bad-kind'));
  });
  test('an id is prefixed with its kind, and the two must agree', () => {
    const d = minimal(); d.nodes[1].id = 'courier';
    assert.ok(codes(d).includes('bad-id'));
    const e = minimal(); e.nodes[1].kind = 'tool';
    assert.ok(codes(e).includes('kind-mismatch'));
    const f = minimal(); f.nodes[1].id = 'agent/Lanternworks-Courier';
    assert.ok(codes(f).includes('bad-id'));
  });
  test('a capability is a lowercase action verb', () => {
    const d = minimal(); d.nodes[2].id = 'capability/Deliver'; d.edges[1].to = 'capability/Deliver';
    assert.ok(codes(d).includes('bad-id'));
    const e = minimal(); e.nodes[2].id = 'capability/deliver2'; e.edges[1].to = 'capability/deliver2';
    assert.ok(codes(e).includes('bad-id'));
    const f = minimal(); f.nodes[2].id = 'capability/content-exchange'; f.edges[1].to = 'capability/content-exchange';
    assert.equal(validate(f).valid, true);
  });
  test('a node cites an https source and carries a label', () => {
    const d = minimal(); d.nodes[0].source = 'http://lanternworks.example/.well-known/flashyos.json';
    assert.ok(codes(d).includes('no-source'));
    const e = minimal(); delete e.nodes[0].source;
    assert.ok(codes(e).includes('no-source'));
    const f = minimal(); f.nodes[0].label = '  ';
    assert.ok(codes(f).includes('no-label'));
  });
  test('node ids are unique, and an external may not repeat an authored node', () => {
    const d = minimal(); d.nodes.push(clone(d.nodes[1]));
    assert.ok(codes(d).includes('duplicate-id'));
    const e = minimal(); e.externals = [{ id: 'org/lanternworks', kind: 'org', source: 'https://elsewhere.example/x.json' }];
    assert.ok(codes(e).includes('duplicate-id'));
  });
});

describe('edges', () => {
  test('the kind list is closed and every kind has an endpoint rule', () => {
    assert.deepEqual(EDGE_KINDS, ['member-of', 'operates', 'offers', 'requires', 'owns', 'attests', 'transacted-with', 'delegates-to']);
    assert.deepEqual(Object.keys(ENDPOINTS).sort(), [...EDGE_KINDS].sort());
    for (const k of EDGE_KINDS) {
      for (const end of ['from', 'to']) for (const nk of ENDPOINTS[k][end]) assert.ok(NODE_KINDS.includes(nk), `${k}.${end}: ${nk}`);
    }
    const d = minimal(); d.edges[0].kind = 'trusts';
    assert.ok(codes(d).includes('bad-kind'));
  });
  test('every edge cites an https basis — no evidence, no edge', () => {
    const d = minimal(); delete d.edges[0].basis;
    assert.deepEqual(codes(d), ['edge-no-basis']);
    const e = minimal(); e.edges[0].basis = 'http://lanternworks.example/x';
    assert.deepEqual(codes(e), ['edge-no-basis']);
    const f = minimal(); f.edges[0].basis = 'a note in a drawer';
    assert.deepEqual(codes(f), ['edge-no-basis']);
  });
  test('asserted_by is a person/ or org/ id that the document knows', () => {
    const d = minimal(); d.edges[0].asserted_by = 'agent/lanternworks-courier';
    assert.ok(codes(d).includes('bad-asserter'));
    const e = minimal(); e.edges[0].asserted_by = 'org/nobody';
    assert.ok(codes(e).includes('dangling-reference'));
    const f = minimal(); delete f.edges[0].asserted_by;
    assert.ok(codes(f).includes('bad-asserter'));
  });
  test('an edge endpoint must be a node in the document or a qualified external', () => {
    const d = minimal(); d.edges[1].to = 'capability/route';
    assert.deepEqual(codes(d), ['dangling-reference']);
    const e = minimal(); e.edges[0].from = 'org/ghost';
    assert.ok(codes(e).includes('dangling-reference'));
    const f = minimal();
    f.externals = [{ id: 'org/farholm', kind: 'org', source: 'https://farholm.example/.well-known/flashyos.json' }];
    f.edges.push({ id: 'edge/l-t-f', from: 'org/lanternworks', to: 'org/farholm', kind: 'transacted-with',
      asserted_by: 'org/lanternworks', basis: 'https://lanternworks.example/settlements/1.json', at: '2026-09-28T00:00:00Z' });
    assert.equal(validate(f).valid, true);
    const g = clone(f); delete g.externals[0].source;
    assert.ok(codes(g).includes('no-source'));
  });
  test('an edge runs only between the node kinds its table allows', () => {
    const d = minimal(); d.edges[1].to = 'org/lanternworks'; // offers → org
    assert.ok(codes(d).includes('bad-endpoint'));
    const e = minimal(); e.edges[0].from = 'agent/lanternworks-courier'; e.edges[0].to = 'org/lanternworks'; // agent operates org
    assert.ok(codes(e).includes('bad-endpoint'));
  });
  test('an edge from a node to itself is refused', () => {
    const d = estate();
    d.edges.push({ id: 'edge/self', from: 'org/lanternworks', to: 'org/lanternworks', kind: 'transacted-with',
      asserted_by: 'org/lanternworks', basis: 'https://lanternworks.example/x.json', at: '2026-09-28T00:00:00Z' });
    assert.ok(codes(d).includes('self-loop'));
  });
  test('edge ids are edge/<slug> and unique', () => {
    const d = minimal(); d.edges[0].id = 'lanternworks-operates-courier';
    assert.ok(codes(d).includes('bad-id'));
    const e = minimal(); e.edges[1].id = e.edges[0].id;
    assert.ok(codes(e).includes('duplicate-id'));
  });
});

describe('no self-attestation', () => {
  const attest = (assertedBy) => {
    const d = estate();
    d.edges = d.edges.filter((e) => e.kind !== 'attests');
    d.edges.push({ id: 'edge/a', from: 'org/tidewater-guild', to: 'agent/lanternworks-courier', kind: 'attests',
      asserted_by: assertedBy, basis: 'https://tidewater-guild.example/attestations/courier.json', at: '2026-09-28T00:00:00Z' });
    return d;
  };
  test('the attested party may not assert its own attestation (asserted_by === to)', () => {
    const d = attest('agent/lanternworks-courier');
    // an agent cannot assert at all; make the attested party an org to isolate the rule
    d.edges.at(-1).to = 'org/lanternworks'; d.edges.at(-1).asserted_by = 'org/lanternworks';
    assert.deepEqual(codes(d), ['self-attestation']);
  });
  test('the attester may not carry its own attestation alone (asserted_by === from)', () => {
    assert.deepEqual(codes(attest('org/tidewater-guild')), ['self-attestation']);
  });
  test('a third party carrying it, citing the attester\'s publication, is valid', () => {
    assert.equal(validate(attest('org/atlas-of-vale')).valid, true);
    assert.equal(validate(attest('person/quill')).valid, true);
  });
  test('the rule is specific to attests — an org may assert that it operates its own agent', () => {
    assert.equal(validate(minimal()).valid, true);
  });
});

describe('no scores, no amounts', () => {
  test('the refused key list', () => {
    assert.deepEqual(REFUSED_KEYS, ['score', 'rating', 'rank', 'reputation', 'amount', 'value', 'price', 'balance', 'gold']);
  });
  for (const key of REFUSED_KEYS) {
    test(`"${key}" is refused on a node, an edge, at the top level, under x-, and nested`, () => {
      const a = minimal(); a.nodes[1][key] = 1;
      assert.ok(codes(a).includes('score-field'), `node.${key}`);
      const b = minimal(); b.edges[0][key] = 1;
      assert.ok(codes(b).includes('score-field'), `edge.${key}`);
      const c = minimal(); c[key] = 1;
      assert.ok(codes(c).includes('score-field'), `top.${key}`);
      const d = minimal(); d[`x-${key}`] = 1;
      assert.ok(codes(d).includes('score-field'), `x-${key}`);
      const e = minimal(); e['x-meta'] = { deep: { [key.toUpperCase()]: 1 } };
      assert.ok(codes(e).includes('score-field'), `nested ${key}`);
    });
  }
  test('a refused key is reported with its path — and an x- wrapper that is itself a refused word is reported too', () => {
    const d = minimal(); d.nodes[1]['x-reputation'] = { score: 0.9 };
    const paths = validate(d).errors.filter((e) => e.code === 'score-field').map((e) => e.path);
    assert.deepEqual(paths, ['nodes[1].x-reputation', 'nodes[1].x-reputation.score']);
    const e = minimal(); e.nodes[1]['x-meta'] = { score: 0.9 };
    assert.deepEqual(validate(e).errors.map((x) => x.path), ['nodes[1].x-meta.score']);
  });
});

describe('the schema', () => {
  const schema = readJson(join(ROOT, 'schema', 'graph-1.json'));
  test('is draft 2020-12, closed, and extends only under x-', () => {
    assert.equal(schema.$schema, 'https://json-schema.org/draft/2020-12/schema');
    assert.equal(schema.properties.contract.const, CONTRACT);
    for (const s of [schema, schema.$defs.node, schema.$defs.edge, schema.$defs.external]) {
      assert.equal(s.additionalProperties, false);
      assert.deepEqual(Object.keys(s.patternProperties), ['^x-']);
    }
  });
  test('its enums are the module\'s closed lists — one source, pinned', () => {
    assert.deepEqual(schema.$defs.nodeKind.enum, [...NODE_KINDS]);
    assert.deepEqual(schema.$defs.edgeKind.enum, [...EDGE_KINDS]);
  });
  test('its required lists match what validate() demands', () => {
    assert.deepEqual(schema.required, ['contract', 'subject', 'generated', 'nodes', 'edges']);
    assert.deepEqual(schema.$defs.node.required, ['id', 'kind', 'label', 'source']);
    assert.deepEqual(schema.$defs.edge.required, ['id', 'from', 'to', 'kind', 'asserted_by', 'basis', 'at']);
  });
});

describe('fromRealm — deriving nodes from a realm/1 manifest', () => {
  const manifest = () => readJson(join(ROOT, 'test', 'fixtures', 'realm-1.json'));
  test('every house becomes an org/<org> node carrying its realm vocabulary; the parent becomes one too', () => {
    const g = fromRealm(manifest());
    assert.equal(g.contract, CONTRACT);
    assert.deepEqual(g.edges, []);
    assert.deepEqual(g.nodes.map((n) => n.id), ['org/crown-of-vale', 'org/lanternworks', 'org/tidewater-guild', 'org/ember-rites']);
    for (const n of g.nodes) assert.equal(n.kind, 'org');
    const lantern = g.nodes.find((n) => n.id === 'org/lanternworks');
    assert.equal(lantern.label, 'The Lanternworks');
    assert.deepEqual(lantern['x-realm'], {
      relation: 'house', slug: 'lantern', house: 'The Lanternworks', domain: 'lanternworks.example',
      status: 'live', role: 'Fictional: lights the roads.', identity: { house: 'flame', archetype: 'creator' },
    });
    assert.deepEqual(g['x-derived-from'], { contract: 'realm/1', url: 'https://atlas-of-vale.example/.well-known/realm.json' });
  });
  test('a live house is checkable at its handshake; a non-live one only at the manifest', () => {
    const g = fromRealm(manifest());
    const by = (id) => g.nodes.find((n) => n.id === id);
    assert.equal(by('org/lanternworks').source, 'https://lanternworks.example/.well-known/flashyos.json');
    assert.equal(by('org/tidewater-guild').source, 'https://atlas-of-vale.example/.well-known/realm.json');
    assert.equal(by('org/ember-rites').source, 'https://atlas-of-vale.example/.well-known/realm.json');
    assert.equal(by('org/crown-of-vale').source, 'https://atlas-of-vale.example/.well-known/realm.json');
    assert.equal('identity' in by('org/ember-rites')['x-realm'], false, 'no identity is carried when none is curated');
  });
  test('the derived nodes compose into a valid graph/1 document once a publisher signs it', () => {
    const g = fromRealm(manifest());
    const doc = { ...g, subject: 'org/crown-of-vale', generated: '2026-09-28T00:00:00Z' };
    assert.deepEqual(validate(doc).errors, []);
  });
  test('it refuses what it would have to guess', () => {
    assert.throws(() => fromRealm({ contract: 'graph/1' }), /not a realm\/1 manifest/);
    assert.throws(() => fromRealm(null), /not a realm\/1 manifest/);
    const noDomain = manifest(); delete noDomain.domain;
    assert.throws(() => fromRealm(noDomain), /names no domain/);
    const noOrg = manifest(); delete noOrg.houses[1].org;
    assert.throws(() => fromRealm(noOrg), /house "tidewater" names no machine-safe org/);
    const deadLive = manifest(); delete deadLive.houses[0].surfaces;
    assert.throws(() => fromRealm(deadLive), /live but names no https handshake/);
    const twice = manifest(); twice.houses[1].org = 'lanternworks';
    assert.throws(() => fromRealm(twice), /two entries name one org/);
  });
});

describe('query — the one v1 question', () => {
  test('agents with an offers edge to the capability', () => {
    assert.deepEqual(query(minimal(), { capability: 'deliver' }), ['agent/lanternworks-courier']);
    assert.deepEqual(query(minimal(), { capability: 'capability/deliver' }), ['agent/lanternworks-courier']);
    assert.deepEqual(query(minimal(), { capability: 'route' }), []);
    assert.deepEqual(query(estate(), { capability: 'deliver' }), ['agent/lanternworks-courier', 'agent/tidewater-scribe']);
    assert.deepEqual(query(estate(), { capability: 'verify' }), ['agent/tidewater-scribe']);
  });
  test('only agent nodes are returned — an org that offers a capability is not an agent', () => {
    const d = estate();
    d.edges.push({ id: 'edge/org-offers', from: 'org/lanternworks', to: 'capability/deliver', kind: 'offers',
      asserted_by: 'org/lanternworks', basis: 'https://lanternworks.example/x.json', at: '2026-09-28T00:00:00Z' });
    assert.deepEqual(query(d, { capability: 'deliver' }), ['agent/lanternworks-courier', 'agent/tidewater-scribe']);
  });
  test('attestedBy narrows to agents an attests edge from that id (or any node of that kind) points at', () => {
    assert.deepEqual(query(estate(), { capability: 'deliver', attestedBy: 'org/tidewater-guild' }), ['agent/lanternworks-courier']);
    assert.deepEqual(query(estate(), { capability: 'deliver', attestedBy: 'org/' }), ['agent/lanternworks-courier']);
    assert.deepEqual(query(estate(), { capability: 'deliver', attestedBy: 'person/' }), []);
    assert.deepEqual(query(estate(), { capability: 'deliver', attestedBy: 'org/atlas-of-vale' }), [], 'the asserter is not the attester');
    assert.deepEqual(query(minimal(), { capability: 'deliver', attestedBy: 'org/' }), [], 'no attests edge, no match');
  });
  test('it refuses an invalid document, a missing capability, and a malformed attester', () => {
    const bad = minimal(); delete bad.edges[0].basis;
    assert.throws(() => query(bad, { capability: 'deliver' }), /edge-no-basis/);
    assert.throws(() => query(minimal(), {}), /capability is required/);
    assert.throws(() => query(minimal()), /capability is required/);
    assert.throws(() => query(minimal(), { capability: 'Deliver' }), /not a lowercase action verb/);
    assert.throws(() => query(minimal(), { capability: 'deliver', attestedBy: 'agent/x' }), /not a person\/ or org\/ id/);
    assert.throws(() => query(minimal(), { capability: 'deliver', attestedBy: '' }), /attestedBy/);
  });
  test('it is pure — the document is not mutated', () => {
    const d = estate(); const before = JSON.stringify(d);
    query(d, { capability: 'deliver', attestedBy: 'org/' });
    assert.equal(JSON.stringify(d), before);
  });
});

describe('the CLI', () => {
  const run = (...args) => spawnSync(process.execPath, [CLI, ...args], { encoding: 'utf8' });
  const capture = () => { const out = [], err = []; return { log: (s) => out.push(s), error: (s) => err.push(s), out, err }; };

  test('check exits 0 on a valid vector and says what it read', () => {
    const r = run('check', join(VECTORS, 'estate-minimal.json'));
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, /valid — 3 nodes, 2 edges, published by org\/lanternworks/);
  });
  test('check exits 1 on every invalid vector and names the refusal', () => {
    for (const f of invalidVectors) {
      const r = run('check', join(VECTORS, 'invalid', f));
      assert.equal(r.status, 1, f);
      assert.ok(r.stderr.includes(basename(f, '.json')), `${f}: ${r.stderr}`);
    }
  });
  test('check exits 1 on a missing file or a file that is not JSON', () => {
    assert.equal(run('check', join(VECTORS, 'nope.json')).status, 1);
    assert.equal(run('check', join(ROOT, 'README.md')).status, 1);
  });
  test('query prints matching agent ids, one per line', () => {
    const r = run('query', join(VECTORS, 'estate-fictional.json'), 'deliver');
    assert.equal(r.status, 0, r.stderr);
    assert.equal(r.stdout, 'agent/lanternworks-courier\nagent/tidewater-scribe\n');
    const s = run('query', join(VECTORS, 'estate-fictional.json'), 'deliver', '--attested-by', 'org/');
    assert.equal(s.stdout, 'agent/lanternworks-courier\n');
  });
  test('query with no match exits 0, prints nothing to stdout, and says so on stderr', () => {
    const r = run('query', join(VECTORS, 'estate-minimal.json'), 'route');
    assert.equal(r.status, 0);
    assert.equal(r.stdout, '');
    assert.match(r.stderr, /no agent .* offers route/);
  });
  test('query exits 1 on an invalid document rather than answering over it', () => {
    const r = run('query', join(VECTORS, 'invalid', 'edge-no-basis.json'), 'deliver');
    assert.equal(r.status, 1);
    assert.match(r.stderr, /edge-no-basis/);
  });
  test('from-realm prints the derived partial document', () => {
    const r = run('from-realm', join(ROOT, 'test', 'fixtures', 'realm-1.json'));
    assert.equal(r.status, 0, r.stderr);
    const g = JSON.parse(r.stdout);
    assert.equal(g.contract, CONTRACT);
    assert.equal(g.nodes.length, 4);
    const s = run('from-realm', join(VECTORS, 'estate-minimal.json'));
    assert.equal(s.status, 1);
  });
  test('usage errors exit 2', () => {
    assert.equal(run().status, 2);
    assert.equal(run('frobnicate', 'x.json').status, 2);
    assert.equal(run('query', join(VECTORS, 'estate-minimal.json')).status, 2);
    assert.equal(run('query', join(VECTORS, 'estate-minimal.json'), 'deliver', '--attested-by').status, 2);
  });
  test('main() is callable in-process with an injected logger', () => {
    const log = capture();
    assert.equal(main(['check', join(VECTORS, 'extensions.json')], log), 0);
    assert.equal(log.err.length, 0);
    assert.match(log.out[0], /valid/);
  });
  test('the served path is the publisher\'s own projection', () => {
    assert.equal(WELL_KNOWN, '/.well-known/graph.json');
  });
});

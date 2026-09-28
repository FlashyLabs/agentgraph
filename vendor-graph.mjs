#!/usr/bin/env node
// graph/1 — the universal graph of the agentic internet: the "What exists?" layer.
//
// People, organisations, agents, capabilities, tools and assets as NODES; the
// relationships between them as EDGES, every one of which cites the https URL
// where its asserter publishes the evidence. A consumer reads a publisher's
// /.well-known/graph.json and can answer "find an agent that offers <verb>,
// attested by an org that is not itself" without trusting anybody's word.
//
// Three doctrines, inherited from the estate and enforced here, not described:
//   - an edge with no `basis` is a claim, and graph/1 does not carry claims;
//   - standing comes from what OTHERS assert — an `attests` edge whose asserter
//     is either endpoint is refused;
//   - no score, rating, amount or value lives in the graph, at any depth,
//     under any key. Reputation is a consumer's computation; money is a
//     separate format.
//
// Dependency-free by design: `node:` builtins only, so the check runs anywhere
// Node runs and can never quietly not run for want of an install. The parser
// refuses; it does not guess.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const CONTRACT = 'graph/1';
export const REALM_CONTRACT = 'realm/1';
export const WELL_KNOWN = '/.well-known/graph.json';

/** The closed list of node kinds. A node id's prefix must equal its kind. */
export const NODE_KINDS = Object.freeze(['person', 'org', 'agent', 'capability', 'tool', 'asset']);

/** The closed list of edge kinds. */
export const EDGE_KINDS = Object.freeze([
  'member-of', 'operates', 'offers', 'requires', 'owns', 'attests', 'transacted-with', 'delegates-to',
]);

/**
 * Which node kinds each edge kind may join. An edge outside its table is a
 * relationship the format has no meaning for, and a meaning the format does
 * not define is a meaning a consumer would have to guess.
 */
export const ENDPOINTS = Object.freeze({
  'member-of':       { from: ['person', 'agent'],              to: ['org'] },
  'operates':        { from: ['org', 'person'],                to: ['agent', 'tool'] },
  'offers':          { from: ['agent', 'org', 'tool'],         to: ['capability'] },
  'requires':        { from: ['agent', 'tool', 'capability'],  to: ['capability', 'tool', 'asset'] },
  'owns':            { from: ['person', 'org'],                to: ['asset', 'tool', 'agent'] },
  'attests':         { from: ['person', 'org'],                to: ['person', 'org', 'agent', 'tool', 'asset'] },
  'transacted-with': { from: ['person', 'org', 'agent'],       to: ['person', 'org', 'agent'] },
  'delegates-to':    { from: ['person', 'org', 'agent'],       to: ['agent', 'person', 'org'] },
});

/**
 * Key names refused anywhere in a document, at any depth, with or without an
 * `x-` prefix. A score under an extension key is still a score in the graph.
 */
export const REFUSED_KEYS = Object.freeze([
  'score', 'rating', 'rank', 'reputation', 'amount', 'value', 'price', 'balance', 'gold',
]);

const DOC_KEYS = new Set(['contract', 'subject', 'generated', 'nodes', 'edges', 'externals']);
const NODE_KEYS = new Set(['id', 'kind', 'label', 'source']);
const EDGE_KEYS = new Set(['id', 'from', 'to', 'kind', 'asserted_by', 'basis', 'at']);
const EXTERNAL_KEYS = new Set(['id', 'kind', 'source']);

/** Estate id conventions: `<kind>/<slug>`, lowercase, machine-safe. */
const NODE_ID = /^(person|org|agent|capability|tool|asset)\/[a-z0-9][a-z0-9.-]*$/;
/** A capability is a lowercase action verb (hyphenated compounds allowed). */
const CAPABILITY_ID = /^capability\/[a-z]+(?:-[a-z]+)*$/;
const EDGE_ID = /^edge\/[a-z0-9][a-z0-9.-]*$/;
const ORG_ID = /^org\/[a-z0-9][a-z0-9.-]*$/;
const ASSERTER_ID = /^(person|org)\/[a-z0-9][a-z0-9.-]*$/;
const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/;

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const isIso = (v) => typeof v === 'string' && ISO.test(v) && !Number.isNaN(Date.parse(v));
const kindOf = (id) => (typeof id === 'string' ? id.split('/')[0] : undefined);

/** True only for a parseable URL whose scheme is https. */
export function isHttps(v) {
  if (typeof v !== 'string') return false;
  try { return new URL(v).protocol === 'https:'; } catch { return false; }
}

/** Walk every key at every depth; call `hit` for each refused key name. */
function scanRefusedKeys(value, path, hit) {
  if (Array.isArray(value)) {
    value.forEach((v, i) => scanRefusedKeys(v, `${path}[${i}]`, hit));
  } else if (isObj(value)) {
    for (const [k, v] of Object.entries(value)) {
      const bare = k.toLowerCase().replace(/^x-/, '');
      if (REFUSED_KEYS.includes(bare)) hit(path ? `${path}.${k}` : k, k);
      scanRefusedKeys(v, path ? `${path}.${k}` : k, hit);
    }
  }
}

/**
 * Validate a graph/1 document. Never throws on a bad document: returns every
 * refusal it found as `{ code, path, message }`, so a publisher fixes all of
 * them in one pass. `code` is stable and is what the vectors are named for.
 */
export function validate(doc) {
  const errors = [];
  const refuse = (code, path, message) => { errors.push({ code, path, message }); };

  if (!isObj(doc)) {
    refuse('not-an-object', '', 'a graph/1 document is a JSON object');
    return { valid: false, errors };
  }

  for (const k of Object.keys(doc)) {
    if (!DOC_KEYS.has(k) && !k.startsWith('x-')) {
      refuse('unknown-key', k, `unknown top-level key "${k}" — graph/1 extends only under x- keys`);
    }
  }
  if (doc.contract !== CONTRACT) refuse('bad-contract', 'contract', `contract must be "${CONTRACT}"`);
  if (typeof doc.subject !== 'string' || !ORG_ID.test(doc.subject)) {
    refuse('bad-subject', 'subject', 'subject is the publisher: an org/<slug> id');
  }
  if (!isIso(doc.generated)) refuse('bad-date', 'generated', 'generated must be an ISO 8601 timestamp');
  if (!Array.isArray(doc.nodes)) refuse('bad-nodes', 'nodes', 'nodes must be an array');
  if (!Array.isArray(doc.edges)) refuse('bad-edges', 'edges', 'edges must be an array');
  if (doc.externals !== undefined && !Array.isArray(doc.externals)) {
    refuse('bad-externals', 'externals', 'externals, when present, must be an array');
  }

  scanRefusedKeys(doc, '', (path, key) => refuse(
    'score-field', path,
    `"${key}" is a score or an amount — graph/1 carries neither; reputation is a consumer's computation and money is a separate format`,
  ));

  // Every id the document knows, node or external, with its kind.
  const known = new Map();

  for (const [i, n] of (Array.isArray(doc.nodes) ? doc.nodes : []).entries()) {
    const p = `nodes[${i}]`;
    if (!isObj(n)) { refuse('bad-node', p, 'a node is an object'); continue; }
    for (const k of Object.keys(n)) {
      if (!NODE_KEYS.has(k) && !k.startsWith('x-')) refuse('unknown-key', `${p}.${k}`, `unknown node key "${k}"`);
    }
    if (typeof n.id !== 'string' || !NODE_ID.test(n.id)) {
      refuse('bad-id', `${p}.id`, `node id "${n.id}" is not <person|org|agent|capability|tool|asset>/<slug>`);
    } else if (kindOf(n.id) === 'capability' && !CAPABILITY_ID.test(n.id)) {
      refuse('bad-id', `${p}.id`, `capability "${n.id}" is not a lowercase action verb`);
    }
    if (!NODE_KINDS.includes(n.kind)) {
      refuse('bad-kind', `${p}.kind`, `node kind "${n.kind}" is not one of ${NODE_KINDS.join('|')}`);
    } else if (typeof n.id === 'string' && NODE_ID.test(n.id) && kindOf(n.id) !== n.kind) {
      refuse('kind-mismatch', `${p}.kind`, `id "${n.id}" says ${kindOf(n.id)}, kind says ${n.kind}`);
    }
    if (typeof n.label !== 'string' || !n.label.trim()) refuse('no-label', `${p}.label`, 'a node carries a human-readable label');
    if (!isHttps(n.source)) refuse('no-source', `${p}.source`, 'a node cites an https URL where its existence can be checked');
    if (typeof n.id === 'string') {
      if (known.has(n.id)) refuse('duplicate-id', `${p}.id`, `duplicate id "${n.id}"`);
      else known.set(n.id, n.kind);
    }
  }

  for (const [i, x] of (Array.isArray(doc.externals) ? doc.externals : []).entries()) {
    const p = `externals[${i}]`;
    if (!isObj(x)) { refuse('bad-external', p, 'an external is an object'); continue; }
    for (const k of Object.keys(x)) {
      if (!EXTERNAL_KEYS.has(k) && !k.startsWith('x-')) refuse('unknown-key', `${p}.${k}`, `unknown external key "${k}"`);
    }
    if (typeof x.id !== 'string' || !NODE_ID.test(x.id)) refuse('bad-id', `${p}.id`, `external id "${x.id}" is not a namespaced id`);
    if (!NODE_KINDS.includes(x.kind)) refuse('bad-kind', `${p}.kind`, `external kind "${x.kind}" is not one of ${NODE_KINDS.join('|')}`);
    else if (typeof x.id === 'string' && NODE_ID.test(x.id) && kindOf(x.id) !== x.kind) {
      refuse('kind-mismatch', `${p}.kind`, `id "${x.id}" says ${kindOf(x.id)}, kind says ${x.kind}`);
    }
    if (!isHttps(x.source)) refuse('no-source', `${p}.source`, 'an external is qualified by an https URL where it can be checked');
    if (typeof x.id === 'string') {
      if (known.has(x.id)) refuse('duplicate-id', `${p}.id`, `"${x.id}" is both authored here and cited as external`);
      else known.set(x.id, x.kind);
    }
  }

  if (typeof doc.subject === 'string' && ORG_ID.test(doc.subject) && known.get(doc.subject) !== 'org') {
    refuse('subject-not-a-node', 'subject', `the publisher "${doc.subject}" is not an org node in its own graph`);
  }

  const edgeIds = new Set();
  for (const [i, e] of (Array.isArray(doc.edges) ? doc.edges : []).entries()) {
    const p = `edges[${i}]`;
    if (!isObj(e)) { refuse('bad-edge', p, 'an edge is an object'); continue; }
    for (const k of Object.keys(e)) {
      if (!EDGE_KEYS.has(k) && !k.startsWith('x-')) refuse('unknown-key', `${p}.${k}`, `unknown edge key "${k}"`);
    }
    if (typeof e.id !== 'string' || !EDGE_ID.test(e.id)) refuse('bad-id', `${p}.id`, `edge id "${e.id}" is not edge/<slug>`);
    else if (edgeIds.has(e.id)) refuse('duplicate-id', `${p}.id`, `duplicate edge id "${e.id}"`);
    else edgeIds.add(e.id);

    const kindOk = EDGE_KINDS.includes(e.kind);
    if (!kindOk) refuse('bad-kind', `${p}.kind`, `edge kind "${e.kind}" is not one of ${EDGE_KINDS.join('|')}`);

    for (const end of ['from', 'to']) {
      if (typeof e[end] !== 'string' || !known.has(e[end])) {
        refuse('dangling-reference', `${p}.${end}`, `${end} "${e[end]}" is neither a node in this document nor a qualified external`);
      } else if (kindOk && !ENDPOINTS[e.kind][end].includes(known.get(e[end]))) {
        refuse('bad-endpoint', `${p}.${end}`, `"${e.kind}" does not run ${end} a ${known.get(e[end])} node (allowed: ${ENDPOINTS[e.kind][end].join('|')})`);
      }
    }
    if (typeof e.from === 'string' && e.from === e.to) refuse('self-loop', p, `an edge from "${e.from}" to itself relates nothing`);

    if (typeof e.asserted_by !== 'string' || !ASSERTER_ID.test(e.asserted_by)) {
      refuse('bad-asserter', `${p}.asserted_by`, 'asserted_by is a person/ or org/ id — only a person or an organisation asserts');
    } else if (!known.has(e.asserted_by)) {
      refuse('dangling-reference', `${p}.asserted_by`, `asserted_by "${e.asserted_by}" is neither a node in this document nor a qualified external`);
    } else if (e.kind === 'attests' && (e.asserted_by === e.to || e.asserted_by === e.from)) {
      refuse('self-attestation', `${p}.asserted_by`, `"${e.asserted_by}" asserts an attestation it is party to — standing comes from what others assert`);
    }
    if (!isHttps(e.basis)) refuse('edge-no-basis', `${p}.basis`, 'an edge cites an https URL its asserter publishes as evidence — without one it is a claim, and graph/1 does not carry claims');
    if (!isIso(e.at)) refuse('bad-date', `${p}.at`, 'at must be an ISO 8601 timestamp');
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Derive graph/1 NODES from a realm/1 manifest (FlashyLabs/therealm, SPEC.md).
 *
 * The mapping, in full:
 *   - manifest.parent            → one org node, `org/<parent.org>`, source = the manifest URL
 *   - each manifest.houses[i]    → one org node, `org/<house.org>`; label = the lore name
 *                                  (`house.house`, falling back to the org id); source = the
 *                                  house's `surfaces.handshake` when it is live, else the
 *                                  manifest URL (the only place a non-live house is checkable);
 *                                  realm vocabulary carried under `x-realm`: slug, house,
 *                                  domain, status, role, and the identity/1 pair when curated.
 *   - the manifest URL           = https://<manifest.domain>/.well-known/realm.json
 *
 * It emits NO edges: an index of what exists is not evidence of who relates to
 * whom, and an edge without a basis its asserter publishes is refused. The
 * result is partial — no `subject`, no `generated` — because both belong to
 * the publisher composing it, never to the derivation. Throws on anything it
 * would otherwise have to guess.
 */
export function fromRealm(manifest) {
  const fail = (m) => { throw new Error(`fromRealm: ${m}`); };
  if (!isObj(manifest) || manifest.contract !== REALM_CONTRACT) fail(`not a ${REALM_CONTRACT} manifest`);
  if (typeof manifest.domain !== 'string' || !/^[a-z0-9.-]+$/.test(manifest.domain)) fail('manifest names no domain');
  if (!Array.isArray(manifest.houses)) fail('manifest has no houses array');
  const realmUrl = `https://${manifest.domain}/.well-known/realm.json`;
  const SLUG = /^[a-z0-9][a-z0-9.-]*$/;
  const nodes = [];
  const seen = new Set();

  const push = (node) => {
    if (seen.has(node.id)) fail(`two entries name one org "${node.id}"`);
    seen.add(node.id);
    nodes.push(node);
  };

  if (isObj(manifest.parent)) {
    const { org, domain, role } = manifest.parent;
    if (typeof org !== 'string' || !SLUG.test(org)) fail('parent names no machine-safe org');
    push({
      id: `org/${org}`, kind: 'org', label: org, source: realmUrl,
      'x-realm': { relation: 'parent', ...(domain ? { domain } : {}), ...(role ? { role } : {}) },
    });
  }

  for (const [i, h] of manifest.houses.entries()) {
    if (!isObj(h)) fail(`house ${i} is not an object`);
    if (typeof h.org !== 'string' || !SLUG.test(h.org)) fail(`house "${h.slug ?? i}" names no machine-safe org`);
    const live = h.status === 'live';
    const handshake = live && isObj(h.surfaces) && isHttps(h.surfaces.handshake) ? h.surfaces.handshake : null;
    if (live && !handshake) fail(`house "${h.slug ?? h.org}" is live but names no https handshake`);
    const xrealm = { relation: 'house' };
    for (const k of ['slug', 'house', 'domain', 'status', 'role']) if (typeof h[k] === 'string') xrealm[k] = h[k];
    if (isObj(h.identity) && typeof h.identity.house === 'string' && typeof h.identity.archetype === 'string') {
      xrealm.identity = { house: h.identity.house, archetype: h.identity.archetype };
    }
    push({
      id: `org/${h.org}`, kind: 'org',
      label: typeof h.house === 'string' && h.house.trim() ? h.house : h.org,
      source: handshake ?? realmUrl,
      'x-realm': xrealm,
    });
  }

  return { contract: CONTRACT, nodes, edges: [], 'x-derived-from': { contract: REALM_CONTRACT, url: realmUrl } };
}

/**
 * The one v1 query: agent ids that carry an `offers` edge to the capability,
 * and — when `attestedBy` is given — an `attests` edge whose `from` is that id
 * (or, for a bare kind prefix such as "org/", any node of that kind). Sorted,
 * unique, and computed only over a document that validates: a consumer never
 * queries a graph it has not checked.
 */
export function query(doc, { capability, attestedBy } = {}) {
  const { valid, errors } = validate(doc);
  if (!valid) throw new Error(`query: not a valid ${CONTRACT} document — ${errors[0].code} at ${errors[0].path || '/'}: ${errors[0].message}`);
  if (typeof capability !== 'string' || !capability.trim()) throw new Error('query: capability is required');
  const cap = capability.startsWith('capability/') ? capability : `capability/${capability}`;
  if (!CAPABILITY_ID.test(cap)) throw new Error(`query: "${capability}" is not a lowercase action verb`);

  const known = new Map();
  for (const n of doc.nodes) known.set(n.id, n.kind);
  for (const x of doc.externals ?? []) known.set(x.id, x.kind);

  const offered = new Set(
    doc.edges.filter((e) => e.kind === 'offers' && e.to === cap && known.get(e.from) === 'agent').map((e) => e.from),
  );
  if (attestedBy === undefined) return [...offered].sort();

  if (typeof attestedBy !== 'string' || !attestedBy.trim()) throw new Error('query: attestedBy, when given, is a person/ or org/ id or a bare "person/" | "org/" prefix');
  let attester;
  if (attestedBy === 'person/' || attestedBy === 'org/') attester = (id) => `${kindOf(id)}/` === attestedBy;
  else if (ASSERTER_ID.test(attestedBy)) attester = (id) => id === attestedBy;
  else throw new Error(`query: attestedBy "${attestedBy}" is not a person/ or org/ id`);

  const attested = new Set(doc.edges.filter((e) => e.kind === 'attests' && attester(e.from)).map((e) => e.to));
  return [...offered].filter((id) => attested.has(id)).sort();
}

// ── CLI ──────────────────────────────────────────────────────────────────────

const USAGE = `usage:
  node vendor-graph.mjs check <graph.json>                          exit 1 on any refusal
  node vendor-graph.mjs query <graph.json> <verb> [--attested-by <id|org/|person/>]
  node vendor-graph.mjs from-realm <realm.json>                     print the derived partial document`;

function load(file, log) {
  let text;
  try { text = readFileSync(file, 'utf8'); } catch (e) { log.error(`cannot read ${file}: ${e.message}`); return undefined; }
  try { return JSON.parse(text); } catch (e) { log.error(`${file} is not JSON: ${e.message}`); return undefined; }
}

/** The CLI, as a function so a test can drive it without a subprocess. */
export function main(argv, log = console) {
  const [cmd, file, ...rest] = argv;
  if (!cmd || !file) { log.error(USAGE); return 2; }

  if (cmd === 'check') {
    const doc = load(file, log);
    if (doc === undefined) return 1;
    const { valid, errors } = validate(doc);
    if (!valid) {
      for (const e of errors) log.error(`${e.code} at ${e.path || '/'}: ${e.message}`);
      log.error(`${CONTRACT}: ${file}: refused (${errors.length} refusal${errors.length === 1 ? '' : 's'})`);
      return 1;
    }
    log.log(`${CONTRACT}: ${file}: valid — ${doc.nodes.length} nodes, ${doc.edges.length} edges, published by ${doc.subject}`);
    return 0;
  }

  if (cmd === 'query') {
    const doc = load(file, log);
    if (doc === undefined) return 1;
    const capability = rest[0];
    const flag = rest.indexOf('--attested-by');
    const attestedBy = flag >= 0 ? rest[flag + 1] : undefined;
    if (!capability || (flag >= 0 && !attestedBy)) { log.error(USAGE); return 2; }
    let ids;
    try { ids = query(doc, { capability, attestedBy }); } catch (e) { log.error(e.message); return 1; }
    for (const id of ids) log.log(id);
    if (ids.length === 0) log.error(`no agent in ${file} offers ${capability}${attestedBy ? ` with an attestation from ${attestedBy}` : ''}`);
    return 0;
  }

  if (cmd === 'from-realm') {
    const manifest = load(file, log);
    if (manifest === undefined) return 1;
    try { log.log(JSON.stringify(fromRealm(manifest), null, 2)); } catch (e) { log.error(e.message); return 1; }
    return 0;
  }

  log.error(`unknown command "${cmd}"\n${USAGE}`);
  return 2;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exit(main(process.argv.slice(2)));
}

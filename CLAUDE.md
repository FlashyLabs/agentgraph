# agentgraph — `graph/1`, the "What exists?" layer

The vendor-neutral spec for the universal graph of the agentic internet:
people, organisations, agents, capabilities, tools and assets as nodes, the
relationships between them as edges. Dependency-free — `node:` builtins only,
Node 22, ESM — so the check runs anywhere Node runs and can never quietly not
run for want of an install. Status: draft; nothing serves it yet.

## What makes this repository different

**It extends `realm/1`; it does not reinvent it.** `FlashyLabs/therealm` is the
estate's registry — every org as a house, its machine door, the identity/1
taxonomy. `fromRealm(manifest)` in `vendor-graph.mjs` turns a realm manifest
into `org/<org>` nodes, carrying the house's slug, lore name, status and its
identity/1 pair under `x-realm`, and citing the house's own handshake as
`source`. Ids are the estate's — `person/<id>`, `org/<slug>`, `agent/<id>` —
and a capability is a lowercase action verb, the AAO charter's vocabulary. If a
realm/1 field is needed here, read it from the manifest; never hand-list what
the register already holds.

**Every edge cites evidence.** `basis` is an https URL the asserter publishes.
An edge without one is a claim, and this format carries no claims. The checker
refuses; it does not downgrade.

**No self-attestation.** An `attests` edge whose `asserted_by` is its `to` or
its `from` is refused. Standing comes from what OTHERS assert — inherited estate
doctrine, and the whole reason the graph is worth reading.

**No scores inside the graph.** `score`, `rating`, `rank`, `reputation`,
`amount`, `value`, `price`, `balance`, `gold` are refused as key names at any
depth, under any prefix — an `x-` extension is not an exemption. Reputation is a
downstream computation; money is a separate format. Do not add a field that lets
a publisher rank itself.

**The graph says what exists, and stops.** No query language beyond one helper
(`query(doc, { capability, attestedBy? })` → agent ids), no federation, no
fetching of `basis`. Each of those is a consumer's decision, and v1 leaves it
there on purpose.

## Commands

```bash
npm test          # node --test test/*.test.mjs — every vector, every rule, the realm derivation, the query, the CLI
npm run lint      # zero-install: syntax, JSON, node:-only imports, credential shapes, the licence line
node vendor-graph.mjs check vectors/estate-minimal.json
node vendor-graph.mjs query vectors/estate-fictional.json deliver --attested-by org/
node vendor-graph.mjs from-realm test/fixtures/realm-1.json
```

## Rules — each enforced by a test

- Every `vectors/invalid/<code>.json` is refused with exactly that code; every
  `vectors/*.json` validates. Add a refusal, add its vector, name it for the code.
- The closed lists (`NODE_KINDS`, `EDGE_KINDS`, `ENDPOINTS`, `REFUSED_KEYS`) live
  once in `vendor-graph.mjs`; `schema/graph-1.json`'s enums and `SPEC.md`'s
  tables are pinned against them. Change the module and the tests tell you which
  copies to update.
- Every vector and the SPEC example are fictional: every URL is under the
  reserved `.example` domain. Never seed a real person or a real org's
  relationships as an example — a fictional graph mistakable for a real one is a
  fabricated claim about real people.
- `package.json` carries no dependency key of any kind, no `license` field, and
  `engines.node >= 22`; every `.mjs` imports only `node:` builtins or relative
  files; CI installs nothing.
- The README's last line is the estate licence line, verbatim, and there is no
  `LICENSE` file.
- No adoption claim, no count, no "widely used" — the prose is checked for it.
- No credential shape anywhere in the tree.

## House rules — true in every repository in this estate
**`main` is not necessarily the default branch.** Ask, every time: `git symbolic-ref --short refs/remotes/origin/HEAD`.
**Say which branch you measured.** Reading the working tree tells you about your checkout, not the repository.
**Re-vendor before you trust a vendored change.** Files named `vendor-*.mjs` are byte-identical copies; a stale copy disagrees silently.
**No secret in a file, a repo, or an artifact.** Secret Manager only.
**The licence is declared once**, in `tools/estate-licences.mjs` in flashyos. Do not decide this repository's licence inside it.
**A generated file is regenerated, never hand-edited.**
**Report what happened, including when it is worse than expected.**

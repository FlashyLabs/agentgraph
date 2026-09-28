# graph/1 — the universal graph of the agentic internet

Status: draft. Contract name: `graph/1`. Nothing serves it yet; this document and `vendor-graph.mjs` are the whole of it.

`graph/1` is the **"What exists?"** layer. A publisher states which people, organisations, agents, capabilities, tools and assets it knows of and how they relate, every relationship pointing at the evidence its asserter publishes. A consumer reads one or many such documents and asks questions of the shape *find an authorized agent capable of X, with backing somebody other than itself asserts*. The graph says what is there. It never says how good, how much, or how trusted — those are other layers, computed by consumers or carried by other formats.

## The document

```json
{
  "contract": "graph/1",
  "subject": "org/lanternworks",
  "generated": "2026-09-28T00:00:00Z",
  "nodes": [
    { "id": "org/lanternworks", "kind": "org", "label": "Lanternworks (fictional)",
      "source": "https://lanternworks.example/.well-known/flashyos.json" },
    { "id": "agent/lanternworks-courier", "kind": "agent", "label": "courier",
      "source": "https://lanternworks.example/.well-known/directory.json" },
    { "id": "capability/deliver", "kind": "capability", "label": "deliver",
      "source": "https://lanternworks.example/.well-known/flashyos-charter.json" }
  ],
  "edges": [
    { "id": "edge/lanternworks-operates-courier",
      "from": "org/lanternworks", "to": "agent/lanternworks-courier", "kind": "operates",
      "asserted_by": "org/lanternworks",
      "basis": "https://lanternworks.example/.well-known/directory.json",
      "at": "2026-09-28T00:00:00Z" },
    { "id": "edge/courier-offers-deliver",
      "from": "agent/lanternworks-courier", "to": "capability/deliver", "kind": "offers",
      "asserted_by": "org/lanternworks",
      "basis": "https://lanternworks.example/.well-known/flashyos-charter.json",
      "at": "2026-09-28T00:00:00Z" }
  ]
}
```

Everything above is fictional; every URL is under the reserved `.example` domain. It is `vectors/estate-minimal.json`.

### Top level

| Key | Rule |
|---|---|
| `contract` | the literal `"graph/1"` |
| `subject` | the publisher — an `org/<slug>` id, which must also be an `org` node in the document. A publisher is the first thing it knows exists. |
| `generated` | ISO 8601 timestamp |
| `nodes` | array of nodes (below); may be empty |
| `edges` | array of edges (below); may be empty — a graph of nodes with no edges carries no claims and is valid |
| `externals` | optional — ids the document references but does not author, each `{ id, kind, source }` with `source` an https URL where that id can be checked. The estate's "declare only what you are the authority for; name what you borrow" rule. |
| `x-*` | any extension; anything else at the top level is refused |

### Nodes

| Field | Rule |
|---|---|
| `id` | `<kind>/<slug>`, where the prefix is the node's `kind` and the slug is `[a-z0-9][a-z0-9.-]*`. The estate's conventions: `person/<id>`, `org/<slug>`, `agent/<id>`, plus `capability/<verb>`, `tool/<id>`, `asset/<id>`. A capability slug is a lowercase action verb, hyphenated compounds allowed (`deliver`, `verify`, `content-exchange`) — the same vocabulary an `aao/0.1` charter's `capabilities` array uses. |
| `kind` | closed list: `person` \| `org` \| `agent` \| `capability` \| `tool` \| `asset` |
| `label` | a non-empty human-readable string |
| `source` | an https URL where this node's existence can be checked — an org's `/.well-known/flashyos.json`, its entry in a `realm/1` manifest, an agent's row in a `directory/1` fragment, a tool's OpenAPI document |
| `x-*` | extensions; any other key is refused |

Node ids are unique across `nodes` and `externals` together. A `wallet` is an identity/1 subject and is not a node kind here; an asset a wallet holds is an `asset`.

### Edges

| Field | Rule |
|---|---|
| `id` | `edge/<slug>`, unique among edges |
| `from`, `to` | node ids that exist in `nodes` or are qualified in `externals`; never the same id |
| `kind` | closed list: `member-of` \| `operates` \| `offers` \| `requires` \| `owns` \| `attests` \| `transacted-with` \| `delegates-to` |
| `asserted_by` | who places this edge in the graph — a `person/` or `org/` id known to the document. Only a person or an organisation asserts; an agent's edges are asserted by whoever is accountable for it. |
| `basis` | an https URL the asserter publishes as the evidence for this edge |
| `at` | ISO 8601 timestamp — when the asserter asserted it |
| `x-*` | extensions; any other key is refused |

Each edge kind joins only the node kinds in its row. An edge outside its row has no meaning the format defines, and a meaning the format leaves undefined is one a consumer would have to guess.

| kind | from | to | reads as |
|---|---|---|---|
| `member-of` | person, agent | org | *from* belongs to *to* |
| `operates` | org, person | agent, tool | *from* runs and is accountable for *to* |
| `offers` | agent, org, tool | capability | *from* can perform the verb *to* |
| `requires` | agent, tool, capability | capability, tool, asset | *from* needs *to* to function |
| `owns` | person, org | asset, tool, agent | *to* is *from*'s |
| `attests` | person, org | person, org, agent, tool, asset | *from* vouches for *to* — see the rule below |
| `transacted-with` | person, org, agent | person, org, agent | a transaction occurred between them (the record is at `basis`; the amount is not here) |
| `delegates-to` | person, org, agent | agent, person, org | *from* has granted *to* some of its authority (typically a `delegation/1` grant at `basis`) |

## Refusals

`validate(doc)` returns every refusal it finds as `{ code, path, message }`; it never stops at the first. Each code has a vector under `vectors/invalid/` named for it.

| code | what is refused | why |
|---|---|---|
| `edge-no-basis` | an edge whose `basis` is missing or not an https URL | an edge with no evidence is a claim, and graph/1 does not carry claims |
| `self-attestation` | an `attests` edge whose `asserted_by` equals its `to` **or** its `from` | standing comes from what others assert. An attestation is a three-party record: the attester (`from`), the attested (`to`), and the asserter who carries it into the graph citing the attester's publication as `basis`. The attested party asserting it is the obvious fraud; the attester carrying it alone is the attester's word with nobody else having looked, which is the same thing one step removed. |
| `score-field` | a key named `score`, `rating`, `rank`, `reputation`, `amount`, `value`, `price`, `balance` or `gold` — at any depth, case-insensitively, with or without an `x-` prefix | the graph says what exists. A reputation is a consumer's computation over it; money is a separate format. A score under an extension key is still a score in the graph. |
| `dangling-reference` | an edge `from`, `to` or `asserted_by` naming an id that is neither a node nor a qualified external | a reference the document cannot resolve is a relationship to nothing |
| `duplicate-id` | a node id repeated, an edge id repeated, or an id both authored as a node and cited as an external | a machine keys on ids |
| `unknown-key` | any key not in the tables above, at the top level or on a node, edge or external, unless `x-` prefixed | the parser refuses; it does not guess what a key meant |
| `bad-kind` | a node or edge `kind` outside its closed list | the lists are closed |
| `kind-mismatch` | a node whose id prefix is not its `kind` | one id, one kind |
| `bad-endpoint` | an edge whose `from` or `to` is a node kind its row does not allow | see the table |
| `self-loop` | an edge from a node to itself | relates nothing |
| `bad-asserter` | an `asserted_by` that is not a `person/` or `org/` id | only a person or an organisation asserts |
| `bad-id`, `bad-subject`, `bad-contract`, `bad-date`, `no-source`, `no-label`, `subject-not-a-node`, `not-an-object` | shape faults | each message says which field |

## Relationship to realm/1

`realm/1` ([FlashyLabs/therealm](https://github.com/FlashyLabs/therealm), served at `https://therealm.live/.well-known/realm.json`) is the estate's registry: one manifest that lists every organisation as a **house** — `slug`, lore-name `house`, the real `org` id, `domain`, `status`, and for a live house its `surfaces.handshake` — and carries the identity/1 taxonomy (five houses, ten archetypes, from RitualOS). It answers *which organisations are in the world and where is each one's machine door*. `graph/1` answers the next question — *what does each one operate, offer, own, and who vouches for whom* — and it does not restate the first.

**A realm/1 manifest is a source of nodes.** `fromRealm(manifest)` derives a partial `graph/1` document:

| realm/1 | graph/1 |
|---|---|
| `parent.org` | one `org` node `org/<parent.org>`; `source` = the manifest URL (`/.well-known/realm.json` on the manifest's `domain`); `x-realm: { relation: "parent", domain, role }` |
| each `houses[i]` | one `org` node `org/<house.org>`; `label` = `house.house` (the lore name), falling back to the org id |
| `houses[i].surfaces.handshake`, when `status` is `live` | that node's `source` — the house's own machine door is where its existence is checked |
| a house that is not `live` | `source` = the manifest URL — the only place a stranger can check a building or incubating house exists |
| `slug`, `house`, `domain`, `status`, `role` | carried under the node's `x-realm` |
| `identity: { house, archetype }` | carried under `x-realm.identity` when the manifest curates one — identity/1's vocabulary (`flame`, `sky`, `stone`, `wind`, `tides`; the ten archetypes) travels with the org, unchanged and attributed to its source by the manifest it came from |
| the manifest itself | recorded as `x-derived-from: { contract: "realm/1", url }` |

It emits **no edges**. An index of what exists is not evidence of who relates to whom, and every edge here needs a `basis` its asserter publishes. The result carries no `subject` and no `generated` either: the publisher composing the document supplies both — and the publisher's own org must appear among the nodes (which it does when the publisher is the realm's parent or one of its houses). `fromRealm` throws on a manifest that is not `realm/1`, names no domain, a house that names no org, a live house with no https handshake, or two entries naming one org.

The estate's other machine surfaces are further sources a publisher can draw nodes and edges from, by the same discipline: an `aao/0.1` charter yields `agent/<org>-<role>` nodes and `offers` edges to each `capability/<verb>` in a role's `capabilities`, with the charter URL as `basis`; a `directory/1` fragment yields the same with its `declares` edges. Neither derivation is implemented in this version; the mapping above is.

## Querying

Version 1 defines one consumer-side filter and no query language.

> **Find agent nodes with an `offers` edge to `capability/<verb>` and, optionally, an `attests` edge from a given `person/` or `org/` node (or from any node of that kind).**

`query(doc, { capability, attestedBy? })` implements exactly that and returns the matching agent ids, sorted and unique:

- `capability` — required; `deliver` or `capability/deliver`. Only nodes of kind `agent` are returned: an org or a tool that offers the verb is not an agent.
- `attestedBy` — optional; an exact `person/<id>` or `org/<slug>`, or the bare prefix `org/` or `person/` meaning any node of that kind. The match is on the `attests` edge's `from` (the attester), never on its `asserted_by`.
- The document is validated first and an invalid one throws. A consumer never queries a graph it has not checked.
- The function is pure and does not follow any URL. Whether a `basis` actually resolves to the evidence it claims is the consumer's fetch to make; the format only guarantees the URL is there.

The CLI form is `node vendor-graph.mjs query <file> <verb> [--attested-by <id|org/|person/>]`.

Out of scope for v1: path queries, reverse queries, filtering by `at`, any query over more than one document. A consumer wanting more loads the document and walks the arrays; they are plain JSON.

## Serving

A publisher serves its own projection at `/.well-known/graph.json` — the same place its `flashyos/1` handshake and `directory/1` fragment live. The document's `subject` is the publisher, and every edge is one the publisher asserted or is carrying for a named asserter. Committed is not served: a checkout tells you what was written, a fetch tells you what is there.

## What version 1 does not carry

- **No scoring.** No trust figure, weight, rank or reputation anywhere in the document. The consumer computes standing from the edges, and its algorithm is its own.
- **No money.** No amount, price, balance or gold. A `transacted-with` edge says a transaction occurred and points at the record; the record's format is not this one.
- **No query language.** One helper, described above. Anything richer is a consumer's code over plain JSON.
- **No federation.** A document has one publisher. Merging many publishers' graphs — reconciling their `externals`, deciding whose `source` to believe when two disagree — is a consumer's job, and the rules for it are not written yet.
- **No verification of `basis`.** The checker asserts a URL is present and https; it does not fetch it. The format guarantees evidence is *cited*, not that it *holds*.
- **No derivation from `aao/0.1` or `directory/1`** — the mapping is described above; only the `realm/1` derivation is implemented.

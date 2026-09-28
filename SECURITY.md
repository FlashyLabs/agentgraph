# Security

## Reporting

Email **security@flashylabs** — *note: this address is the estate's convention
and has not been confirmed as monitored for this repository yet; until a
maintainer confirms it here, a private report to the repository's accountable
owner is the reliable path.* Do not open a public issue for a security concern.

Include the document or vector that reproduces the problem. Every example in
this repository is fictional; keep a report the same way — if the concern was
found in a real published graph, describe the shape and redact the publisher.

## What counts

`graph/1` is a data format and a dependency-free checker. The security surface
is small and specific:

- **A document that validates but should not** — a way to smuggle a score, an
  unevidenced edge, a self-attestation, or a dangling reference past
  `validate()`. This is the class that matters most: a consumer trusts a
  document because the checker passed it.
- **A document that crashes the checker** rather than being refused. The
  checker must return refusals, never throw, on any JSON input.
- **The CLI following a URL.** It never should. `basis` and `source` are
  asserted present and https; nothing here fetches.

Out of scope: whether a `basis` URL actually holds the evidence it claims.
The format guarantees the citation, not its truth — a consumer fetches.

## Secrets

There are none, and there must never be. No secret in a file, a repo or an
artifact; Secret Manager only. The lint and the tests scan for credential shapes.

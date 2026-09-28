# Contributing

`graph/1` is a draft format. Changes to it are changes to what every future
publisher and consumer must agree on, so the bar is: a rule is written in
`SPEC.md`, enforced in `vendor-graph.mjs`, and held by a test — all three, in one
change. A rule with only prose is decorative; a rule with only code is a surprise.

## Before you open a pull request

```bash
npm run lint
npm test
```

Both must pass. There is nothing to install; if you find yourself adding a
dependency, stop — this repository is `node:` builtins only, on purpose, so the
check can run anywhere Node runs.

## Changing the format

1. Open a **spec change** issue first (the template asks what the change makes
   possible, and what it makes refusable). A format change without a refusal it
   adds or removes is usually a naming change, and those are cheap to discuss.
2. Edit `SPEC.md`, `vendor-graph.mjs` and `schema/graph-1.json` together. The
   tests pin the schema's enums and the SPEC's tables to the module's closed
   lists, so a partial change fails loudly.
3. Add a vector. A new refusal gets `vectors/invalid/<code>.json`, named for
   its code; a newly valid shape gets a valid vector that exercises it.
4. Keep every example fictional — every URL under `.example`, no real person,
   no real organisation's relationships.

## What will not be accepted

- A field that carries a score, rating, rank, amount, value, price, balance or
  any other figure of standing or money. That is the format's founding refusal.
- A path that lets an `attests` edge be asserted by either of its parties.
- An edge shape without a `basis`.
- A query language. Version 1 has one helper and says so.
- A `LICENSE` file or a `license` field. The estate declares licences once, in
  the register in flashyos.

## Reporting

Bugs go through the bug template. Security concerns go to the address in
`SECURITY.md`, not to an issue.

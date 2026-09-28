---
name: Bug report
about: The checker accepted what it should refuse, refused what it should accept, or crashed.
title: ''
labels: bug
assignees: ''
---

## Which

- [ ] `validate()` accepted a document that breaks a rule in `SPEC.md`
- [ ] `validate()` refused a document the SPEC allows
- [ ] `validate()` threw instead of returning refusals
- [ ] `fromRealm()` mapped a realm/1 field wrongly, or guessed where it should have thrown
- [ ] `query()` returned the wrong agents
- [ ] the CLI exited with the wrong status
- [ ] something else

## The document

Paste the smallest `graph/1` (or `realm/1`) document that shows it. **Keep it
fictional** — every URL under `.example`, no real person, no real
organisation's relationships.

```json

```

## Expected

Which refusal code (or which valid result) the SPEC says this should produce.

## Actual

The output, verbatim. Say which command or function, and `node --version`.

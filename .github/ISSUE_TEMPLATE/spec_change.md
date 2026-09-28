---
name: Spec change
about: Propose a change to graph/1 — a field, a kind, a refusal, or the realm/1 mapping.
title: 'spec: '
labels: spec
assignees: ''
---

## The change

What is added, removed or renamed, in the words the SPEC would use.

## What it makes possible

A concrete document or query a publisher or consumer could not express before.

## What it makes refusable — or stops refusing

Every format change moves the line between valid and refused. Say where it
moves. If nothing becomes refusable and nothing stops being refused, say so;
that usually means it is a naming change.

## The founding refusals

Confirm the change does not:

- [ ] add a field carrying a score, rating, rank, reputation, amount, value, price, balance or gold
- [ ] let an `attests` edge be asserted by either of its parties
- [ ] allow an edge without an https `basis`
- [ ] add a query language

If it does any of these, the proposal is for a different format; say which.

## Vectors

Which vector(s) would change or be added — a new refusal is
`vectors/invalid/<code>.json`, named for its code.

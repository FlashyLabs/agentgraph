## What

One paragraph: what changes, and for whom (a publisher, a consumer, the checker).

## Which rule

If this touches the format: the `SPEC.md` section, the `validate()` branch and the
vector that hold the rule — all three, in this PR. A rule with prose and no
test is decorative; a rule with code and no prose is a surprise.

## Checks

- [ ] `npm run lint` passes
- [ ] `npm test` passes
- [ ] no dependency added; `node:` builtins only
- [ ] every example is fictional (URLs under `.example`, no real person or organisation)
- [ ] no score, amount or other figure of standing or money introduced anywhere
- [ ] `LICENSE` is the estate's Apache-2.0 text (holder Flashy Labs), no `license` field; the README still ends on the estate licence line
- [ ] `SPEC.md` still says `Status: draft` unless this PR is the launch

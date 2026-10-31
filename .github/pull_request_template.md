## Proposal

- Implements: <!-- [proposal.NNNN](../proposals/NNNN-slug.md) -->

## Summary

<!-- What changed and why, for someone who has not read the proposal. -->

## Verified

<!-- Only commands actually run in this work, with their observed results. -->

- `mise run check` — <result>
- `mise run test:<pkg>` / `mise run build:<pkg>` — <result, per package changed>

## Test plan

<!-- How a reviewer exercises the change: the preview link — a pkg.pr.new install or the Workers preview URL — the setup, the actions, the expected results. -->

1. <Action>
2. <Expected result>

## Phase checklist

- [ ] Proposal settled by the human (`status: awaiting-implementation`)
- [ ] Tests written first
- [ ] Guides written from the proposal
- [ ] `mise run check` passes, plus the changed packages' `test:<pkg>` and `build:<pkg>`
- [ ] Self-check against the proposal complete
- [ ] Adversarial review complete
- [ ] Preview confirmed working and linked
- [ ] Readiness report posted
- [ ] Changeset added (`mise run changeset`, `-- --empty` when nothing releasable changed)

The agent posts the readiness report as a pull-request comment; do not write it here.

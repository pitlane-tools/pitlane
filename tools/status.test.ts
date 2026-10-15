import assert from "node:assert/strict";
import test from "node:test";

import type { DerivedStatus, Facts, Proposal } from "./status.ts";

import { deriveStatus, formatStatus, selectProposal } from "./status.ts";

function facts(overrides: Partial<Facts> = {}): Facts {
    return {
        branch: "feature",
        isDefaultBranch: false,
        defaultBranch: "main",
        hasUpstream: true,
        unpushedCommits: 0,
        pullRequest: {
            number: 1,
            isDraft: true,
            state: "OPEN",
            baseRefName: "main",
            url: "https://github.com/owner/repo/pull/1",
            title: "Feature",
        },
        pullRequestState: "known",
        proposal: null,
        ...overrides,
    };
}
function proposal(
    status: string,
    clarificationCount = 0,
    overrides: Partial<Proposal> = {},
): Proposal {
    return {
        id: "proposal.0001",
        title: "Feature",
        status,
        clarificationCount,
        ...overrides,
    };
}

// Asserts the derived routing — phase, who acts, which skill. The `next` sentence is human-facing
// copy that will be reworded; pinning it here would make every wording change a test failure.
function assertPhase(
    input: Facts,
    expected: Pick<DerivedStatus, "phase" | "title" | "actor" | "skill">,
) {
    let status = deriveStatus(input);

    assert.equal(status.phase, expected.phase);
    assert.equal(status.title, expected.title);
    assert.equal(status.actor, expected.actor);
    assert.equal(status.skill, expected.skill);
    return status;
}

test("derives preparation on the default branch", () => {
    assertPhase(facts({ branch: "main", isDefaultBranch: true, pullRequest: null }), {
        phase: "1",
        title: "Preparation",
        actor: "agent",
        skill: null,
    });
});

test("derives preparation for a branch without a pull request", () => {
    assertPhase(facts({ pullRequest: null }), {
        phase: "1",
        title: "Preparation",
        actor: "agent",
        skill: null,
    });
});

test("derives proposal work for a draft pull request without a proposal", () => {
    assertPhase(facts(), {
        phase: "2",
        title: "Proposal",
        actor: "agent",
        skill: ".agents/skills/writing-a-proposal/",
    });
});

test("keeps a draft proposal in proposal work", () => {
    assertPhase(facts({ proposal: proposal("draft") }), {
        phase: "2",
        title: "Proposal",
        actor: "you",
        skill: null,
    });
});

test("derives implementation for an awaiting proposal", () => {
    assertPhase(facts({ proposal: proposal("awaiting-implementation") }), {
        phase: "3",
        title: "Implementation",
        actor: "agent",
        skill: ".agents/skills/implementing-a-proposal/",
    });
});

test("derives human review for an active-review proposal", () => {
    assertPhase(facts({ proposal: proposal("active-review") }), {
        phase: "4",
        title: "Human review",
        actor: "you",
        skill: null,
    });
});

test("derives revisions for a returned proposal", () => {
    assertPhase(facts({ proposal: proposal("returned-for-revisions") }), {
        phase: "4 → 3",
        title: "Human review → Implementation",
        actor: "agent",
        skill: ".agents/skills/implementing-a-proposal/",
    });
});

test("derives completion for an accepted proposal", () => {
    assertPhase(facts({ proposal: proposal("accepted") }), {
        phase: "5",
        title: "Completion",
        actor: "agent",
        skill: ".agents/skills/completing-a-feature/",
    });
});

test("confirms the accepted record before readying a draft PR", () => {
    let status = deriveStatus(facts({ proposal: proposal("accepted") }));

    assert.equal(status.phase, "5");
    assert.match(status.next, /record.*confirm.*pull request.*mark.*ready/i);
});

test("inspects the merged revision before reconciling a locally accepted proposal", () => {
    let input = facts({
        proposal: proposal("accepted"),
        pullRequest: { ...facts().pullRequest!, isDraft: false, state: "MERGED" },
    });
    let status = deriveStatus(input);

    assert.equal(status.phase, "5");
    assert.match(status.next, /confirm.*merged.*if absent.*reconcil/i);
    assert.doesNotMatch(status.next, /perform.*merge|record.*in this feature pull request/i);
    assert.match(formatStatus(input, status), /PR #1 \(merged\)/);
});

test("keeps a merged implementation in completion while release remains separate", () => {
    let input = facts({
        proposal: proposal("implemented"),
        pullRequest: { ...facts().pullRequest!, isDraft: false, state: "MERGED" },
    });
    let status = assertPhase(input, {
        phase: "5",
        title: "Implementation merged",
        actor: "agent",
        skill: ".agents/skills/completing-a-feature/",
    });

    assert.match(status.next, /required release|pending release/i);
    assert.match(formatStatus(input, status), /PR #1 \(merged\)/);
});

test("does not claim default-branch integration after a merge into staging", () => {
    let status = deriveStatus(
        facts({
            proposal: proposal("implemented"),
            pullRequest: {
                ...facts().pullRequest!,
                isDraft: false,
                state: "MERGED",
                baseRefName: "staging",
            },
        }),
    );

    assert.equal(status.phase, "5");
    assert.equal(status.actor, "you");
    assert.match(status.next, /staging.*main/i);
    assert.doesNotMatch(status.next, /this work is not integrated/i);
    assert.match(status.next, /check|confirm|determine/i);
    assert.match(status.next, /implemented record.*merged revision/i);
});

test("blocks an open PR targeting staging before recommending merge into main", () => {
    let status = deriveStatus(
        facts({
            proposal: proposal("implemented"),
            pullRequest: { ...facts().pullRequest!, isDraft: false, baseRefName: "staging" },
        }),
    );

    assert.equal(status.phase, "5");
    assert.equal(status.actor, "you");
    assert.match(status.next, /staging.*main/i);
});

test("does not assume a merge reached the default branch when its name is unknown", () => {
    let status = deriveStatus(
        facts({
            defaultBranch: null,
            proposal: proposal("implemented"),
            pullRequest: { ...facts().pullRequest!, isDraft: false, state: "MERGED" },
        }),
    );

    assert.equal(status.phase, "5");
    assert.match(status.next, /default branch/i);
    assert.notEqual(status.title, "Implementation merged");
});

test("derives a closed state for a rejected proposal", () => {
    assertPhase(facts({ proposal: proposal("rejected") }), {
        phase: "done",
        title: "Closed",
        actor: "you",
        skill: null,
    });
});

test("derives a closed state for a withdrawn proposal", () => {
    assertPhase(facts({ proposal: proposal("withdrawn") }), {
        phase: "done",
        title: "Closed",
        actor: "you",
        skill: null,
    });
});

test("derives a closed state with its successor for a superseded proposal", () => {
    let input = facts({
        proposal: proposal("superseded"),
        proposalSuccessor: { id: "proposal.0002", title: "Replacement" },
    });
    let status = assertPhase(input, {
        phase: "done",
        title: "Closed",
        actor: "you",
        skill: null,
    });

    assert.match(formatStatus(input, status), /proposal\.0002/);
});

test("routes an implemented draft PR to completion instead of treating it as inconsistent", () => {
    let status = assertPhase(facts({ proposal: proposal("implemented") }), {
        phase: "5",
        title: "Completion",
        actor: "agent",
        skill: ".agents/skills/completing-a-feature/",
    });

    assert.deepEqual(status.notices, []);
    assert.match(status.next, /confirm.*implemented record.*pull request.*mark.*ready/i);
});

test("requires record verification before merging an implemented open PR", () => {
    let status = deriveStatus(
        facts({
            proposal: proposal("implemented"),
            pullRequest: { ...facts().pullRequest!, isDraft: false },
        }),
    );

    assert.equal(status.phase, "5");
    assert.match(status.next, /confirm.*implemented record.*pull request.*before.*merge/i);
});

for (let proposalStatus of ["accepted", "implemented"]) {
    test(`stops for a human decision when a ${proposalStatus} PR closes without merging`, () => {
        let input = facts({
            proposal: proposal(proposalStatus),
            pullRequest: { ...facts().pullRequest!, isDraft: false, state: "CLOSED" },
        });
        let status = deriveStatus(input);

        assert.equal(status.phase, "5");
        assert.equal(status.actor, "you");
        assert.match(status.next, /reopen|withdraw/);
        assert.match(formatStatus(input, status), /PR #1 \(closed\)/);
    });
}

test("flags a draft pull request when the proposal is in active review", () => {
    let status = deriveStatus(facts({ proposal: proposal("active-review") }));

    assert.deepEqual(status.notices, [{ kind: "draft-active-review" }]);
});

test("surfaces a heuristic proposal selection and its other candidates", () => {
    let input = facts({
        proposal: proposal("draft"),
        proposalSelection: {
            otherCandidates: [{ id: "proposal.0002", title: "Other feature" }],
        },
    });
    let status = deriveStatus(input);

    assert.deepEqual(status.notices, [
        {
            kind: "ambiguous-proposal-selection",
            selected: "proposal.0001",
            otherCandidates: [{ id: "proposal.0002", title: "Other feature" }],
        },
    ]);
    assert.match(formatStatus(input, status), /proposal\.0002/);
});

const CURRENT_PULL_REQUEST = {
    number: 29,
    isDraft: true,
    state: "OPEN" as const,
    baseRefName: "main",
    url: "https://github.com/owner/repo/pull/29",
    title: "Changesets",
};

test("never selects another pull request's proposal for a known pull request", () => {
    let elsewhere = proposal("draft", 0, {
        id: "proposal.0003",
        pullRequest: "https://github.com/owner/repo/pull/17",
    });
    let sameNumberElsewhere = proposal("draft", 0, {
        id: "proposal.0004",
        pullRequest: "https://github.com/other/repo/pull/29",
    });
    let selection = selectProposal([elsewhere, sameNumberElsewhere], CURRENT_PULL_REQUEST);

    assert.equal(selection.proposal, null);
    assert.deepEqual(selection.otherCandidates, []);
});

test("matches a proposal linked by this pull request's own URL", () => {
    let linked = proposal("draft", 0, { pullRequest: `${CURRENT_PULL_REQUEST.url}/` });

    assert.equal(selectProposal([linked], CURRENT_PULL_REQUEST).proposal, linked);
});

test("prefers the proposal linked to the pull request over newer unlinked drafts", () => {
    let linked = proposal("awaiting-implementation", 0, { id: "proposal.0002", pullRequest: "29" });
    let unlinked = proposal("draft", 0, { id: "proposal.0005", pullRequest: "" });
    let selection = selectProposal([unlinked, linked], CURRENT_PULL_REQUEST);

    assert.equal(selection.proposal, linked);
    assert.deepEqual(selection.otherCandidates, []);
});

test("falls back to an unlinked in-flight proposal, naming the others it passed over", () => {
    let elsewhere = proposal("draft", 0, { id: "proposal.0006", pullRequest: "17" });
    let newest = proposal("draft", 0, { id: "proposal.0005" });
    let older = proposal("active-review", 0, { id: "proposal.0004" });
    let selection = selectProposal([older, elsewhere, newest], CURRENT_PULL_REQUEST);

    assert.equal(selection.proposal, newest);
    assert.deepEqual(selection.otherCandidates, [older]);
});

test("surfaces unresolved clarification markers and unpushed commits", () => {
    let status = deriveStatus(facts({ proposal: proposal("draft", 2), unpushedCommits: 3 }));

    assert.deepEqual(status.notices, [
        { kind: "clarifications", count: 2 },
        { kind: "unpushed-commits", count: 3 },
    ]);
});

test("reports an unavailable pull request state instead of assuming no pull request", () => {
    let status = assertPhase(
        facts({
            pullRequest: null,
            pullRequestState: "unknown",
            pullRequestReason: "gh is unavailable",
        }),
        {
            phase: "1",
            title: "Preparation",
            actor: "agent",
            skill: null,
        },
    );

    assert.equal(status.reason, "gh is unavailable");
});

test("reports an unknown branch role instead of recommending a pull request", () => {
    assertPhase(facts({ pullRequest: null, isDefaultBranch: null }), {
        phase: "unknown",
        title: "Branch role unknown",
        actor: "agent",
        skill: null,
    });
});

test("reserves unknown routing for an invalid proposal status", () => {
    assertPhase(facts({ proposal: proposal("invalid") }), {
        phase: "2",
        title: "Proposal",
        actor: "you",
        skill: null,
    });
});

import assert from "node:assert/strict";
import test from "node:test";

import { deriveStatus, formatStatus } from "./status.mjs";

function facts(overrides = {}) {
    return {
        branch: "feature",
        isDefaultBranch: false,
        hasUpstream: true,
        unpushedCommits: 0,
        pullRequest: {
            number: 1,
            isDraft: true,
            url: "https://github.com/owner/repo/pull/1",
            title: "Feature",
            isMerged: false,
        },
        pullRequestState: "known",
        proposal: null,
        ...overrides,
    };
}
function proposal(status, clarificationCount = 0, overrides = {}) {
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
function assertPhase(input, expected) {
    let status = deriveStatus(input);

    assert.equal(status.phase, expected.phase);
    assert.equal(status.title, expected.title);
    assert.equal(status.actor, expected.actor);
    assert.equal(status.skill, expected.skill);
    assert.ok(status.next.length > 0, "every phase must say what happens next");
    assert.ok(status.situation.length > 0, "every phase must describe the situation");
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

test("derives done for an implemented merged pull request", () => {
    assertPhase(facts({ proposal: proposal("implemented"), pullRequest: { isMerged: true } }), {
        phase: "done",
        title: "Done",
        actor: "you",
        skill: null,
    });
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

test("names an implemented proposal with an unmerged pull request as inconsistent", () => {
    let status = assertPhase(facts({ proposal: proposal("implemented") }), {
        phase: "3 → 4",
        title: "Inconsistent record",
        actor: "you",
        skill: null,
    });

    assert.deepEqual(status.notices, [{ kind: "implemented-unmerged" }]);
});

test("flags a draft pull request when the proposal is in active review", () => {
    let status = deriveStatus(facts({ proposal: proposal("active-review") }));

    assert.deepEqual(status.notices, [{ kind: "draft-active-review" }]);
});

test("surfaces a heuristic proposal selection and its other candidates", () => {
    let input = facts({
        proposal: proposal("draft", 0, { pullRequest: "2" }),
        proposalSelection: {
            otherCandidates: [{ id: "proposal.0002", title: "Other feature" }],
            pullRequestMismatch: true,
        },
    });
    let status = deriveStatus(input);

    assert.deepEqual(status.notices, [
        {
            kind: "ambiguous-proposal-selection",
            selected: "proposal.0001",
            otherCandidates: [{ id: "proposal.0002", title: "Other feature" }],
            pullRequestMismatch: true,
            proposalPullRequest: "2",
            pullRequestNumber: 1,
        },
    ]);
    assert.match(formatStatus(input, status), /proposal\.0002/);
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

test("reports an unauthenticated pull request state", () => {
    let status = assertPhase(
        facts({
            pullRequest: null,
            pullRequestState: "unknown",
            pullRequestReason: "gh is not authenticated",
        }),
        {
            phase: "1",
            title: "Preparation",
            actor: "agent",
            skill: null,
        },
    );

    assert.equal(status.reason, "gh is not authenticated");
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

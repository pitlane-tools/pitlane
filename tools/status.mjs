import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { parseFrontmatter, withoutCode } from "./validate.mjs";

const NON_TERMINAL_STATUSES = new Set([
    "draft",
    "awaiting-implementation",
    "active-review",
    "returned-for-revisions",
    "accepted",
]);
const CONVENTIONAL_DEFAULT_BRANCHES = new Set(["main", "master"]);
const SKILLS = {
    proposal: ".agents/skills/writing-a-proposal/",
    implementation: ".agents/skills/implementing-a-proposal/",
    completion: ".agents/skills/completing-a-feature/",
};

function step(phase, title, situation, next, actor, skill = null) {
    return { phase, title, situation, next, actor, skill };
}

const STEPS = {
    defaultBranch: step(
        "1",
        "Preparation",
        "You are on the default branch.",
        "If considering a proposal, ask the human whether they want a proposal for this change before creating a branch or draft pull request; otherwise branch for the agreed work, or commit here when commit-discipline allows it.",
        "agent",
    ),
    noPullRequest: step(
        "1",
        "Preparation",
        "This branch has no pull request.",
        "If considering a proposal, ask the human whether they want a proposal for this change before pushing the branch or opening a draft pull request; otherwise push and open the draft pull request for the agreed work.",
        "agent",
    ),
    noProposal: step(
        "2",
        "Proposal",
        "The pull request has no proposal.",
        "Ask the human whether they want a proposal for this change before writing one, unless they already answered for this change. If they declined, proceed from the agreed request and pull-request scope.",
        "agent",
        SKILLS.proposal,
    ),
    draft: step(
        "2",
        "Proposal",
        "The proposal is published and being iterated on.",
        "Edit the proposal directly, or tell the agent what to change. Move it to awaiting-implementation when you are satisfied.",
        "you",
    ),
    "awaiting-implementation": step(
        "3",
        "Implementation",
        "The proposal is approved for implementation.",
        "Write failing tests, then guides, then code and gates. Run the excellence pass and inline reviews, then cross-artifact and adversarial review, post the readiness report, and mark the pull request ready.",
        "agent",
        SKILLS.implementation,
    ),
    "active-review": step(
        "4",
        "Human review",
        "A first full pass at tests, guides, and code is up for review.",
        "Review the diff and the preview. Comment on the pull request, or accept the work.",
        "you",
    ),
    "returned-for-revisions": step(
        "4 → 3",
        "Human review → Implementation",
        "The human returned the pull request for revisions.",
        "Process the feedback; update the proposal first if the design changed.",
        "agent",
        SKILLS.implementation,
    ),
    accepted: step(
        "5",
        "Completion",
        "The feature has been accepted and awaits completion.",
        "Complete any remaining vision update and merge. Prepare versions only on request; publishing and branch deletion need explicit permission.",
        "agent",
        SKILLS.completion,
    ),
    rejected: step(
        "done",
        "Closed",
        "The work is closed: the proposal was rejected.",
        "Nothing outstanding.",
        "you",
    ),
    withdrawn: step(
        "done",
        "Closed",
        "The work is closed: the proposal was withdrawn.",
        "Nothing outstanding.",
        "you",
    ),
    superseded: step(
        "done",
        "Closed",
        "The work is closed: the proposal was superseded.",
        "Nothing outstanding.",
        "you",
    ),
    implementedUnmerged: step(
        "3 → 4",
        "Inconsistent record",
        "The proposal is marked implemented, but its pull request is not merged.",
        "Resolve the record inconsistency before continuing.",
        "you",
    ),
    done: step(
        "done",
        "Done",
        "The merged proposal is recorded as implemented.",
        "Nothing outstanding. Start the next feature when ready.",
        "you",
    ),
    unknown: step(
        "2",
        "Proposal",
        "The proposal status is not recognized.",
        "Update the proposal status in the pull request.",
        "you",
    ),
};

function unknownPullRequestStep(reason) {
    return {
        ...step(
            "1",
            "Preparation",
            `The pull request state is unknown because ${reason}.`,
            "Restore access to gh, then check the pull request state.",
            "agent",
        ),
        reason,
    };
}

function unknownBranchRoleStep() {
    return step(
        "unknown",
        "Branch role unknown",
        "The default branch cannot be determined, so this branch's role is unknown.",
        "Determine the default branch before taking pull request actions.",
        "agent",
    );
}

function supersededStep(successor) {
    if (!successor) return STEPS.superseded;
    return step(
        "done",
        "Closed",
        `The work is closed. Its successor is ${successor.id} — ${successor.title}.`,
        "Nothing outstanding. Continue with the successor if further work is needed.",
        "you",
    );
}

function defaultBranchFacts(branch, defaultReference, ghDefaultBranch) {
    let defaultBranch =
        defaultReference?.split("/").at(-1) ??
        ghDefaultBranch ??
        (CONVENTIONAL_DEFAULT_BRANCHES.has(branch) ? branch : null);
    return {
        defaultReference: defaultReference ?? (defaultBranch && `origin/${defaultBranch}`),
        isDefaultBranch: defaultBranch ? branch === defaultBranch : null,
    };
}

function commandOutput(command, arguments_, root) {
    try {
        return execFileSync(command, arguments_, {
            cwd: root,
            encoding: "utf8",
            stdio: ["ignore", "pipe", "ignore"],
        }).trim();
    } catch {
        return null;
    }
}

function commandSucceeds(command, arguments_, root) {
    try {
        execFileSync(command, arguments_, { cwd: root, stdio: "ignore" });
        return true;
    } catch {
        return false;
    }
}

function collectBranch(root) {
    let branch = commandOutput("git", ["rev-parse", "--abbrev-ref", "HEAD"], root);
    let defaultReference = commandOutput("git", ["symbolic-ref", "refs/remotes/origin/HEAD"], root);
    let ghDefaultBranch = defaultReference
        ? null
        : commandOutput(
              "gh",
              ["repo", "view", "--json", "defaultBranchRef", "--jq", ".defaultBranchRef.name"],
              root,
          );
    return {
        branch,
        ...defaultBranchFacts(branch, defaultReference, ghDefaultBranch),
    };
}

function collectUpstream(root) {
    let upstream = commandOutput(
        "git",
        ["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{upstream}"],
        root,
    );
    let count =
        upstream && commandOutput("git", ["rev-list", "--count", "@{upstream}..HEAD"], root);
    return {
        hasUpstream: upstream !== null,
        unpushedCommits: Number.isSafeInteger(Number(count)) ? Number(count) : 0,
    };
}

function collectPullRequest(root) {
    if (commandOutput("gh", ["--version"], root) === null) {
        return { pullRequest: null, state: "unknown", reason: "gh is unavailable" };
    }
    if (!commandSucceeds("gh", ["auth", "status"], root)) {
        return { pullRequest: null, state: "unknown", reason: "gh is not authenticated" };
    }
    let source = commandOutput("gh", ["pr", "view", "--json", "number,isDraft,url,title"], root);
    if (source === null) return { pullRequest: null, state: "known", reason: null };
    try {
        let pullRequest = JSON.parse(source);
        return Number.isInteger(pullRequest.number)
            ? { pullRequest, state: "known", reason: null }
            : {
                  pullRequest: null,
                  state: "unknown",
                  reason: "gh returned invalid pull request data",
              };
    } catch {
        return {
            pullRequest: null,
            state: "unknown",
            reason: "gh returned invalid pull request data",
        };
    }
}

function countClarifications(content) {
    return (withoutCode(content).match(/\[NEEDS CLARIFICATION:/g) ?? []).length;
}

function readProposal(root, name) {
    try {
        let source = readFileSync(path.join(root, "proposals", name), "utf8");
        let { frontmatter } = parseFrontmatter(source);
        if (!frontmatter) return null;
        return {
            id: frontmatter.id,
            title: frontmatter.title,
            status: frontmatter.status,
            pullRequest: frontmatter["pull-request"],
            supersedes: frontmatter.supersedes,
            clarificationCount: countClarifications(source),
        };
    } catch {
        return null;
    }
}

function collectProposals(root) {
    try {
        return readdirSync(path.join(root, "proposals"), { withFileTypes: true })
            .filter(
                entry => entry.isFile() && entry.name.endsWith(".md") && entry.name !== "README.md",
            )
            .map(entry => readProposal(root, entry.name))
            .filter(Boolean);
    } catch {
        return [];
    }
}

function proposalNumber(proposal) {
    return Number(proposal.id?.match(/(\d+)$/)?.[1] ?? -1);
}

function matchesPullRequest(proposal, pullRequest) {
    let number = String(pullRequest?.number);
    return (
        pullRequest &&
        (proposal.pullRequest === number || proposal.pullRequest?.endsWith(`/pull/${number}`))
    );
}

function selectProposal(proposals, pullRequest) {
    let ordered = [...proposals].sort(
        (left, right) => proposalNumber(right) - proposalNumber(left),
    );
    let matched =
        pullRequest && ordered.find(proposal => matchesPullRequest(proposal, pullRequest));
    let nonTerminal = ordered.filter(({ status }) => NON_TERMINAL_STATUSES.has(status));
    let proposal = matched ?? nonTerminal[0] ?? null;
    let otherCandidates = matched ? [] : nonTerminal.filter(candidate => candidate !== proposal);
    return {
        proposal,
        otherCandidates,
        pullRequestMismatch: Boolean(
            proposal &&
            pullRequest &&
            proposal.pullRequest &&
            !matchesPullRequest(proposal, pullRequest),
        ),
    };
}

function successorFor(proposals, proposal) {
    return [...proposals]
        .sort((left, right) => proposalNumber(right) - proposalNumber(left))
        .find(({ supersedes }) => supersedes?.includes(proposal.id));
}

function isMergedIntoDefault(root, defaultReference) {
    return (
        defaultReference &&
        commandSucceeds(
            "git",
            [
                "merge-base",
                "--is-ancestor",
                "HEAD",
                defaultReference.replace(/^refs\/remotes\//, ""),
            ],
            root,
        )
    );
}

export function gatherFacts(root = process.cwd()) {
    let branch = collectBranch(root);
    let upstream = collectUpstream(root);
    let pullRequestFacts = collectPullRequest(root);
    let proposals = collectProposals(root);
    let selection = selectProposal(proposals, pullRequestFacts.pullRequest);
    let proposalSuccessor =
        selection.proposal?.status === "superseded"
            ? successorFor(proposals, selection.proposal)
            : null;
    return {
        branch: branch.branch,
        isDefaultBranch: branch.isDefaultBranch,
        hasUpstream: upstream.hasUpstream,
        unpushedCommits: upstream.unpushedCommits,
        pullRequest: pullRequestFacts.pullRequest && {
            ...pullRequestFacts.pullRequest,
            isMerged: isMergedIntoDefault(root, branch.defaultReference),
        },
        pullRequestState: pullRequestFacts.state,
        pullRequestReason: pullRequestFacts.reason,
        proposal: selection.proposal,
        proposalSuccessor,
        proposalSelection: {
            otherCandidates: selection.otherCandidates.map(({ id, title }) => ({ id, title })),
            pullRequestMismatch: selection.pullRequestMismatch,
        },
    };
}

function noticesFor(facts) {
    let notices = [];
    if (facts.proposal?.clarificationCount > 0)
        notices.push({ kind: "clarifications", count: facts.proposal.clarificationCount });
    if (facts.unpushedCommits > 0)
        notices.push({ kind: "unpushed-commits", count: facts.unpushedCommits });
    if (facts.proposal?.status === "active-review" && facts.pullRequest?.isDraft)
        notices.push({ kind: "draft-active-review" });
    if (facts.proposal?.status === "implemented" && facts.pullRequest?.isMerged === false)
        notices.push({ kind: "implemented-unmerged" });
    if (
        facts.proposal &&
        (facts.proposalSelection?.otherCandidates?.length > 0 ||
            facts.proposalSelection?.pullRequestMismatch)
    ) {
        notices.push({
            kind: "ambiguous-proposal-selection",
            selected: facts.proposal.id,
            otherCandidates: facts.proposalSelection.otherCandidates,
            pullRequestMismatch: facts.proposalSelection.pullRequestMismatch,
            proposalPullRequest: facts.proposal.pullRequest,
            pullRequestNumber: facts.pullRequest?.number,
        });
    }
    return notices;
}

function result(facts, status) {
    return { ...status, notices: noticesFor(facts) };
}

export function deriveStatus(facts) {
    if (facts.isDefaultBranch) return result(facts, STEPS.defaultBranch);
    if (facts.isDefaultBranch === null) return result(facts, unknownBranchRoleStep());
    if (facts.pullRequestState === "unknown") {
        return result(
            facts,
            unknownPullRequestStep(facts.pullRequestReason ?? "gh could not determine it"),
        );
    }
    if (!facts.pullRequest) return result(facts, STEPS.noPullRequest);
    if (!facts.proposal) return result(facts, STEPS.noProposal);
    if (facts.proposal.status === "implemented")
        return result(facts, facts.pullRequest.isMerged ? STEPS.done : STEPS.implementedUnmerged);
    if (facts.proposal.status === "superseded")
        return result(facts, supersededStep(facts.proposalSuccessor));
    return result(facts, STEPS[facts.proposal.status] ?? STEPS.unknown);
}

function noticeLine(notice) {
    if (notice.kind === "clarifications") return `Clarifications: ${notice.count} unresolved`;
    if (notice.kind === "unpushed-commits") return `Unpushed commits: ${notice.count}`;
    if (notice.kind === "draft-active-review")
        return "Warning: proposal is active-review, but the pull request remains draft.";
    if (notice.kind === "implemented-unmerged")
        return "Warning: proposal is implemented, but the pull request is not merged.";
    let candidates = notice.otherCandidates.map(({ id, title }) => `${id} (${title})`).join(", ");
    if (notice.pullRequestMismatch) {
        let mismatch = `selected ${notice.selected} references ${notice.proposalPullRequest}, not current PR #${notice.pullRequestNumber}`;
        return candidates
            ? `Warning: ${mismatch}. Other candidates: ${candidates}.`
            : `Warning: ${mismatch}.`;
    }
    return `Warning: heuristic selected ${notice.selected}. Other candidates: ${candidates}.`;
}

export function formatStatus(facts, derived = deriveStatus(facts)) {
    let proposal = facts.proposal
        ? `${facts.proposal.id}  ${facts.proposal.title}  ·  ${facts.proposal.status}`
        : "proposal — none";
    let pullRequest = facts.pullRequest
        ? `PR #${facts.pullRequest.number} (${facts.pullRequest.isDraft ? "draft" : "open"})  ${facts.pullRequest.url}`
        : facts.pullRequestState === "unknown"
          ? `PR — unknown (${facts.pullRequestReason ?? "gh could not determine the pull request"})`
          : "PR — none";
    return [
        proposal,
        pullRequest,
        `branch ${facts.branch ?? "unavailable"}`,
        "",
        `Phase ${derived.phase} — ${derived.title}`,
        `  ${derived.situation}`,
        "",
        `Next (${derived.actor}): ${derived.next}`,
        ...(derived.skill ? [`              Skill: ${derived.skill}`] : []),
        ...derived.notices.map(noticeLine),
    ].join("\n");
}

function main() {
    let facts = gatherFacts();
    let derived = deriveStatus(facts);
    console.log(
        process.argv.includes("--json") ? JSON.stringify(derived) : formatStatus(facts, derived),
    );
}

if (import.meta.main) main();

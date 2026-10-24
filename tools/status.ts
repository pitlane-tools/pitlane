import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { parseFrontmatter, withoutCode } from "./validate.ts";

type Actor = "agent" | "you";

interface Step {
    phase: string;
    title: string;
    situation: string;
    next: string;
    actor: Actor;
    skill: string | null;
    reason?: string;
}

// The proposal records acceptance before merge; GitHub records integration.
interface PullRequest {
    number: number;
    isDraft: boolean;
    state: PullRequestState;
    baseRefName: string;
    url: string;
    title: string;
}

// A branch name identifies neither the head repository nor the revision behind a
// pull request, so a candidate carries both until it is matched to this checkout.
interface CandidatePullRequest extends PullRequest {
    headRefOid: string;
    headRepository: string;
}

type PullRequestState = "OPEN" | "MERGED" | "CLOSED";

interface PullRequestFacts {
    pullRequest: PullRequest | null;
    state: "known" | "unknown";
    reason: string | null;
    // Commits this branch added after a merged or closed pull request's final revision.
    commitsAfter?: number;
}

interface Repository {
    nameWithOwner: string | null;
    defaultBranch: string | null;
}

export interface Proposal {
    id?: string;
    title?: string;
    status?: string;
    pullRequest?: string;
    supersedes?: string[];
    clarificationCount: number;
}

interface ProposalSummary {
    id?: string;
    title?: string;
}

interface ProposalSelection {
    otherCandidates: ProposalSummary[];
}

export interface Facts {
    branch: string | null;
    isDefaultBranch: boolean | null;
    // GitHub's own default branch, or null when gh could not report it. A cached
    // origin/HEAD may name a former default, so it never settles a merge target.
    defaultBranch: string | null;
    hasUpstream: boolean;
    unpushedCommits: number;
    pullRequest: PullRequest | null;
    pullRequestState: PullRequestFacts["state"];
    pullRequestReason?: string | null;
    commitsAfterPullRequest?: number;
    proposal: Proposal | null;
    proposalSuccessor?: ProposalSummary | null;
    proposalSelection?: ProposalSelection;
}

type Notice =
    | { kind: "clarifications"; count: number }
    | { kind: "unpushed-commits"; count: number }
    | { kind: "draft-active-review" }
    | { kind: "commits-after-pull-request"; count: number; state: string }
    | {
          kind: "ambiguous-proposal-selection";
          selected: string | undefined;
          otherCandidates: ProposalSummary[];
      };

export type DerivedStatus = Step & { notices: Notice[] };

const NON_TERMINAL_STATUSES: ReadonlySet<string | undefined> = new Set([
    "draft",
    "awaiting-implementation",
    "active-review",
    "returned-for-revisions",
    "accepted",
]);
const CONVENTIONAL_DEFAULT_BRANCHES: ReadonlySet<string | null> = new Set(["main", "master"]);
const SKILLS = {
    proposal: ".agents/skills/writing-a-proposal/",
    implementation: ".agents/skills/implementing-a-proposal/",
    completion: ".agents/skills/completing-a-feature/",
};

function step(
    phase: string,
    title: string,
    situation: string,
    next: string,
    actor: Actor,
    skill: string | null = null,
): Step {
    return { phase, title, situation, next, actor, skill };
}

const STEPS: Record<string, Step> = {
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
    acceptedDraft: step(
        "5",
        "Completion",
        "The human accepted the work, and the pull request is still a draft.",
        "Record the implemented status in this feature pull request before merge: confirm the revision pushed to the pull request carries it, then mark the pull request ready and merge after fresh checks.",
        "agent",
        SKILLS.completion,
    ),
    acceptedReady: step(
        "5",
        "Completion",
        "The human accepted the work, and the pull request is open for merge.",
        "Record the implemented status in this feature pull request before merge: confirm the revision pushed to the pull request carries it, then merge after fresh checks.",
        "agent",
        SKILLS.completion,
    ),
    implementedDraft: step(
        "5",
        "Completion",
        "The accepted implementation is recorded, and the pull request is still a draft.",
        "Confirm the implemented record reached the pull request revision rather than only the local checkout, then mark the pull request ready and merge after fresh checks.",
        "agent",
        SKILLS.completion,
    ),
    implementedReady: step(
        "5",
        "Completion",
        "The accepted implementation is recorded, and the pull request is open for merge.",
        "Confirm the implemented record reached the pull request revision before you merge; any required release stays separate and separately authorized.",
        "agent",
        SKILLS.completion,
    ),
    acceptedMerged: step(
        "5",
        "Merged ahead of the record",
        "The pull request is merged, but the proposal in this checkout still reads accepted.",
        "Confirm whether the merged revision already records the implemented status; if absent, ask the human how to reconcile it, and never amend the merged pull request or open a status-only pull request.",
        "agent",
        SKILLS.completion,
    ),
    implementedAfterMerge: step(
        "5",
        "Merged ahead of the record",
        "The pull request merged without commits this checkout made afterward, so the implemented status it reads may be absent from the merged revision.",
        "Confirm whether the merged revision already records the implemented status; if absent, ask the human how to reconcile it, and never amend the merged pull request or open a status-only pull request.",
        "agent",
        SKILLS.completion,
    ),
    implementedMerged: step(
        "5",
        "Implementation merged",
        "The feature pull request merged into the default branch while this checkout reads implemented.",
        "Confirm the implemented record is in the merged revision; if absent, ask the human how to reconcile it without a status-only pull request. Keep any required release and its changeset notes pending until the human asks for one and authorizes publishing; cleanup and branch deletion need the same explicit confirmation.",
        "agent",
        SKILLS.completion,
    ),
    mergeTargetUnknown: step(
        "5",
        "Merge target unverified",
        "The pull request is merged, but this repository's default branch is unknown, so the merge does not establish integration.",
        "Determine the default branch, then confirm the pull request merged into it before treating the work as integrated.",
        "agent",
    ),
    openTargetUnknown: step(
        "5",
        "Merge target unverified",
        "The pull request is open, but this repository's default branch is unknown, so where merging it would land is unverified.",
        "Determine the default branch and confirm the pull request targets it before recommending a merge.",
        "agent",
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
    unknown: step(
        "2",
        "Proposal",
        "The proposal status is not recognized.",
        "Update the proposal status in the pull request.",
        "you",
    ),
};

function unknownPullRequestStep(reason: string): Step {
    return {
        ...step(
            "1",
            "Preparation",
            `The pull request state is unknown: ${reason}.`,
            "Determine this branch's pull request, restoring gh access when that is what failed, before acting on it.",
            "agent",
        ),
        reason,
    };
}

function unknownBranchRoleStep(): Step {
    return step(
        "unknown",
        "Branch role unknown",
        "The default branch cannot be determined, so this branch's role is unknown.",
        "Determine the default branch before taking pull request actions.",
        "agent",
    );
}

function supersededStep(successor: ProposalSummary | null | undefined): Step {
    if (!successor) return STEPS.superseded;
    return step(
        "done",
        "Closed",
        `The work is closed. Its successor is ${successor.id} — ${successor.title}.`,
        "Nothing outstanding. Continue with the successor if further work is needed.",
        "you",
    );
}

// A recorded implementation may still be in a draft or unmerged pull request, and a
// merged one may lack a record this checkout committed after the merge.
function completionStep(
    pullRequest: PullRequest,
    defaultBranch: string | null,
    proposalStatus: "accepted" | "implemented",
    commitsAfter: number,
): Step {
    let { state, baseRefName, isDraft } = pullRequest;
    if (state === "CLOSED") {
        return step(
            "5",
            "Closed without merging",
            `The pull request is closed without merging, so the ${proposalStatus} work never landed.`,
            "Ask the human whether to reopen the pull request and finish it, or withdraw the work and record that outcome.",
            "you",
        );
    }
    if (state === "MERGED") {
        if (!defaultBranch) return STEPS.mergeTargetUnknown;
        if (baseRefName === defaultBranch) {
            if (proposalStatus === "accepted") return STEPS.acceptedMerged;
            return commitsAfter > 0 ? STEPS.implementedAfterMerge : STEPS.implementedMerged;
        }
        return step(
            "5",
            "Merged into another branch",
            `The pull request merged into ${baseRefName}, not the default branch ${defaultBranch}.`,
            `Confirm whether ${baseRefName} has reached ${defaultBranch}; if not, agree with the human how it will. Confirm the implemented record is in the merged revision before delivery; if absent, ask the human how to reconcile it without a status-only pull request. The pull request's original target alone does not establish integration.`,
            "you",
        );
    }
    if (!defaultBranch) return STEPS.openTargetUnknown;
    if (baseRefName !== defaultBranch) {
        return step(
            "5",
            "Targets another branch",
            `The pull request targets ${baseRefName}, not the default branch ${defaultBranch}.`,
            `Reconcile the target with the human before any merge: retarget the pull request to ${defaultBranch}, or agree how ${baseRefName} reaches ${defaultBranch}.`,
            "you",
        );
    }
    if (proposalStatus === "accepted") return isDraft ? STEPS.acceptedDraft : STEPS.acceptedReady;
    return isDraft ? STEPS.implementedDraft : STEPS.implementedReady;
}

function commandOutput(command: string, arguments_: string[], root: string): string | null {
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

function commandSucceeds(command: string, arguments_: string[], root: string): boolean {
    try {
        execFileSync(command, arguments_, { cwd: root, stdio: "ignore" });
        return true;
    } catch {
        return false;
    }
}

// The host answers what the clone cannot: which repository this checkout belongs to,
// and which branch is default right now. Both stay null when gh cannot report them.
function collectRepository(root: string): Repository {
    let unidentified: Repository = { nameWithOwner: null, defaultBranch: null };
    let source = commandOutput(
        "gh",
        ["repo", "view", "--json", "defaultBranchRef,nameWithOwner"],
        root,
    );
    if (source === null) return unidentified;
    let record: unknown;
    try {
        record = JSON.parse(source);
    } catch {
        return unidentified;
    }
    let { defaultBranchRef, nameWithOwner } = (record ?? {}) as Record<string, unknown>;
    let name = (defaultBranchRef as { name?: unknown } | null)?.name;
    return {
        nameWithOwner: typeof nameWithOwner === "string" && nameWithOwner ? nameWithOwner : null,
        defaultBranch: typeof name === "string" && name ? name : null,
    };
}

function collectBranch(root: string, repository: Repository) {
    let branch = commandOutput("git", ["rev-parse", "--abbrev-ref", "HEAD"], root);
    let cached = commandOutput("git", ["symbolic-ref", "refs/remotes/origin/HEAD"], root);
    // origin/HEAD and a conventional name classify this branch when gh cannot answer:
    // enough to recognize preparation, never enough to settle where a merge landed.
    let role =
        repository.defaultBranch ||
        cached?.replace(/^refs\/remotes\/[^/]+\//, "") ||
        (CONVENTIONAL_DEFAULT_BRANCHES.has(branch) ? branch : null);
    return {
        branch,
        defaultBranch: repository.defaultBranch,
        isDefaultBranch: role ? branch === role : null,
    };
}

function collectUpstream(root: string) {
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

function unknownPullRequest(reason: string): PullRequestFacts {
    return { pullRequest: null, state: "unknown", reason };
}

function parsePullRequest(entry: unknown): CandidatePullRequest | null {
    let { number, isDraft, state, baseRefName, url, title, headRefOid, headRepository } = (entry ??
        {}) as Record<keyof CandidatePullRequest, unknown>;
    if (typeof number !== "number" || !Number.isInteger(number)) return null;
    if (typeof isDraft !== "boolean") return null;
    if (typeof url !== "string" || url === "" || typeof title !== "string" || title === "")
        return null;
    if (typeof state !== "string" || typeof baseRefName !== "string" || baseRefName === "")
        return null;
    if (state !== "OPEN" && state !== "MERGED" && state !== "CLOSED") return null;
    if (typeof headRefOid !== "string" || headRefOid === "") return null;
    let nameWithOwner = (headRepository as { nameWithOwner?: unknown } | null)?.nameWithOwner;
    if (typeof nameWithOwner !== "string" || nameWithOwner === "") return null;
    return {
        number,
        isDraft,
        state,
        baseRefName,
        url,
        title,
        headRefOid,
        headRepository: nameWithOwner,
    };
}

/**
 * Matches the single pull request listed for this branch name against this
 * checkout, because gh matches `--head` by name alone, which a fork or a later
 * reuse of the name satisfies too. Without this checkout's own repository there
 * is nothing to match against. An open pull request may sit off this revision,
 * since local commits need not be pushed yet; a merged or closed one must be
 * this revision or one this branch continues.
 */
function identifyPullRequest(
    root: string,
    candidate: CandidatePullRequest,
    branch: string,
    repository: Repository,
): PullRequestFacts {
    let { headRefOid, headRepository, ...pullRequest } = candidate;
    if (!repository.nameWithOwner) {
        return unknownPullRequest(
            `this checkout's repository is unknown, so the pull request for branch ${branch} cannot be attributed to it`,
        );
    }
    if (headRepository !== repository.nameWithOwner) {
        return unknownPullRequest(
            `the pull request for branch ${branch} belongs to ${headRepository}, not ${repository.nameWithOwner}`,
        );
    }
    if (pullRequest.state === "OPEN") return { pullRequest, state: "known", reason: null };
    let head = commandOutput("git", ["rev-parse", "HEAD"], root);
    let state = pullRequest.state.toLowerCase();
    if (head === null) {
        return unknownPullRequest(
            `this checkout's revision is unknown, so the ${state} pull request for branch ${branch} cannot be matched to it`,
        );
    }
    if (head === headRefOid) return { pullRequest, state: "known", reason: null };
    let commitsAfter = commitsContinuing(root, headRefOid);
    if (commitsAfter === null) {
        return unknownPullRequest(
            `the ${state} pull request for branch ${branch} left revision ${headRefOid.slice(0, 7)}, which this checkout's ${head.slice(0, 7)} does not build on, so it cannot be attributed to this work`,
        );
    }
    return { pullRequest, state: "known", reason: null, commitsAfter };
}

/**
 * Counts the commits HEAD adds to `revision` when this branch carried on from it,
 * such as a status record committed after the pull request merged. The revision
 * must sit on HEAD's first-parent line: a reused branch name started from a default
 * branch that merged the old pull request reaches it only through a merge commit's
 * second parent. Walking first parents back from HEAD stops at the revision's own
 * history, so stepping back by that count lands on the revision only when it is on
 * the line. Null when HEAD does not build on the revision that way.
 */
function commitsContinuing(root: string, revision: string): number | null {
    let counted = commandOutput(
        "git",
        ["rev-list", "--first-parent", "--count", `${revision}..HEAD`],
        root,
    );
    let count = Number(counted);
    if (counted === null || !Number.isSafeInteger(count) || count === 0) return null;
    let reached = commandOutput("git", ["rev-parse", "--verify", "--quiet", `HEAD~${count}`], root);
    return reached === revision ? count : null;
}

function collectPullRequest(
    root: string,
    branch: string | null,
    repository: Repository,
): PullRequestFacts {
    if (commandOutput("gh", ["--version"], root) === null) {
        return unknownPullRequest("gh is unavailable");
    }
    if (!commandSucceeds("gh", ["auth", "status"], root)) {
        return unknownPullRequest("gh is not authenticated");
    }
    if (!branch) return unknownPullRequest("the current branch is unknown");
    // Every state, because the default listing drops a pull request once it merges or closes.
    let source = commandOutput(
        "gh",
        [
            "pr",
            "list",
            "--state",
            "all",
            "--head",
            branch,
            "--limit",
            "2",
            "--json",
            "number,isDraft,url,title,state,baseRefName,headRefOid,headRepository",
        ],
        root,
    );
    if (source === null) {
        return unknownPullRequest(`gh could not list pull requests for branch ${branch}`);
    }
    let entries: unknown;
    try {
        entries = JSON.parse(source);
    } catch {
        return unknownPullRequest("gh returned invalid pull request data");
    }
    if (!Array.isArray(entries)) return unknownPullRequest("gh returned invalid pull request data");
    if (entries.length === 0) return { pullRequest: null, state: "known", reason: null };
    // A reused branch name carries several; picking one would misattribute this work.
    if (entries.length > 1) {
        return unknownPullRequest(
            `Multiple pull requests found for branch ${branch}, so none of them identifies this work`,
        );
    }
    let candidate = parsePullRequest(entries[0]);
    if (!candidate) return unknownPullRequest("gh returned invalid pull request data");
    return identifyPullRequest(root, candidate, branch, repository);
}

function countClarifications(content: string): number {
    return (withoutCode(content).match(/\[NEEDS CLARIFICATION:/g) ?? []).length;
}

function readProposal(root: string, name: string): Proposal | null {
    try {
        let source = readFileSync(path.join(root, "proposals", name), "utf8");
        let { frontmatter } = parseFrontmatter(source);
        if (!frontmatter) return null;
        return {
            id: frontmatter.id as string | undefined,
            title: frontmatter.title as string | undefined,
            status: frontmatter.status as string | undefined,
            pullRequest: frontmatter["pull-request"] as string | undefined,
            supersedes: frontmatter.supersedes as string[] | undefined,
            clarificationCount: countClarifications(source),
        };
    } catch {
        return null;
    }
}

function collectProposals(root: string): Proposal[] {
    try {
        return readdirSync(path.join(root, "proposals"), { withFileTypes: true })
            .filter(
                entry => entry.isFile() && entry.name.endsWith(".md") && entry.name !== "README.md",
            )
            .map(entry => readProposal(root, entry.name))
            .filter(Boolean) as Proposal[];
    } catch {
        return [];
    }
}

function proposalNumber(proposal: Proposal): number {
    return Number(proposal.id?.match(/(\d+)$/)?.[1] ?? -1);
}

/**
 * Whether a proposal's `pull-request` field names this pull request: its bare
 * number, or its URL. Numbers repeat across repositories, so a URL counts only
 * when it is this pull request's own.
 */
function matchesPullRequest(proposal: Proposal, pullRequest: PullRequest) {
    let link = proposal.pullRequest?.trim().replace(/\/+$/, "");
    return link === String(pullRequest.number) || link === pullRequest.url.replace(/\/+$/, "");
}

/**
 * The proposal this work belongs to: the one linked to the current pull
 * request, or else the newest in-flight proposal. With a known pull request,
 * a proposal linked to a different pull request is never a candidate, because
 * its phase and next step describe other work.
 */
export function selectProposal(proposals: Proposal[], pullRequest: PullRequest | null) {
    let ordered = [...proposals].sort(
        (left, right) => proposalNumber(right) - proposalNumber(left),
    );
    let matched =
        pullRequest && ordered.find(proposal => matchesPullRequest(proposal, pullRequest));
    if (matched) return { proposal: matched, otherCandidates: [] };

    let candidates = ordered.filter(
        ({ status, pullRequest: linked }) =>
            NON_TERMINAL_STATUSES.has(status) && !(pullRequest && linked),
    );
    return { proposal: candidates[0] ?? null, otherCandidates: candidates.slice(1) };
}

function successorFor(proposals: Proposal[], proposal: Proposal): Proposal | undefined {
    return [...proposals]
        .sort((left, right) => proposalNumber(right) - proposalNumber(left))
        .find(({ supersedes }) => supersedes?.includes(proposal.id as string));
}

export function gatherFacts(root = process.cwd()): Facts {
    let repository = collectRepository(root);
    let branch = collectBranch(root, repository);
    let upstream = collectUpstream(root);
    let pullRequestFacts = collectPullRequest(root, branch.branch, repository);
    let proposals = collectProposals(root);
    let selection = selectProposal(proposals, pullRequestFacts.pullRequest);
    let proposalSuccessor =
        selection.proposal?.status === "superseded"
            ? successorFor(proposals, selection.proposal)
            : null;
    return {
        branch: branch.branch,
        isDefaultBranch: branch.isDefaultBranch,
        defaultBranch: branch.defaultBranch,
        hasUpstream: upstream.hasUpstream,
        unpushedCommits: upstream.unpushedCommits,
        pullRequest: pullRequestFacts.pullRequest,
        pullRequestState: pullRequestFacts.state,
        pullRequestReason: pullRequestFacts.reason,
        commitsAfterPullRequest: pullRequestFacts.commitsAfter,
        proposal: selection.proposal,
        proposalSuccessor,
        proposalSelection: {
            otherCandidates: selection.otherCandidates.map(({ id, title }) => ({ id, title })),
        },
    };
}

function noticesFor(facts: Facts): Notice[] {
    let notices: Notice[] = [];
    if (facts.proposal && facts.proposal.clarificationCount > 0)
        notices.push({ kind: "clarifications", count: facts.proposal.clarificationCount });
    if (facts.unpushedCommits > 0)
        notices.push({ kind: "unpushed-commits", count: facts.unpushedCommits });
    if (facts.proposal?.status === "active-review" && facts.pullRequest?.isDraft)
        notices.push({ kind: "draft-active-review" });
    if (facts.pullRequest && facts.commitsAfterPullRequest) {
        notices.push({
            kind: "commits-after-pull-request",
            count: facts.commitsAfterPullRequest,
            state: facts.pullRequest.state.toLowerCase(),
        });
    }
    if (facts.proposal && (facts.proposalSelection?.otherCandidates?.length ?? 0) > 0) {
        notices.push({
            kind: "ambiguous-proposal-selection",
            selected: facts.proposal.id,
            otherCandidates: facts.proposalSelection!.otherCandidates,
        });
    }
    return notices;
}

function result(facts: Facts, status: Step): DerivedStatus {
    return { ...status, notices: noticesFor(facts) };
}

export function deriveStatus(facts: Facts): DerivedStatus {
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
    let { status } = facts.proposal;
    if (status === "accepted" || status === "implemented")
        return result(
            facts,
            completionStep(
                facts.pullRequest,
                facts.defaultBranch,
                status,
                facts.commitsAfterPullRequest ?? 0,
            ),
        );
    if (status === "superseded") return result(facts, supersededStep(facts.proposalSuccessor));
    return result(facts, STEPS[status as string] ?? STEPS.unknown);
}

function noticeLine(notice: Notice): string {
    if (notice.kind === "clarifications") return `Clarifications: ${notice.count} unresolved`;
    if (notice.kind === "unpushed-commits") return `Unpushed commits: ${notice.count}`;
    if (notice.kind === "draft-active-review")
        return "Warning: proposal is active-review, but the pull request remains draft.";
    if (notice.kind === "commits-after-pull-request") {
        let commits = notice.count === 1 ? "1 commit" : `${notice.count} commits`;
        return `Warning: this checkout has ${commits} the ${notice.state} pull request does not contain.`;
    }
    let candidates = notice.otherCandidates.map(({ id, title }) => `${id} (${title})`).join(", ");
    return `Warning: heuristic selected ${notice.selected}. Other candidates: ${candidates}.`;
}

export function formatStatus(facts: Facts, derived: DerivedStatus = deriveStatus(facts)): string {
    let proposal = facts.proposal
        ? `${facts.proposal.id}  ${facts.proposal.title}  ·  ${facts.proposal.status}`
        : "proposal — none";
    let pullRequest = "PR — none";
    if (facts.pullRequestState === "unknown") {
        let reason = facts.pullRequestReason ?? "gh could not determine the pull request";
        pullRequest = `PR — unknown (${reason})`;
    }
    if (facts.pullRequest) {
        let { number, state, isDraft, url } = facts.pullRequest;
        let label = state === "OPEN" ? (isDraft ? "draft" : "open") : state.toLowerCase();
        pullRequest = `PR #${number} (${label})  ${url}`;
    }
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

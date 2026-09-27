import type { TestContext } from "node:test";

import assert from "node:assert/strict";
import {
    mkdirSync,
    mkdtempSync,
    readFileSync,
    readdirSync,
    rmSync,
    symlinkSync,
    writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import type { Artifact, Frontmatter } from "./validate.ts";

import { collectArtifacts, parseFrontmatter, validateArtifacts, withoutCode } from "./validate.ts";

function artifact(path: string, frontmatter: Frontmatter, content = ""): Artifact {
    return { path, frontmatter, content };
}

let templateDirectory = new URL("../.agents/templates/", import.meta.url);

function readTemplate(name: string) {
    return readFileSync(new URL(name, templateDirectory), "utf8");
}

function temporaryRoot(t: TestContext) {
    let root = mkdtempSync(path.join(tmpdir(), "workbench-validate-"));
    t.after(() => rmSync(root, { force: true, recursive: true }));
    return root;
}

function proposalSource(id = "proposal.0001") {
    return [
        "---",
        `id: ${id}`,
        "title: Record Validation",
        "authors: [Ada]",
        "status: draft",
        "pull-request: 42",
        "supersedes: []",
        "---",
        "",
    ].join("\n");
}

function hasClarificationViolation(content: string) {
    return validateArtifacts([proposalArtifact("accepted", content)]).some(({ message }) =>
        message.includes("NEEDS CLARIFICATION"),
    );
}

function assertCodeIgnoresButProseReports(content: string) {
    assert.equal(hasClarificationViolation(content), false);
    assert.equal(
        hasClarificationViolation(`${content}\n\n[NEEDS CLARIFICATION: What remains unresolved?]`),
        true,
    );
}

function validArtifacts(): Artifact[] {
    return [
        artifact("proposals/0001-records.md", {
            id: "proposal.0001",
            title: "Record Validation",
            authors: ["Ada"],
            status: "superseded",
            "pull-request": "42",
            supersedes: [],
        }),
        artifact("proposals/0002-replaces.md", {
            id: "proposal.0002",
            title: "Replacement Record",
            authors: ["Ada"],
            status: "accepted",
            "pull-request": "43",
            supersedes: ["proposal.0001"],
        }),
        artifact("policies/0001-records.md", {
            id: "policy.0001",
            title: "Record Validation Policy",
            status: "active",
            "established-by": "proposal.0002",
            supersedes: [],
        }),
        artifact("decisions/0001-records.md", {
            id: "decision.0001",
            title: "Record Validation Decision",
            status: "accepted",
            "established-by": "proposal.0002",
            supersedes: [],
        }),
        artifact("VISION.md", {
            title: "Workbench Vision",
            updated: "2026-08-25",
        }),
    ];
}
function proposalArtifact(status: string, content = "") {
    return artifact(
        "proposals/0001-records.md",
        {
            id: "proposal.0001",
            title: "Record Validation",
            authors: ["Ada"],
            status,
            "pull-request": "42",
            supersedes: [],
        },
        content,
    );
}

test("rule 1 rejects missing required keys and invalid statuses", () => {
    let records = validArtifacts();
    records[0] = artifact("proposals/0001-records.md", {
        id: "proposal.0001",
        authors: ["Ada"],
        status: "retired",
        "pull-request": "42",
        supersedes: [],
    });
    records[1].frontmatter.supersedes = [];

    assert.deepEqual(validateArtifacts(records), [
        {
            path: "proposals/0001-records.md",
            message: 'missing required key "title"',
        },
        {
            path: "proposals/0001-records.md",
            message: 'invalid status "retired" for proposal',
        },
    ]);
});

test("rule 1 accepts every required key and allowed status", () => {
    assert.equal(
        validateArtifacts(validArtifacts()).some(
            ({ message }) => message.includes("required key") || message.includes("invalid status"),
        ),
        false,
    );
});

test("rule 1 requires a non-empty authors list on proposals", () => {
    let missingAuthors = validArtifacts();
    delete missingAuthors[0].frontmatter.authors;

    assert.deepEqual(
        validateArtifacts(missingAuthors).filter(({ message }) => message.includes("authors")),
        [
            {
                path: "proposals/0001-records.md",
                message: 'missing required key "authors"',
            },
        ],
    );

    let presentAuthors = validArtifacts();
    presentAuthors[0].frontmatter.authors = ["Ada"];

    assert.equal(
        validateArtifacts(presentAuthors).some(({ message }) => message.includes("authors")),
        false,
    );
});

test("rule 1 rejects an empty authors list on proposals", () => {
    let records = validArtifacts();
    records[0].frontmatter.authors = [];

    assert.deepEqual(
        validateArtifacts(records).filter(({ message }) => message.includes("authors")),
        [
            {
                path: "proposals/0001-records.md",
                message: 'key "authors" must be a non-empty inline list',
            },
        ],
    );
});

test("rule 1 accepts newly allowed statuses for their record kinds", () => {
    let cases: [string, number, string][] = [
        ["policy", 2, "draft"],
        ["decision", 3, "proposed"],
    ];

    for (let [type, index, status] of cases) {
        let records = validArtifacts();
        records[index].frontmatter.status = status;

        assert.equal(
            validateArtifacts(records).some(
                ({ message }) => message === `invalid status "${status}" for ${type}`,
            ),
            false,
        );
    }
});

test("rule 1 accepts every proposal status", () => {
    let statuses = [
        "draft",
        "awaiting-implementation",
        "active-review",
        "returned-for-revisions",
        "accepted",
        "implemented",
        "rejected",
        "withdrawn",
        "superseded",
    ];

    for (let status of statuses) {
        assert.deepEqual(validateArtifacts([proposalArtifact(status)]), []);
    }
});

test("rule 1 keeps proposal, policy, and decision statuses distinct", () => {
    let cases: [string, number, string][] = [
        ["proposal", 0, "active"],
        ["proposal", 0, "proposed"],
        ["policy", 2, "implemented"],
        ["policy", 2, "awaiting-implementation"],
        ["decision", 3, "awaiting-implementation"],
    ];

    for (let [type, index, status] of cases) {
        let records = validArtifacts();
        records[index].frontmatter.status = status;

        assert.deepEqual(
            validateArtifacts(records).filter(
                ({ message }) => message === `invalid status "${status}" for ${type}`,
            ),
            [
                {
                    path: records[index].path,
                    message: `invalid status "${status}" for ${type}`,
                },
            ],
        );
    }
});

test("rule 1 accepts absent, empty, and populated proposal issues lists", () => {
    let absentIssues = validArtifacts();
    let emptyIssues = validArtifacts();
    let populatedIssues = validArtifacts();
    emptyIssues[0].frontmatter.issues = [];
    populatedIssues[0].frontmatter.issues = [
        "#12",
        "https://github.com/example/workbench/issues/34",
    ];

    for (let records of [absentIssues, emptyIssues, populatedIssues]) {
        assert.equal(
            validateArtifacts(records).some(({ message }) => message.includes("issues")),
            false,
        );
    }
});

test("rule 1 rejects a proposal issues value that is not a list", () => {
    let records = validArtifacts();
    records[0].frontmatter.issues = "#12";

    assert.deepEqual(
        validateArtifacts(records).filter(({ message }) => message.includes("issues")),
        [
            {
                path: "proposals/0001-records.md",
                message: 'key "issues" must be an inline list',
            },
        ],
    );
});

test("rule 2 rejects IDs that do not match their filenames and duplicates", () => {
    let records = validArtifacts();
    records[0].frontmatter.id = "proposal.9999";
    records[1].frontmatter.id = "policy.0001";

    assert.deepEqual(
        validateArtifacts(records).filter(({ message }) => message.includes("ID")),
        [
            {
                path: "proposals/0001-records.md",
                message: 'ID "proposal.9999" must be "proposal.0001" for this filename',
            },
            {
                path: "proposals/0002-replaces.md",
                message: 'ID "policy.0001" must be "proposal.0002" for this filename',
            },
            {
                path: "proposals/0002-replaces.md",
                message: 'duplicate ID "policy.0001"; first declared in policies/0001-records.md',
            },
        ],
    );
});

test("rule 2 accepts IDs matching unique filenames", () => {
    assert.equal(
        validateArtifacts(validArtifacts()).some(({ message }) => message.includes("ID")),
        false,
    );
});

test("rule 2 rejects a filename without a four-digit record number", () => {
    let records = validArtifacts();
    records[0] = artifact("proposals/records.md", {
        ...records[0].frontmatter,
        status: "accepted",
        supersedes: [],
    });
    records[1].frontmatter.supersedes = [];

    assert.deepEqual(
        validateArtifacts(records).filter(({ path: file }) => file === "proposals/records.md"),
        [
            {
                path: "proposals/records.md",
                message: "filename must begin with a four-digit record number and slug",
            },
        ],
    );
});

test("rule 3 rejects unresolved cross-references", () => {
    let records = validArtifacts();
    records[2].frontmatter["established-by"] = "proposal.9999";

    assert.deepEqual(
        validateArtifacts(records).filter(({ message }) => message.includes("does not resolve")),
        [
            {
                path: "policies/0001-records.md",
                message: 'reference "proposal.9999" in established-by does not resolve',
            },
        ],
    );
});

test("rule 3 accepts resolved cross-references", () => {
    assert.equal(
        validateArtifacts(validArtifacts()).some(({ message }) =>
            message.includes("does not resolve"),
        ),
        false,
    );
});

function policySupersession(status: string) {
    return [
        artifact("proposals/0001-records.md", {
            id: "proposal.0001",
            title: "Record Validation",
            authors: ["Ada"],
            status: "accepted",
            "pull-request": "42",
            supersedes: [],
        }),
        artifact("policies/0001-old.md", {
            id: "policy.0001",
            title: "Old Policy",
            status,
            "established-by": "proposal.0001",
            supersedes: [],
        }),
        artifact("policies/0002-new.md", {
            id: "policy.0002",
            title: "New Policy",
            status: "active",
            "established-by": "proposal.0001",
            supersedes: ["policy.0001"],
        }),
    ];
}

test("rule 4 rejects a superseded record that remains active", () => {
    assert.deepEqual(
        validateArtifacts(policySupersession("active")).filter(({ message }) =>
            message.includes("must have status"),
        ),
        [
            {
                path: "policies/0001-old.md",
                message: 'record superseded by policy.0002 must have status "superseded"',
            },
        ],
    );
});

test("rule 4 accepts a record marked superseded", () => {
    assert.equal(
        validateArtifacts(policySupersession("superseded")).some(({ message }) =>
            message.includes("must have status"),
        ),
        false,
    );
});

test("rule 5 rejects clarification markers in statuses that require a finished design", () => {
    let statuses = [
        "awaiting-implementation",
        "active-review",
        "accepted",
        "implemented",
        "superseded",
    ];

    for (let status of statuses) {
        let records = validArtifacts();
        records[1].frontmatter.status = status;
        records[1].content = "[NEEDS CLARIFICATION: What is the release boundary?]";

        assert.deepEqual(
            validateArtifacts(records).filter(({ message }) =>
                message.includes("NEEDS CLARIFICATION"),
            ),
            [
                {
                    path: "proposals/0002-replaces.md",
                    message: `proposal status "${status}" does not allow a [NEEDS CLARIFICATION:] marker`,
                },
            ],
        );
    }
});

test("rule 5 permits clarification markers in statuses that allow design changes", () => {
    let statuses = ["draft", "returned-for-revisions", "rejected", "withdrawn"];

    for (let status of statuses) {
        let records = validArtifacts();
        records[1].frontmatter.status = status;
        records[1].content = "[NEEDS CLARIFICATION: What is the release boundary?]";

        assert.equal(
            validateArtifacts(records).some(({ message }) =>
                message.includes("NEEDS CLARIFICATION"),
            ),
            false,
        );
    }
});

test("rule 5 ignores a marker inside an inline code span", () => {
    let records = validArtifacts();
    records[1].frontmatter.status = "accepted";
    records[1].content = "Rule 5 rejects a `[NEEDS CLARIFICATION:` marker in a final proposal.";

    assert.equal(
        validateArtifacts(records).some(({ message }) => message.includes("NEEDS CLARIFICATION")),
        false,
    );
});

test("rule 5 ignores a marker inside a fenced code block", () => {
    let records = validArtifacts();
    records[1].frontmatter.status = "accepted";
    records[1].content = "Example:\n\n```md\n- [NEEDS CLARIFICATION: how?]\n```\n";

    assert.equal(
        validateArtifacts(records).some(({ message }) => message.includes("NEEDS CLARIFICATION")),
        false,
    );
});

test("rule 5 still fires on a prose marker beside a quoted one", () => {
    let records = validArtifacts();
    records[1].frontmatter.status = "accepted";
    records[1].content =
        "The `[NEEDS CLARIFICATION:` form is the convention.\n\n" +
        "- [NEEDS CLARIFICATION: is this genuinely unresolved?]\n";

    assert.equal(
        validateArtifacts(records).some(({ message }) => message.includes("NEEDS CLARIFICATION")),
        true,
    );
});

test("withoutCode strips code while preserving surrounding prose", () => {
    assert.equal(withoutCode("before `x` after"), "before  after");

    let stripped = withoutCode("before\n\n```\nexample\n```\n\nafter");
    assert.equal(stripped.includes("example"), false);
    assert.match(stripped, /^before/);
    assert.match(stripped, /after$/);
});

test("a valid full record set has no violations", () => {
    assert.deepEqual(validateArtifacts(validArtifacts()), []);
});

test("parseFrontmatter accepts blank lines and full-line comments without stripping values", () => {
    let source = [
        "---",
        "",
        "  # A YAML comment",
        "\t",
        "id: proposal.0001",
        "title: A title # with a literal hash",
        "authors: [Ada, Grace]",
        "---",
        "Body",
    ].join("\n");

    assert.deepEqual(parseFrontmatter(source), {
        frontmatter: {
            id: "proposal.0001",
            title: "A title # with a literal hash",
            authors: ["Ada", "Grace"],
        },
        content: source,
    });
});

test("parseFrontmatter rejects malformed input and duplicate keys", () => {
    assert.deepEqual(parseFrontmatter("title: Missing delimiters"), {
        error: "missing YAML frontmatter",
    });
    assert.deepEqual(parseFrontmatter("---\ntitle: First\ntitle: Second\n---"), {
        error: 'duplicate frontmatter key "title"',
    });
    assert.deepEqual(parseFrontmatter("---\nnot valid\n---"), {
        error: 'cannot parse frontmatter line "not valid"',
    });
});

test("every record template has parsable frontmatter", () => {
    let templates = readdirSync(templateDirectory, { withFileTypes: true })
        .filter(entry => entry.isFile())
        .map(entry => [entry.name, readTemplate(entry.name)]);
    let frontmatterTemplates = templates.filter(([, source]) => source.startsWith("---"));

    assert.deepEqual(frontmatterTemplates.map(([name]) => name).sort(), [
        "DECISION.md",
        "GUIDE.md",
        "POLICY.md",
        "PROPOSAL.md",
        "VISION.md",
    ]);
    for (let [name, source] of frontmatterTemplates) {
        let parsed = parseFrontmatter(source);
        assert.equal(parsed.error, undefined, `${name}: ${parsed.error}`);
    }
});

test("a filled-in proposal template validates", () => {
    let source = readTemplate("PROPOSAL.md")
        .replace("id: proposal.<NNNN>", "id: proposal.0001")
        .replace("title: <Title Case>", "title: Template Validation")
        .replace("authors: [<name>]", "authors: [Ada]")
        .replace("pull-request: <url or number, empty while unopened>", "pull-request: 42");
    let parsed = parseFrontmatter(source);

    assert.equal(parsed.error, undefined);
    assert.deepEqual(
        validateArtifacts([
            artifact("proposals/0001-template.md", parsed.frontmatter, parsed.content),
        ]),
        [],
    );
});

test("collectArtifacts validates symlinked regular files without traversing symlinked directories", t => {
    let root = temporaryRoot(t);
    let proposals = path.join(root, "proposals");
    let nested = path.join(root, "nested");
    mkdirSync(proposals);
    mkdirSync(nested);
    writeFileSync(path.join(root, "record.md"), proposalSource("proposal.9999"));
    writeFileSync(path.join(nested, "hidden.md"), proposalSource());
    symlinkSync(path.join(root, "record.md"), path.join(proposals, "0001-records.md"));
    symlinkSync(nested, path.join(proposals, "nested"));

    let collected = collectArtifacts(root);

    assert.deepEqual(collected.violations, []);
    assert.deepEqual(
        collected.artifacts.map(({ path: artifactPath }) => artifactPath),
        ["proposals/0001-records.md"],
    );
    assert.deepEqual(validateArtifacts(collected.artifacts), [
        {
            path: "proposals/0001-records.md",
            message: 'ID "proposal.9999" must be "proposal.0001" for this filename',
        },
    ]);
});

test("collectArtifacts rejects markdown nested beneath record directories", t => {
    let root = temporaryRoot(t);
    let nested = path.join(root, "proposals", "drafts");
    mkdirSync(nested, { recursive: true });
    writeFileSync(path.join(nested, "0001-record.md"), proposalSource());

    assert.deepEqual(collectArtifacts(root), {
        artifacts: [],
        violations: [
            {
                path: "proposals/drafts/0001-record.md",
                message: "nested record file; move it to proposals/ or remove it",
            },
        ],
    });
});

test("rule 4 rejects a self-supersession", () => {
    let records = policySupersession("superseded");
    records[2].frontmatter.status = "superseded";
    records[2].frontmatter.supersedes = ["policy.0002"];

    assert.deepEqual(
        validateArtifacts(records).filter(({ message }) => message.includes("supersession cycle")),
        [
            {
                path: "policies/0002-new.md",
                message: "supersession cycle: policy.0002 -> policy.0002",
            },
        ],
    );
});

test("rule 4 rejects a supersession cycle", () => {
    let records = policySupersession("superseded");
    records[1].frontmatter.supersedes = ["policy.0002"];
    records[2].frontmatter.status = "superseded";

    assert.deepEqual(
        validateArtifacts(records).filter(({ message }) => message.includes("supersession cycle")),
        [
            {
                path: "policies/0001-old.md",
                message: "supersession cycle: policy.0001 -> policy.0002 -> policy.0001",
            },
        ],
    );
});

test("rule 5 ignores markers inside tilde fences but detects surrounding prose", () => {
    assertCodeIgnoresButProseReports("~~~md\n[NEEDS CLARIFICATION: This is code.]\n~~~");
});

test("rule 5 respects a backtick fence's opening length", () => {
    assertCodeIgnoresButProseReports(
        "````md\n```\n[NEEDS CLARIFICATION: This is code.]\n```\n````",
    );
});

test("rule 5 does not open a fence whose info string contains a backtick", () => {
    assert.equal(
        hasClarificationViolation("``` `note`\n[NEEDS CLARIFICATION: This remains prose.]\n```\n"),
        true,
    );
});

test("rule 5 does not mistake inline code for an opening fence", () => {
    assert.equal(
        hasClarificationViolation("`note`\n[NEEDS CLARIFICATION: This remains prose.]"),
        true,
    );
});

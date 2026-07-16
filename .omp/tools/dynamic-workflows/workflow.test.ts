import { describe, expect, it } from "vitest";
import { parseWorkflowScript } from "./workflow.js";

const header = `export const meta = {
  name: "inspect_repo",
  description: "Inspect repository modules",
  phases: [{ title: "Scan" }],
}`;

describe("parseWorkflowScript", () => {
  it("extracts literal metadata and removes only the first export", () => {
    const parsed = parseWorkflowScript(`${header}\nphase("Scan")\nreturn args`);
    expect(parsed.meta).toEqual({
      name: "inspect_repo",
      description: "Inspect repository modules",
      phases: [{ title: "Scan" }],
    });
    expect(parsed.body).toContain('phase("Scan")');
    expect(parsed.body).not.toContain("export const meta");
  });

  it("rejects semantic errors other than the intentional top-level return", () => {
    expect(() => parseWorkflowScript(`${header}\nlet duplicate;\nlet duplicate;`)).toThrow(
      /already been declared/,
    );
  });

  it("does not suppress unrelated semantic errors when source contains TS1108", () => {
    expect(() =>
      parseWorkflowScript(`${header}\nconst TS1108 = 1; let duplicate; let duplicate;`),
    ).toThrow(/already been declared/);
  });

  it.each([
    ["missing export", `const meta = { name: "x", description: "y" }`],
    ["computed metadata", `export const meta = { ["name"]: "x", description: "y" }`],
    ["spread metadata", `export const meta = { ...x, name: "x", description: "y" }`],
    ["prototype key", `export const meta = { name: "x", description: "y", __proto__: {} }`],
    ["empty name", `export const meta = { name: "", description: "y" }`],
    ["empty description", `export const meta = { name: "x", description: "" }`],
    ["syntax error", `export const meta = { name: "x", description: }`],
    ["second export", `export const meta = { name: "x", description: "y" }; export const value = 1`],
  ])("rejects %s", (_label, script) => {
    expect(() => parseWorkflowScript(script)).toThrow();
  });

  it.each([
    "Date.now()",
    "new Date()",
    "Math.random()",
    'import("node:fs")',
    'require("node:fs")',
    'eval("1 + 1")',
  ])("rejects unavailable operation %s", expression => {
    expect(() => parseWorkflowScript(`${header}\n${expression}`)).toThrow(/unavailable|deterministic|import|require|eval/i);
  });
});

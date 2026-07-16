// Ported from pi-dynamic-workflows v1.0.1, commit 31b2aca0f1cb195aafbfc5e3ee2b8c83ad3f21a2.
import type { OxcError, Program } from "oxc-parser";
import { parseSync } from "oxc-parser";

export interface WorkflowMetaPhase {
  title: string;
  detail?: string;
  model?: string;
}

export interface WorkflowMeta {
  name: string;
  description: string;
  whenToUse?: string;
  phases?: WorkflowMetaPhase[];
}

type AstNode = {
  type: string;
  start: number;
  end: number;
  [key: string]: unknown;
};

const NONDETERMINISM_ERROR =
  "Workflow scripts must be deterministic: Date.now(), Math.random(), and new Date() are unavailable";

export function parseWorkflowScript(script: string): { meta: WorkflowMeta; body: string } {
  const result = parseSync("workflow.js", script, {
    lang: "js",
    sourceType: "module",
    astType: "js",
    range: true,
    preserveParens: false,
    showSemanticErrors: true,
  });
  const fatal = result.errors.find(
    error => error.severity === "Error" && !isIntentionalTopLevelReturnDiagnostic(error),
  );
  if (fatal) throw new Error(fatal.codeframe ?? fatal.message);

  const program = result.program as Program & AstNode;
  const first = program.body[0] as unknown as AstNode | undefined;
  if (first?.type !== "ExportNamedDeclaration") {
    throw new Error("`export const meta = { name, description }` must be the first statement");
  }
  assertAvailableAst(program, first);
  const declaration = first.declaration as AstNode | null;
  if (declaration?.type !== "VariableDeclaration" || declaration.kind !== "const") {
    throw new Error("meta export must be `export const meta = ...`");
  }
  const declarations = declaration.declarations as AstNode[];
  if (declarations.length !== 1) throw new Error("meta export must declare only `meta`");
  const declarator = declarations[0];
  const id = declarator.id as AstNode;
  if (id.type !== "Identifier" || id.name !== "meta") throw new Error("meta export must declare `meta`");
  const meta = evaluateLiteral(declarator.init as AstNode, "meta");
  validateMeta(meta);
  return { meta, body: script.slice(0, first.start) + script.slice(first.end) };
}

function isIntentionalTopLevelReturnDiagnostic(error: OxcError): boolean {
  return error.message === "A 'return' statement can only be used within a function body.";
}

function evaluateLiteral(node: AstNode, path: string): unknown {
  switch (node.type) {
    case "ObjectExpression": {
      const result: Record<string, unknown> = {};
      for (const property of node.properties as AstNode[]) {
        if (property.type === "SpreadElement") throw new Error(`spread not allowed in ${path}`);
        if (property.type !== "Property") throw new Error(`only plain properties allowed in ${path}`);
        if (property.computed) throw new Error(`computed keys not allowed in ${path}`);
        if (property.kind !== "init" || property.method) {
          throw new Error(`methods/accessors not allowed in ${path}`);
        }
        const key = propertyKey(property.key as AstNode, path);
        if (key === "__proto__" || key === "constructor" || key === "prototype") {
          throw new Error(`reserved key name not allowed in ${path}: ${key}`);
        }
        result[key] = evaluateLiteral(property.value as AstNode, `${path}.${key}`);
      }
      return result;
    }
    case "ArrayExpression":
      return (node.elements as Array<AstNode | null>).map((element, index) => {
        if (!element) throw new Error(`sparse arrays not allowed in ${path}`);
        if (element.type === "SpreadElement") throw new Error(`spread not allowed in ${path}`);
        return evaluateLiteral(element, `${path}[${index}]`);
      });
    case "Literal":
      return node.value;
    case "TemplateLiteral": {
      const expressions = node.expressions as AstNode[];
      if (expressions.length > 0) throw new Error(`template interpolation not allowed in ${path}`);
      return (node.quasis as AstNode[])
        .map(quasi => {
          const value = quasi.value as { cooked?: string | null; raw: string };
          return value.cooked ?? value.raw;
        })
        .join("");
    }
    case "UnaryExpression": {
      const argument = node.argument as AstNode;
      if (node.operator === "-" && argument.type === "Literal" && typeof argument.value === "number") {
        return -argument.value;
      }
      throw new Error(`only negative-number unary allowed in ${path}`);
    }
    default:
      throw new Error(`non-literal node type in ${path}: ${node.type}`);
  }
}

function propertyKey(node: AstNode, path: string): string {
  if (node.type === "Identifier") return node.name as string;
  if (node.type === "Literal" && (typeof node.value === "string" || typeof node.value === "number")) {
    return String(node.value);
  }
  throw new Error(`unsupported key type in ${path}: ${node.type}`);
}

function validateMeta(meta: unknown): asserts meta is WorkflowMeta {
  if (!meta || typeof meta !== "object") throw new Error("meta must be an object");
  const value = meta as Record<string, unknown>;
  if (typeof value.name !== "string" || !value.name.trim()) {
    throw new Error("meta.name must be a non-empty string");
  }
  if (typeof value.description !== "string" || !value.description.trim()) {
    throw new Error("meta.description must be a non-empty string");
  }
  if (value.whenToUse !== undefined && typeof value.whenToUse !== "string") {
    throw new Error("meta.whenToUse must be a string");
  }
  if (value.phases === undefined) return;
  if (!Array.isArray(value.phases)) throw new Error("meta.phases must be an array");
  for (const phase of value.phases) {
    if (!phase || typeof phase !== "object" || Array.isArray(phase)) {
      throw new Error("each meta phase must be an object with a non-empty title string");
    }
    const candidate = phase as Record<string, unknown>;
    if (typeof candidate.title !== "string" || !candidate.title.trim()) {
      throw new Error("each meta phase must have a non-empty title string");
    }
    if (candidate.detail !== undefined && typeof candidate.detail !== "string") {
      throw new Error("meta phase detail must be a string");
    }
    if (candidate.model !== undefined && typeof candidate.model !== "string") {
      throw new Error("meta phase model must be a string");
    }
  }
}

function assertAvailableAst(node: AstNode, allowedMetaExport: AstNode): void {
  if (node === allowedMetaExport) return;

  if (node.type.startsWith("Import") || node.type.startsWith("Export")) {
    throw new Error("imports and exports are unavailable in workflow scripts");
  }
  if (node.type === "MetaProperty") {
    throw new Error("meta properties are unavailable in workflow scripts");
  }
  if (isNewDateExpression(node) || isMemberCall(node, "Date", "now") || isMemberCall(node, "Math", "random")) {
    throw new Error(NONDETERMINISM_ERROR);
  }
  if (isIdentifierCall(node, "require")) throw new Error("require() is unavailable in workflow scripts");
  if (isIdentifierCall(node, "eval")) throw new Error("eval() is unavailable in workflow scripts");

  for (const [key, value] of Object.entries(node)) {
    if (key === "start" || key === "end" || key === "range") continue;
    if (Array.isArray(value)) {
      for (const child of value) {
        if (isAstNode(child)) assertAvailableAst(child, allowedMetaExport);
      }
    } else if (isAstNode(value)) {
      assertAvailableAst(value, allowedMetaExport);
    }
  }
}

function isAstNode(value: unknown): value is AstNode {
  return value !== null && typeof value === "object" && typeof (value as { type?: unknown }).type === "string";
}

function isIdentifierCall(node: AstNode, name: string): boolean {
  if (node.type !== "CallExpression" || !isAstNode(node.callee)) return false;
  return node.callee.type === "Identifier" && node.callee.name === name;
}

function isMemberCall(node: AstNode, objectName: string, propertyName: string): boolean {
  if (node.type !== "CallExpression" || !isAstNode(node.callee) || node.callee.type !== "MemberExpression") {
    return false;
  }
  const object = node.callee.object;
  if (!isAstNode(object) || object.type !== "Identifier" || object.name !== objectName) return false;
  return memberPropertyName(node.callee) === propertyName;
}

function memberPropertyName(node: AstNode): string | undefined {
  const property = node.property;
  if (!isAstNode(property)) return undefined;
  if (!node.computed && property.type === "Identifier") return property.name as string;
  if (property.type === "Literal" && typeof property.value === "string") return property.value;
  if (property.type === "TemplateLiteral" && (property.expressions as AstNode[]).length === 0) {
    return (property.quasis as AstNode[])
      .map(quasi => {
        const value = quasi.value as { cooked?: string | null; raw: string };
        return value.cooked ?? value.raw;
      })
      .join("");
  }
  return undefined;
}

function isNewDateExpression(node: AstNode): boolean {
  if (node.type !== "NewExpression" || !isAstNode(node.callee)) return false;
  return node.callee.type === "Identifier" && node.callee.name === "Date";
}

import { createElement, css as css$1 } from "remix/ui";
//#region src/brands.ts
const TOKEN_TYPES = [
	"color",
	"dimension",
	"duration",
	"fontFamily",
	"fontWeight",
	"number",
	"cubicBezier",
	"shadow",
	"border",
	"transition",
	"gradient",
	"strokeStyle"
];
//#endregion
//#region src/tokens.ts
var ThemeError = class extends Error {
	name = "ThemeError";
};
const ALIAS_RE = /^\{([^{}]+)\}$/;
function aliasTarget(value) {
	if (typeof value !== "string") return null;
	let match = ALIAS_RE.exec(value);
	return match ? match[1] : null;
}
function kebabSegment(segment) {
	let kebab = segment.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
	if (!kebab) throw new ThemeError(`Token path segment "${segment}" produces an empty CSS identifier`);
	return kebab;
}
function parseTokens(document) {
	let entries = /* @__PURE__ */ new Map();
	walk(document, [], validateType(document.$type, "$root"), entries);
	let tokens = /* @__PURE__ */ new Map();
	let varNames = /* @__PURE__ */ new Map();
	for (let entry of entries.values()) {
		let type = resolveType(entry.key, entries, []);
		let varName = `--${entry.path.map(kebabSegment).join("-")}`;
		let existing = varNames.get(varName);
		if (existing !== void 0) throw new ThemeError(`Tokens "${existing}" and "${entry.key}" both produce the CSS variable ${varName}`);
		varNames.set(varName, entry.key);
		let alias = aliasTarget(entry.value);
		tokens.set(entry.key, {
			key: entry.key,
			path: entry.path,
			varName,
			type,
			value: entry.value,
			...alias === null ? {} : { aliasOf: alias }
		});
	}
	return tokens;
}
function walk(node, path, inherited, out) {
	for (let [key, child] of Object.entries(node)) {
		if (key.startsWith("$")) continue;
		let childPath = [...path, key];
		let childKey = childPath.join(".");
		if (/[.{}]/.test(key)) throw new ThemeError(`Token or group name "${childKey}" contains characters reserved by DTCG references (".", "{", "}")`);
		if (typeof child !== "object" || child === null || Array.isArray(child)) throw new ThemeError(`"${childKey}" is neither a group nor a token`);
		let record = child;
		let ownType = validateType(record.$type, childKey);
		if ("$value" in record) out.set(childKey, {
			key: childKey,
			path: childPath,
			ownType,
			inheritedType: inherited,
			value: record.$value
		});
		else walk(record, childPath, ownType ?? inherited, out);
	}
}
function validateType(value, key) {
	if (value === void 0) return void 0;
	if (value === "typography") throw new ThemeError(`"${key}": typography tokens are not supported in v1`);
	if (!TOKEN_TYPES.includes(value)) throw new ThemeError(`"${key}" has unknown $type "${String(value)}"`);
	return value;
}
function resolveType(key, entries, chain) {
	if (chain.includes(key)) throw new ThemeError(`Alias cycle: ${[...chain, key].join(" → ")}`);
	let entry = entries.get(key);
	if (!entry) throw new ThemeError(`"${chain[chain.length - 1] ?? key}" references unknown token "${key}"`);
	if (entry.ownType) return entry.ownType;
	let alias = aliasTarget(entry.value);
	if (alias !== null) return resolveType(alias, entries, [...chain, key]);
	if (entry.inheritedType) return entry.inheritedType;
	throw new ThemeError(`"${key}" has no resolvable $type`);
}
//#endregion
//#region src/serialize.ts
const FONT_WEIGHT_KEYWORDS = {
	thin: 100,
	hairline: 100,
	"extra-light": 200,
	"ultra-light": 200,
	light: 300,
	normal: 400,
	regular: 400,
	book: 400,
	medium: 500,
	"semi-bold": 600,
	"demi-bold": 600,
	bold: 700,
	"extra-bold": 800,
	"ultra-bold": 800,
	black: 900,
	heavy: 900,
	"extra-black": 950,
	"ultra-black": 950
};
const COLOR_FUNCTIONS = {
	hsl: {
		fn: "hsl",
		percents: [1, 2]
	},
	hwb: {
		fn: "hwb",
		percents: [1, 2]
	},
	lab: { fn: "lab" },
	lch: { fn: "lch" },
	oklab: { fn: "oklab" },
	oklch: { fn: "oklch" }
};
const COLOR_SPACES = /* @__PURE__ */ new Set([
	"srgb",
	"srgb-linear",
	"display-p3",
	"a98-rgb",
	"prophoto-rgb",
	"rec2020",
	"xyz-d65",
	"xyz-d50"
]);
const STROKE_KEYWORDS = /* @__PURE__ */ new Set([
	"solid",
	"dashed",
	"dotted",
	"double",
	"groove",
	"ridge",
	"outset",
	"inset"
]);
function serializeValue(type, value, ctx, key) {
	switch (type) {
		case "color": return serializeColor(value, key);
		case "dimension": return serializeMeasure(value, ["px", "rem"], key);
		case "duration": return serializeMeasure(value, ["ms", "s"], key);
		case "fontFamily": return serializeFontFamily(value, key);
		case "fontWeight": return serializeFontWeight(value, key);
		case "number": return serializeNumber(value, key);
		case "cubicBezier": return serializeCubicBezier(value, key);
		case "shadow": return serializeShadow(value, ctx, key);
		case "border": return serializeBorder(value, ctx, key);
		case "transition": return serializeTransition(value, ctx, key);
		case "gradient": return serializeGradient(value, ctx, key);
		case "strokeStyle": return serializeStrokeStyle(value, key);
	}
}
function field(type, value, ctx, key) {
	let alias = aliasTarget(value);
	if (alias !== null) return ctx.varRefFor(alias, key, type);
	return serializeValue(type, value, ctx, key);
}
function invalid(key, type, value) {
	return new ThemeError(`"${key}" has an invalid ${type} value: ${JSON.stringify(value)}`);
}
function serializeColor(value, key) {
	if (typeof value === "string") return value;
	if (typeof value !== "object" || value === null) throw invalid(key, "color", value);
	let { colorSpace, components, alpha, hex } = value;
	if (typeof hex === "string") return hex;
	if (typeof colorSpace !== "string" || !Array.isArray(components)) throw invalid(key, "color", value);
	let parts = components.map((component) => component === "none" ? "none" : serializeNumber(component, key));
	let alphaPart = alpha === void 0 ? "" : ` / ${serializeNumber(alpha, key)}`;
	let fn = COLOR_FUNCTIONS[colorSpace];
	if (fn) {
		let printed = parts.map((part, index) => fn.percents?.includes(index) && part !== "none" ? `${part}%` : part);
		return `${fn.fn}(${printed.join(" ")}${alphaPart})`;
	}
	if (COLOR_SPACES.has(colorSpace)) return `color(${colorSpace} ${parts.join(" ")}${alphaPart})`;
	throw new ThemeError(`"${key}" has unknown colorSpace "${colorSpace}"`);
}
function serializeMeasure(value, units, key) {
	if (typeof value === "string") return value;
	if (typeof value === "object" && value !== null) {
		let { value: amount, unit } = value;
		if (typeof amount === "number" && typeof unit === "string" && units.includes(unit)) return `${amount}${unit}`;
	}
	throw invalid(key, `dimension/duration (${units.join("|")})`, value);
}
function serializeFontFamily(value, key) {
	let names = Array.isArray(value) ? value : [value];
	if (names.length === 0) throw invalid(key, "fontFamily", value);
	return names.map((name) => {
		if (typeof name !== "string") throw invalid(key, "fontFamily", value);
		return /^[a-zA-Z][a-zA-Z-]*$/.test(name) ? name : `"${name.replaceAll("\"", "\\\"")}"`;
	}).join(", ");
}
function serializeFontWeight(value, key) {
	if (typeof value === "number") {
		if (value >= 1 && value <= 1e3) return String(value);
		throw invalid(key, "fontWeight", value);
	}
	if (typeof value === "string") {
		let mapped = FONT_WEIGHT_KEYWORDS[value];
		if (mapped !== void 0) return String(mapped);
		throw new ThemeError(`"${key}" has unknown fontWeight keyword "${value}"`);
	}
	throw invalid(key, "fontWeight", value);
}
function serializeNumber(value, key) {
	if (typeof value !== "number" || !Number.isFinite(value)) throw invalid(key, "number", value);
	return String(value);
}
function serializeCubicBezier(value, key) {
	if (!Array.isArray(value) || value.length !== 4) throw invalid(key, "cubicBezier", value);
	return `cubic-bezier(${value.map((part) => serializeNumber(part, key)).join(", ")})`;
}
function serializeShadow(value, ctx, key) {
	return (Array.isArray(value) ? value : [value]).map((shadow) => {
		if (typeof shadow !== "object" || shadow === null) throw invalid(key, "shadow", value);
		let { color, offsetX, offsetY, blur, spread, inset } = shadow;
		let parts = [
			field("dimension", offsetX, ctx, key),
			field("dimension", offsetY, ctx, key),
			blur === void 0 ? "0" : field("dimension", blur, ctx, key),
			spread === void 0 ? "0" : field("dimension", spread, ctx, key),
			field("color", color, ctx, key)
		];
		return `${inset === true ? "inset " : ""}${parts.join(" ")}`;
	}).join(", ");
}
function serializeBorder(value, ctx, key) {
	if (typeof value !== "object" || value === null) throw invalid(key, "border", value);
	let { color, width, style } = value;
	return `${field("dimension", width, ctx, key)} ${field("strokeStyle", style, ctx, key)} ${field("color", color, ctx, key)}`;
}
function serializeTransition(value, ctx, key) {
	if (typeof value !== "object" || value === null) throw invalid(key, "transition", value);
	let { duration, timingFunction, delay } = value;
	let delayPart = delay === void 0 ? "0s" : field("duration", delay, ctx, key);
	return `${field("duration", duration, ctx, key)} ${field("cubicBezier", timingFunction, ctx, key)} ${delayPart}`;
}
function serializeGradient(value, ctx, key) {
	if (!Array.isArray(value)) throw invalid(key, "gradient", value);
	return value.map((stop) => {
		if (typeof stop !== "object" || stop === null) throw invalid(key, "gradient", value);
		let { color, position } = stop;
		if (typeof position !== "number") throw invalid(key, "gradient stop position", position);
		return `${field("color", color, ctx, key)} ${Number((position * 100).toFixed(4))}%`;
	}).join(", ");
}
function serializeStrokeStyle(value, key) {
	if (typeof value === "string") {
		if (STROKE_KEYWORDS.has(value)) return value;
		throw new ThemeError(`"${key}" has unknown strokeStyle keyword "${value}"`);
	}
	if (typeof value === "object" && value !== null) return "dashed";
	throw invalid(key, "strokeStyle", value);
}
//#endregion
//#region src/theme.ts
function createThemeComponent(cssText) {
	let escaped = cssText.replace(/<\/style/gi, "<\\/style");
	return function Theme(handle) {
		return () => createElement("style", {
			nonce: handle.props.nonce,
			"data-pitlane-theme": "",
			innerHTML: escaped
		});
	};
}
function createTheme(config, options = {}) {
	let compiled = compile(config, options.modes ?? {});
	let rawByRef = /* @__PURE__ */ new Map();
	let rawByKey = /* @__PURE__ */ new Map();
	for (let token of compiled.tokens.values()) rawByRef.set(`var(${token.varName})`, resolveRaw(token, compiled.tokens, rawByKey, []));
	return {
		token: buildAccessor(compiled.tokens),
		raw(ref) {
			let value = rawByRef.get(ref);
			if (value === void 0) throw new ThemeError(`raw(): "${ref}" names a var this theme never minted`);
			return value;
		},
		Theme: createThemeComponent(compiled.cssText)
	};
}
function compile(config, modes) {
	let tokens = parseTokens(config);
	let ctx = { varRefFor(key, from, expected) {
		let target = tokens.get(key);
		if (!target) throw new ThemeError(`"${from}" references unknown token "${key}"`);
		if (target.type !== expected) throw new ThemeError(`"${from}" references "${key}" of type "${target.type}" where "${expected}" is required`);
		return `var(${target.varName})`;
	} };
	let declarations = /* @__PURE__ */ new Map();
	for (let token of tokens.values()) declarations.set(token.varName, token.aliasOf !== void 0 ? ctx.varRefFor(token.aliasOf, token.key, token.type) : serializeValue(token.type, token.value, ctx, token.key));
	let modeBlocks = [];
	for (let mode of ["light", "dark"]) {
		let overrides = modes[mode];
		if (overrides === void 0) continue;
		let modeDeclarations = compileModeOverrides(overrides, tokens, ctx);
		if (modeDeclarations.size === 0) continue;
		let lines = [...modeDeclarations].map(([name, value]) => `        ${name}: ${value};`);
		modeBlocks.push(`@media (prefers-color-scheme: ${mode}) {\n    :root {\n${lines.join("\n")}\n    }\n}`);
	}
	return {
		tokens,
		cssText: buildCssText(declarations, modeBlocks)
	};
}
function compileModeOverrides(overrides, tokens, ctx) {
	let out = /* @__PURE__ */ new Map();
	walkMode(overrides, [], tokens, ctx, out);
	return out;
}
function walkMode(node, path, tokens, ctx, out) {
	if (typeof node !== "object" || node === null) throw new ThemeError(`Mode override "${path.join(".")}" is neither a group nor a token`);
	let record = node;
	if ("$value" in record) {
		let key = path.join(".");
		if (Object.keys(record).length !== 1) throw new ThemeError(`Mode override "${key}" may only set $value`);
		let base = tokens.get(key);
		if (!base) throw new ThemeError(`Mode override "${key}" does not exist in the base document`);
		let alias = aliasTarget(record.$value);
		out.set(base.varName, alias !== null ? ctx.varRefFor(alias, key, base.type) : serializeValue(base.type, record.$value, ctx, key));
		return;
	}
	for (let [key, child] of Object.entries(record)) {
		if (key.startsWith("$")) throw new ThemeError(`Mode override "${[...path, key].join(".")}" may only set $value`);
		walkMode(child, [...path, key], tokens, ctx, out);
	}
}
function resolveRaw(token, tokens, memo, chain) {
	let cached = memo.get(token.key);
	if (cached !== void 0) return cached;
	if (chain.includes(token.key)) throw new ThemeError(`Alias cycle: ${[...chain, token.key].join(" → ")}`);
	let value;
	if (token.aliasOf !== void 0) {
		let target = tokens.get(token.aliasOf);
		if (!target) throw new ThemeError(`"${token.key}" references unknown token "${token.aliasOf}"`);
		value = resolveRaw(target, tokens, memo, [...chain, token.key]);
	} else value = serializeValue(token.type, token.value, { varRefFor(key, from) {
		let target = tokens.get(key);
		if (!target) throw new ThemeError(`"${from}" references unknown token "${key}"`);
		return resolveRaw(target, tokens, memo, [...chain, token.key]);
	} }, token.key);
	memo.set(token.key, value);
	return value;
}
function buildAccessor(tokens) {
	let root = Object.create(null);
	for (let token of tokens.values()) {
		let node = root;
		for (let segment of token.path.slice(0, -1)) node = node[segment] ??= Object.create(null);
		node[token.path[token.path.length - 1]] = `var(${token.varName})`;
	}
	return root;
}
function buildCssText(declarations, modeBlocks) {
	return [`:root {\n${[...declarations].map(([name, value]) => `    ${name}: ${value};`).join("\n")}\n}`, ...modeBlocks].join("\n\n");
}
//#endregion
//#region src/css.ts
/**
* Brand-typed wrapper over remix/ui's css() mixin. Branded token refs are
* already `var()` strings; tuples join with spaces; everything else passes
* straight through.
*
* The node type parameter is inferred from the `mix` position it is used in
* (`<div mix={css({ … })} />`), mirroring remix/ui's css. Apply css() at the
* element; share ThemedCSSProps objects, not descriptors.
*/
function css(styles) {
	return css$1(normalizeStyles(styles));
}
function normalizeStyles(styles) {
	let out = {};
	for (let [key, value] of Object.entries(styles)) if (Array.isArray(value)) out[key] = value.join(" ");
	else if (typeof value === "object" && value !== null) out[key] = normalizeStyles(value);
	else out[key] = value;
	return out;
}
//#endregion
//#region src/tva.ts
function tva(config) {
	function resolve(props) {
		let selected = { ...config.defaultVariants };
		for (let [key, value] of Object.entries(props ?? {})) if (value !== void 0) selected[key] = value;
		let merged = { ...config.base };
		for (let [name, values] of Object.entries(config.variants ?? {})) {
			let choice = selected[name];
			if (choice === void 0 || choice === null) continue;
			let styles = values[String(choice)];
			if (styles) merged = deepMerge(merged, styles);
		}
		for (let compound of config.compoundVariants ?? []) {
			let { css: compoundCss, ...match } = compound;
			if (Object.entries(match).every(([key, value]) => selected[key] === value)) merged = deepMerge(merged, compoundCss);
		}
		return merged;
	}
	let fn = (props) => css(resolve(props));
	return Object.assign(fn, { resolve });
}
/** Plain objects merge recursively; arrays and primitives replace. */
function deepMerge(a, b) {
	if (!isPlainObject(a) || !isPlainObject(b)) return b;
	let out = { ...a };
	for (let [key, value] of Object.entries(b)) out[key] = key in out ? deepMerge(out[key], value) : value;
	return out;
}
function isPlainObject(value) {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
/** cva-`compose` analog: one css() call over every input's resolved styles. */
function combine(...fns) {
	function resolve(props) {
		let merged = {};
		for (let fn of fns) merged = deepMerge(merged, fn.resolve(props));
		return merged;
	}
	let fn = (props) => css(resolve(props));
	return Object.assign(fn, { resolve });
}
/** clsx-compatible className joiner for the className interop escape hatch. */
function cx(...inputs) {
	let out = [];
	for (let input of inputs) {
		if (!input) continue;
		if (typeof input === "string" || typeof input === "number") out.push(String(input));
		else if (Array.isArray(input)) {
			let inner = cx(...input);
			if (inner) out.push(inner);
		} else if (typeof input === "object") {
			for (let [key, on] of Object.entries(input)) if (on) out.push(key);
		}
	}
	return out.join(" ");
}
//#endregion
export { ThemeError, combine, createTheme, css, cx, tva };

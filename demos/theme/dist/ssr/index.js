import { createElement, css } from "remix/ui";
import { mergeAssets } from "@hiogawa/vite-plugin-fullstack/runtime";
import __assets_manifest from "./__fullstack_assets_manifest.js";
import { jsx, jsxs } from "remix/ui/jsx-runtime";
import { get, route } from "remix/routes";
import { createController, createRouter } from "remix/router";
import { renderWith } from "remix/middleware/render";
import { createHtmlResponse } from "remix/response/html";
import { renderToStream } from "remix/ui/server";
import { staticFiles } from "remix/middleware/static";
//#region ../../packages/theme/dist/index.mjs
var TOKEN_TYPES = [
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
var ThemeError = class extends Error {
	name = "ThemeError";
};
var ALIAS_RE = /^\{([^{}]+)\}$/;
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
var FONT_WEIGHT_KEYWORDS = {
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
var COLOR_FUNCTIONS = {
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
var COLOR_SPACES = new Set([
	"srgb",
	"srgb-linear",
	"display-p3",
	"a98-rgb",
	"prophoto-rgb",
	"rec2020",
	"xyz-d65",
	"xyz-d50"
]);
var STROKE_KEYWORDS = new Set([
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
	if (alias !== null) return ctx.varRefFor(alias, key);
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
	return (Array.isArray(value) ? value : [value]).map((name) => {
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
		return `${field("color", color, ctx, key)} ${position * 100}%`;
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
	for (let token of compiled.tokens.values()) rawByRef.set(`var(${token.varName})`, resolveRaw(token, compiled.tokens, compiled.ctx, rawByKey, []));
	return {
		token: buildAccessor(compiled.tokens),
		raw(ref) {
			let value = rawByRef.get(ref);
			if (value === void 0) throw new ThemeError(`raw(): "${ref}" was not minted by this theme`);
			return value;
		},
		Theme: createThemeComponent(compiled.cssText)
	};
}
function compile(config, modes) {
	let tokens = parseTokens(config);
	let ctx = { varRefFor(key, from) {
		let target = tokens.get(key);
		if (!target) throw new ThemeError(`"${from}" references unknown token "${key}"`);
		return `var(${target.varName})`;
	} };
	let declarations = /* @__PURE__ */ new Map();
	for (let token of tokens.values()) declarations.set(token.varName, token.aliasOf !== void 0 ? ctx.varRefFor(token.aliasOf, token.key) : serializeValue(token.type, token.value, ctx, token.key));
	let modeBlocks = [];
	for (let mode of ["light", "dark"]) {
		let overrides = modes[mode];
		if (overrides === void 0) continue;
		let lines = [...compileModeOverrides(overrides, tokens, ctx)].map(([name, value]) => `        ${name}: ${value};`);
		modeBlocks.push(`@media (prefers-color-scheme: ${mode}) {\n    :root {\n${lines.join("\n")}\n    }\n}`);
	}
	return {
		tokens,
		ctx,
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
		out.set(base.varName, alias !== null ? ctx.varRefFor(alias, key) : serializeValue(base.type, record.$value, ctx, key));
		return;
	}
	for (let [key, child] of Object.entries(record)) {
		if (key.startsWith("$")) throw new ThemeError(`Mode override "${[...path, key].join(".")}" may only set $value`);
		walkMode(child, [...path, key], tokens, ctx, out);
	}
}
function resolveRaw(token, tokens, ctx, memo, chain) {
	let cached = memo.get(token.key);
	if (cached !== void 0) return cached;
	if (chain.includes(token.key)) throw new ThemeError(`Alias cycle: ${[...chain, token.key].join(" → ")}`);
	let value;
	if (token.aliasOf !== void 0) {
		let target = tokens.get(token.aliasOf);
		if (!target) throw new ThemeError(`"${token.key}" references unknown token "${token.aliasOf}"`);
		value = resolveRaw(target, tokens, ctx, memo, [...chain, token.key]);
	} else value = serializeValue(token.type, token.value, ctx, token.key);
	memo.set(token.key, value);
	return value;
}
function buildAccessor(tokens) {
	let root = {};
	for (let token of tokens.values()) {
		let node = root;
		for (let segment of token.path.slice(0, -1)) node = node[segment] ??= {};
		node[token.path[token.path.length - 1]] = `var(${token.varName})`;
	}
	return root;
}
function buildCssText(declarations, modeBlocks) {
	return [`:root {\n${[...declarations].map(([name, value]) => `    ${name}: ${value};`).join("\n")}\n}`, ...modeBlocks].join("\n\n");
}
/**
* Brand-typed wrapper over remix/ui's css() mixin. Branded token refs are
* already `var()` strings; tuples join with spaces; everything else passes
* straight through.
*
* The node type parameter is inferred from the `mix` position it is used in
* (`<div mix={css({ … })} />`), mirroring remix/ui's css. Apply css() at the
* element; share ThemedCSSProps objects, not descriptors.
*/
function css$1(styles) {
	return css(normalizeStyles(styles));
}
function normalizeStyles(styles) {
	let out = {};
	for (let [key, value] of Object.entries(styles)) if (Array.isArray(value)) out[key] = value.join(" ");
	else if (typeof value === "object" && value !== null) out[key] = normalizeStyles(value);
	else out[key] = value;
	return out;
}
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
	let fn = (props) => css$1(resolve(props));
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
	let fn = (props) => css$1(resolve(props));
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
//#region app/theme.ts
/**
* The design system for this demo, defined once as a W3C DTCG token document.
*
* - Semantic tokens (`color.surface`, `color.text`, …) are aliases of the
*   primitive scales. Dark mode overrides only the aliases, and the change
*   cascades through every reference in pure CSS.
* - Both DTCG value forms work: legacy strings ("1rem") and structured
*   objects ({ value: 2.5, unit: "rem" }, { colorSpace: "oklch", … }).
* - Composite tokens (shadow, transition) may alias other tokens in their
*   sub-values — `motion.press` references `{motion.fast}`.
*/
var { token: $, raw, Theme } = createTheme({
	color: {
		$type: "color",
		gray: {
			50: { $value: "oklch(98.5% 0.002 247.839)" },
			200: { $value: "oklch(92.8% 0.006 264.531)" },
			500: { $value: "oklch(55.1% 0.027 264.364)" },
			700: { $value: "oklch(37.3% 0.034 259.733)" },
			900: { $value: "oklch(21% 0.034 264.665)" },
			950: { $value: "oklch(13% 0.028 261.692)" }
		},
		blue: {
			400: { $value: "oklch(70.7% 0.165 254.624)" },
			500: { $value: "oklch(62.3% 0.214 259.815)" },
			600: { $value: "oklch(54.6% 0.245 262.881)" },
			700: { $value: "oklch(42.4% 0.199 265.638)" }
		},
		white: { $value: "#fff" },
		black: { $value: {
			colorSpace: "oklch",
			components: [
				0,
				0,
				0
			]
		} },
		surface: { $value: "{color.white}" },
		panel: { $value: "{color.gray.50}" },
		text: { $value: "{color.gray.900}" },
		muted: { $value: "{color.gray.500}" },
		border: { $value: "{color.gray.200}" },
		accent: { $value: "{color.blue.600}" },
		accentHover: { $value: "{color.blue.700}" }
	},
	space: {
		$type: "dimension",
		xs: { $value: "0.25rem" },
		sm: { $value: "0.5rem" },
		md: { $value: "1rem" },
		lg: { $value: "1.5rem" },
		xl: { $value: {
			value: 2.5,
			unit: "rem"
		} }
	},
	radius: {
		$type: "dimension",
		md: { $value: "8px" },
		full: { $value: "999px" }
	},
	size: {
		$type: "dimension",
		prose: { $value: "44rem" }
	},
	text: {
		$type: "dimension",
		sm: { $value: "0.875rem" },
		md: { $value: "1rem" },
		lg: { $value: "1.125rem" },
		hero: { $value: "2.25rem" }
	},
	weight: {
		$type: "fontWeight",
		regular: { $value: 400 },
		medium: { $value: "medium" },
		bold: { $value: 700 }
	},
	font: {
		$type: "fontFamily",
		sans: { $value: [
			"Inter var",
			"ui-sans-serif",
			"system-ui",
			"sans-serif"
		] }
	},
	motion: {
		fast: {
			$type: "duration",
			$value: "150ms"
		},
		ease: {
			$type: "cubicBezier",
			$value: [
				.25,
				.1,
				.25,
				1
			]
		},
		press: {
			$type: "transition",
			$value: {
				duration: "{motion.fast}",
				timingFunction: [
					.25,
					.1,
					.25,
					1
				]
			}
		}
	},
	shadow: { card: {
		$type: "shadow",
		$value: [{
			color: "oklch(21% 0.034 264.665 / 0.08)",
			offsetX: "0px",
			offsetY: "1px",
			blur: "2px"
		}, {
			color: "oklch(21% 0.034 264.665 / 0.06)",
			offsetX: "0px",
			offsetY: "4px",
			blur: "12px"
		}]
	} }
}, { modes: { dark: { color: {
	surface: { $value: "{color.gray.950}" },
	panel: { $value: "{color.gray.900}" },
	text: { $value: "{color.gray.50}" },
	border: { $value: "{color.gray.700}" },
	accent: { $value: "{color.blue.500}" },
	accentHover: { $value: "{color.blue.400}" }
} } } });
//#endregion
//#region app/components/button.ts
/**
* A cva-style variant component. Every style slot is brand-enforced —
* `backgroundColor: "#ff0000"` would be a type error here.
*/
var button = tva({
	base: {
		display: "inline-flex",
		alignItems: "center",
		justifyContent: "center",
		borderRadius: $.radius.md,
		fontWeight: $.weight.medium,
		border: "1px solid transparent",
		cursor: "pointer",
		transition: `background-color ${$.motion.press}, color ${$.motion.press}`
	},
	variants: {
		intent: {
			primary: {
				backgroundColor: $.color.accent,
				color: $.color.white,
				"&:hover": { backgroundColor: $.color.accentHover }
			},
			secondary: {
				backgroundColor: "transparent",
				color: $.color.text,
				border: `1px solid ${$.color.border}`,
				"&:hover": { backgroundColor: $.color.panel }
			},
			link: {
				backgroundColor: "transparent",
				color: $.color.accent,
				"&:hover": { color: $.color.accentHover }
			}
		},
		size: {
			sm: {
				padding: [$.space.xs, $.space.sm],
				fontSize: $.text.sm
			},
			md: {
				padding: [$.space.sm, $.space.md],
				fontSize: $.text.md
			}
		}
	},
	compoundVariants: [{
		intent: "link",
		size: "md",
		css: { fontSize: $.text.lg }
	}],
	defaultVariants: {
		intent: "primary",
		size: "md"
	}
});
/** `combine` composes tva components — the props union of both. */
var pillButton = combine(button, tva({ variants: { pill: { true: { borderRadius: $.radius.full } } } }));
//#endregion
//#region app/entry.server.tsx?assets=ssr
var entry_server_default = function mergeAssets(...args) {
	const js = uniqBy(args.flatMap((h) => h.js), (a) => a.href);
	const css = uniqBy(args.flatMap((h) => h.css), (a) => a.href);
	const raw = {
		entry: args.filter((arg) => arg.entry)?.[0]?.entry,
		js,
		css
	};
	return {
		...raw,
		merge: (...args$1) => mergeAssets(raw, ...args$1)
	};
	function uniqBy(array, key) {
		const seen = /* @__PURE__ */ new Set();
		return array.filter((item) => {
			const k = key(item);
			if (seen.has(k)) return false;
			seen.add(k);
			return true;
		});
	}
}(__assets_manifest["ssr"]["app/entry.server.tsx"]);
//#endregion
//#region app/index.css?url
var app_default = "/assets/index-0JDmZxKd.css";
//#endregion
//#region app/Document.tsx
function Document(handle) {
	let assets = mergeAssets(entry_server_default);
	return () => {
		let { children } = handle.props;
		return /* @__PURE__ */ jsxs("html", {
			lang: "en",
			mix: css$1({
				backgroundColor: $.color.surface,
				color: $.color.text,
				fontFamily: $.font.sans
			}),
			children: [/* @__PURE__ */ jsxs("head", { children: [
				/* @__PURE__ */ jsx("meta", { charSet: "utf-8" }),
				/* @__PURE__ */ jsx("meta", {
					content: "width=device-width, initial-scale=1",
					name: "viewport"
				}),
				/* @__PURE__ */ jsx("title", { children: "@pitlane/theme demo" }),
				/* @__PURE__ */ jsx("link", {
					href: "/favicon.svg",
					rel: "icon",
					type: "image/svg+xml"
				}),
				/* @__PURE__ */ jsx(Theme, {}),
				/* @__PURE__ */ jsx("link", {
					href: app_default,
					rel: "stylesheet"
				}),
				assets.css.map((attrs) => /* @__PURE__ */ jsx("link", {
					...attrs,
					rel: "stylesheet"
				}, attrs.href))
			] }), /* @__PURE__ */ jsx("body", { children })]
		});
	};
}
//#endregion
//#region app/routes.ts
var routes = route({ home: get("/") });
//#endregion
//#region app/actions/controller.tsx
var swatches = [
	{
		alias: true,
		name: "color.surface",
		ref: $.color.surface
	},
	{
		alias: true,
		name: "color.panel",
		ref: $.color.panel
	},
	{
		alias: true,
		name: "color.text",
		ref: $.color.text
	},
	{
		alias: true,
		name: "color.muted",
		ref: $.color.muted
	},
	{
		alias: true,
		name: "color.border",
		ref: $.color.border
	},
	{
		alias: true,
		name: "color.accent",
		ref: $.color.accent
	},
	{
		alias: false,
		name: "color.blue.500",
		ref: $.color.blue[500]
	},
	{
		alias: false,
		name: "color.gray.900",
		ref: $.color.gray[900]
	}
];
function Home() {
	return () => /* @__PURE__ */ jsxs("main", {
		mix: css$1({
			display: "flex",
			flexDirection: "column",
			gap: $.space.xl,
			maxWidth: $.size.prose,
			margin: [0, "auto"],
			padding: [$.space.xl, $.space.lg]
		}),
		children: [
			/* @__PURE__ */ jsxs("header", {
				mix: css$1({
					display: "flex",
					flexDirection: "column",
					gap: $.space.sm
				}),
				children: [
					/* @__PURE__ */ jsxs("picture", { children: [/* @__PURE__ */ jsx("source", {
						media: "(prefers-color-scheme: dark)",
						srcSet: "/logo-dark.svg"
					}), /* @__PURE__ */ jsx("img", {
						alt: "Pitlane",
						mix: css$1({ height: $.space.xl }),
						src: "/logo-light.svg"
					})] }),
					/* @__PURE__ */ jsx("h1", {
						mix: css$1({
							fontSize: $.text.hero,
							fontWeight: $.weight.bold
						}),
						children: "@pitlane/theme"
					}),
					/* @__PURE__ */ jsxs("p", {
						mix: css$1({
							color: $.color.muted,
							fontSize: $.text.lg
						}),
						children: [
							"One DTCG token document. Typed refs, brand-enforced styles, cva-style variants, and dark mode from a single ",
							/* @__PURE__ */ jsx("code", {
								className: "mono",
								children: "modes"
							}),
							" override — switch your OS color scheme to watch every alias flip."
						]
					})
				]
			}),
			/* @__PURE__ */ jsxs("section", {
				mix: css$1({
					display: "flex",
					flexDirection: "column",
					gap: $.space.md,
					padding: $.space.lg,
					backgroundColor: $.color.panel,
					border: `1px solid ${$.color.border}`,
					borderRadius: $.radius.md,
					boxShadow: $.shadow.card
				}),
				children: [/* @__PURE__ */ jsx("h2", {
					mix: css$1({
						fontSize: $.text.lg,
						fontWeight: $.weight.bold
					}),
					children: "Variants with tva"
				}), /* @__PURE__ */ jsxs("div", {
					mix: css$1({
						display: "flex",
						flexWrap: "wrap",
						alignItems: "center",
						gap: $.space.sm
					}),
					children: [
						/* @__PURE__ */ jsx("button", {
							mix: button({}),
							type: "button",
							children: "Primary"
						}),
						/* @__PURE__ */ jsx("button", {
							mix: button({ intent: "secondary" }),
							type: "button",
							children: "Secondary"
						}),
						/* @__PURE__ */ jsx("button", {
							mix: button({
								intent: "secondary",
								size: "sm"
							}),
							type: "button",
							children: "Small"
						}),
						/* @__PURE__ */ jsx("button", {
							mix: pillButton({
								intent: "primary",
								pill: true
							}),
							type: "button",
							children: "combine(button, rounded)"
						}),
						/* @__PURE__ */ jsx("button", {
							mix: button({ intent: "link" }),
							type: "button",
							children: "Link (compound: md → lg text)"
						})
					]
				})]
			}),
			/* @__PURE__ */ jsxs("section", {
				mix: css$1({
					display: "flex",
					flexDirection: "column",
					gap: $.space.md,
					padding: $.space.lg,
					backgroundColor: $.color.panel,
					border: `1px solid ${$.color.border}`,
					borderRadius: $.radius.md,
					boxShadow: $.shadow.card
				}),
				children: [/* @__PURE__ */ jsx("h2", {
					mix: css$1({
						fontSize: $.text.lg,
						fontWeight: $.weight.bold
					}),
					children: "Tokens, aliases, and raw()"
				}), /* @__PURE__ */ jsx("ul", {
					mix: css$1({
						display: "grid",
						gridTemplateColumns: "repeat(auto-fill, minmax(19rem, 1fr))",
						gap: $.space.sm,
						padding: 0,
						listStyle: "none"
					}),
					children: swatches.map((swatch) => /* @__PURE__ */ jsxs("li", {
						mix: css$1({
							display: "flex",
							flexWrap: "wrap",
							alignItems: "center",
							gap: $.space.sm
						}),
						children: [
							/* @__PURE__ */ jsx("span", { mix: css$1({
								display: "inline-flex",
								width: $.space.lg,
								height: $.space.lg,
								backgroundColor: swatch.ref,
								border: `1px solid ${$.color.border}`,
								borderRadius: $.radius.full
							}) }),
							/* @__PURE__ */ jsx("span", {
								className: cx("mono", swatch.alias && "alias-tag"),
								mix: css$1({ fontSize: $.text.sm }),
								children: swatch.name
							}),
							/* @__PURE__ */ jsx("span", {
								className: "mono",
								mix: css$1({
									fontSize: $.text.sm,
									color: $.color.muted
								}),
								children: raw(swatch.ref)
							})
						]
					}, swatch.name))
				})]
			}),
			/* @__PURE__ */ jsx("footer", {
				mix: css$1({
					display: "flex",
					flexWrap: "wrap",
					alignItems: "center",
					gap: $.space.sm
				}),
				children: /* @__PURE__ */ jsx("a", {
					href: "https://docs.pitlane.tools/package/theme",
					mix: css$1({
						color: $.color.accent,
						"&:hover": { color: $.color.accentHover }
					}),
					children: "Read the docs →"
				})
			})
		]
	});
}
var controller_default = createController(routes, { actions: { async home({ render }) {
	return render(/* @__PURE__ */ jsx(Document, { children: /* @__PURE__ */ jsx(Home, {}) }));
} } });
//#endregion
//#region app/middleware/render.tsx
function render() {
	return renderWith(() => function render(node, init) {
		return createHtmlResponse(renderToStream(node), init);
	});
}
//#endregion
//#region app/entry.server.tsx
var router = createRouter({ middleware: [staticFiles("./public"), render()] });
router.map(routes, controller_default);
//#endregion
export { router as default, router };

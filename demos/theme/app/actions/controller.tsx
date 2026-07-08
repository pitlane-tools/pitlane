import type { ThemedCSSProps } from "@pitlane/theme";

import { button, pillButton } from "#/components/button.ts";
import { Document } from "#/Document.tsx";
import { routes } from "#/routes.ts";
import { $, raw } from "#/theme.ts";
import { css, cx } from "@pitlane/theme";
import { createController } from "remix/router";

// Share style OBJECTS and apply css() at each element: the descriptor css()
// returns binds to the element type of the `mix` position it appears in.
let card: ThemedCSSProps = {
    display: "flex",
    flexDirection: "column",
    gap: $.space.md,
    padding: $.space.lg, // ✓ DimensionToken — `padding: "24px"` would be a type error
    backgroundColor: $.color.panel,
    border: `1px solid ${$.color.border}`,
    borderRadius: $.radius.md,
    boxShadow: $.shadow.card,
};

let heading: ThemedCSSProps = {
    fontSize: $.text.lg,
    fontWeight: $.weight.bold,
};

let row: ThemedCSSProps = {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    gap: $.space.sm,
};

// Semantic tokens rendered as swatches below. `raw()` chases aliases to the
// concrete base-mode value — dark mode swaps the CSS variables, not the code.
let swatches = [
    { alias: true, name: "color.surface", ref: $.color.surface },
    { alias: true, name: "color.panel", ref: $.color.panel },
    { alias: true, name: "color.text", ref: $.color.text },
    { alias: true, name: "color.muted", ref: $.color.muted },
    { alias: true, name: "color.border", ref: $.color.border },
    { alias: true, name: "color.accent", ref: $.color.accent },
    { alias: false, name: "color.blue.500", ref: $.color.blue[500] },
    { alias: false, name: "color.gray.900", ref: $.color.gray[900] },
];

function Home() {
    return () => (
        <main
            mix={css({
                display: "flex",
                flexDirection: "column",
                gap: $.space.xl,
                maxWidth: $.size.prose,
                margin: [0, "auto"],
                padding: [$.space.xl, $.space.lg],
            })}
        >
            <header mix={css({ display: "flex", flexDirection: "column", gap: $.space.sm })}>
                <picture>
                    <source media="(prefers-color-scheme: dark)" srcSet="/logo-dark.svg" />
                    <img alt="Pitlane" mix={css({ height: $.space.xl })} src="/logo-light.svg" />
                </picture>
                <h1 mix={css({ fontSize: $.text.hero, fontWeight: $.weight.bold })}>
                    @pitlane/theme
                </h1>
                <p mix={css({ color: $.color.muted, fontSize: $.text.lg })}>
                    One DTCG token document. Typed refs, brand-enforced styles, cva-style variants,
                    and dark mode from a single <code className="mono">modes</code> override —
                    switch your OS color scheme to watch every alias flip.
                </p>
            </header>

            <section mix={css(card)}>
                <h2 mix={css(heading)}>Variants with tva</h2>
                <div mix={css(row)}>
                    <button mix={button({})} type="button">
                        Primary
                    </button>
                    <button mix={button({ intent: "secondary" })} type="button">
                        Secondary
                    </button>
                    <button mix={button({ intent: "secondary", size: "sm" })} type="button">
                        Small
                    </button>
                    <button mix={pillButton({ intent: "primary", pill: true })} type="button">
                        combine(button, rounded)
                    </button>
                    <button mix={button({ intent: "link" })} type="button">
                        Link (compound: md → lg text)
                    </button>
                </div>
            </section>

            <section mix={css(card)}>
                <h2 mix={css(heading)}>Tokens, aliases, and raw()</h2>
                <ul
                    mix={css({
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fill, minmax(19rem, 1fr))",
                        gap: $.space.sm,
                        padding: 0,
                        listStyle: "none",
                    })}
                >
                    {swatches.map(swatch => (
                        <li key={swatch.name} mix={css(row)}>
                            <span
                                mix={css({
                                    display: "inline-flex",
                                    width: $.space.lg,
                                    height: $.space.lg,
                                    backgroundColor: swatch.ref,
                                    border: `1px solid ${$.color.border}`,
                                    borderRadius: $.radius.full,
                                })}
                            />
                            <span
                                className={cx("mono", swatch.alias && "alias-tag")}
                                mix={css({ fontSize: $.text.sm })}
                            >
                                {swatch.name}
                            </span>
                            <span
                                className="mono"
                                mix={css({ fontSize: $.text.sm, color: $.color.muted })}
                            >
                                {raw(swatch.ref)}
                            </span>
                        </li>
                    ))}
                </ul>
            </section>

            <footer mix={css(row)}>
                <a
                    href="https://docs.pitlane.tools/package/theme"
                    mix={css({
                        color: $.color.accent,
                        "&:hover": { color: $.color.accentHover },
                    })}
                >
                    Read the docs →
                </a>
            </footer>
        </main>
    );
}

export default createController(routes, {
    actions: {
        async home({ render }) {
            return render(
                <Document>
                    <Home />
                </Document>,
            );
        },
    },
});

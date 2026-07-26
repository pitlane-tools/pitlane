import { button, pillButton } from "#/components/button.ts";
import { Document } from "#/Document.tsx";
import { routes } from "#/routes.ts";
import { t, raw } from "#/theme.ts";
import { css, cx } from "@pitlane/theme";
import { createController } from "remix/router";

// Semantic tokens rendered as swatches below. `raw()` chases aliases to the
// concrete base-mode value — dark mode swaps the CSS variables, not the code.
let swatches = [
    { alias: true, name: "color.surface", ref: t.color.surface },
    { alias: true, name: "color.panel", ref: t.color.panel },
    { alias: true, name: "color.text", ref: t.color.text },
    { alias: true, name: "color.muted", ref: t.color.muted },
    { alias: true, name: "color.border", ref: t.color.border },
    { alias: true, name: "color.accent", ref: t.color.accent },
    { alias: false, name: "color.blue.500", ref: t.color.blue[500] },
    { alias: false, name: "color.gray.900", ref: t.color.gray[900] },
];

function Home() {
    return () => (
        <main
            mix={css({
                display: "flex",
                flexDirection: "column",
                gap: t.space.xl,
                maxWidth: t.size.prose,
                margin: [0, "auto"],
                padding: [t.space.xl, t.space.lg],
            })}
        >
            <header mix={css({ display: "flex", flexDirection: "column", gap: t.space.sm })}>
                <picture>
                    <source media="(prefers-color-scheme: dark)" srcSet="/logo-dark.svg" />
                    <img alt="Pitlane" mix={css({ height: t.space.xl })} src="/logo-light.svg" />
                </picture>
                <h1 mix={css({ fontSize: t.text.hero, fontWeight: t.weight.bold })}>
                    @pitlane/theme
                </h1>
                <p mix={css({ color: t.color.muted, fontSize: t.text.lg })}>
                    One DTCG token document. Typed refs, brand-enforced styles, cva-style variants,
                    and dark mode from a single <code className="mono">modes</code> override —
                    switch your OS color scheme to watch every alias flip.
                </p>
            </header>

            <section
                mix={css({
                    display: "flex",
                    flexDirection: "column",
                    gap: t.space.md,
                    padding: t.space.lg, // ✓ DimensionToken — `padding: "24px"` would be a type error
                    backgroundColor: t.color.panel,
                    border: `1px solid ${t.color.border}`,
                    borderRadius: t.radius.md,
                    boxShadow: t.shadow.card,
                })}
            >
                <h2 mix={css({ fontSize: t.text.lg, fontWeight: t.weight.bold })}>
                    Variants with tva
                </h2>
                <div
                    mix={css({
                        display: "flex",
                        flexWrap: "wrap",
                        alignItems: "center",
                        gap: t.space.sm,
                    })}
                >
                    <button mix={button()} type="button">
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

            <section
                mix={css({
                    display: "flex",
                    flexDirection: "column",
                    gap: t.space.md,
                    padding: t.space.lg,
                    backgroundColor: t.color.panel,
                    border: `1px solid ${t.color.border}`,
                    borderRadius: t.radius.md,
                    boxShadow: t.shadow.card,
                })}
            >
                <h2 mix={css({ fontSize: t.text.lg, fontWeight: t.weight.bold })}>
                    Tokens, aliases, and raw()
                </h2>
                <ul
                    mix={css({
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fill, minmax(19rem, 1fr))",
                        gap: t.space.sm,
                        padding: 0,
                        listStyle: "none",
                    })}
                >
                    {swatches.map(swatch => (
                        <li
                            key={swatch.name}
                            mix={css({
                                display: "flex",
                                flexWrap: "wrap",
                                alignItems: "center",
                                gap: t.space.sm,
                            })}
                        >
                            <span
                                mix={css({
                                    display: "inline-flex",
                                    width: t.space.lg,
                                    height: t.space.lg,
                                    backgroundColor: swatch.ref,
                                    border: `1px solid ${t.color.border}`,
                                    borderRadius: t.radius.full,
                                })}
                            />
                            <span
                                className={cx("mono", swatch.alias && "alias-tag")}
                                mix={css({ fontSize: t.text.sm })}
                            >
                                {swatch.name}
                            </span>
                            <span
                                className="mono"
                                mix={css({ fontSize: t.text.sm, color: t.color.muted })}
                            >
                                {raw(swatch.ref)}
                            </span>
                        </li>
                    ))}
                </ul>
            </section>

            <footer
                mix={css({
                    display: "flex",
                    flexWrap: "wrap",
                    alignItems: "center",
                    gap: t.space.sm,
                })}
            >
                <a
                    href="https://docs.pitlane.tools/package/theme"
                    mix={css({
                        color: t.color.accent,
                        "&:hover": { color: t.color.accentHover },
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

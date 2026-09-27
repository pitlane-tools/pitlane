import { css } from "remix/ui";

import { SiteHeader } from "../components/header.tsx";
import { Wordmark } from "../components/logo.tsx";
import { Document } from "../components/shell.tsx";
import { routes } from "../routes.ts";
import { t } from "../theme.ts";
import { LapClock } from "./lap-clock.tsx";
import { home, action, sectionHeading } from "./page-styles.ts";
import { TrackMonitor } from "./track.tsx";
import { Workbench } from "./workbench.tsx";

// The pit wall is a working interface: package controls reveal real code;
// the race is explicitly illustrative, never performance evidence.
export function Home() {
    return () => (
        <Document
            description="Build, style, and ship your Remix app. Independent packages, explicit configuration, your choice of platform."
            title="Your Remix app. Race ready."
            url="/"
        >
            <SiteHeader home search="header" />
            <div data-home mix={home}>
                <main id="main-content" tabindex={-1}>
                    <section aria-labelledby="home-title" data-home-hero>
                        <div data-hero-copy>
                            <div aria-hidden="true" data-home-brand>
                                <Wordmark />
                            </div>
                            <p data-team-label>
                                <span aria-hidden="true">▰</span> Your Remix pit crew
                            </p>
                            <p data-hero-description>
                                Pitlane gives you composable packages to help you put your{" "}
                                <a href="https://remix.run">Remix</a> app on the grid.
                            </p>
                            <div data-hero-actions>
                                <a href={routes.guide.href({ slug: "vite-plugin" })} mix={action}>
                                    Get started <span aria-hidden="true">↗</span>
                                </a>
                                <a data-secondary-action href="#packages">
                                    See all packages <span aria-hidden="true">↓</span>
                                </a>
                            </div>
                        </div>
                        <TrackMonitor />
                    </section>
                    <section aria-labelledby="packages-title" data-home-section id="packages">
                        <div mix={sectionHeading}>
                            <h2 id="packages-title">
                                Composable packages. <span>Built on Web APIs.</span>
                            </h2>
                        </div>
                        <Workbench />
                    </section>
                    <Deployment />
                    <section aria-labelledby="lap-title" data-home-section id="lap-time">
                        <div mix={sectionHeading}>
                            <h2 id="lap-title">
                                A pit crew that can help you deploy in <span>no time flat.</span>
                            </h2>
                        </div>
                        <LapClock />
                    </section>
                    <section aria-labelledby="start-title" data-home-close>
                        <div>
                            <h2 id="start-title">
                                Let’s get you
                                <br />
                                on the grid.
                            </h2>
                        </div>
                        <a href={routes.guide.href({ slug: "vite-plugin" })} mix={action}>
                            Start building with Pitlane <span aria-hidden="true">↗</span>
                        </a>
                    </section>
                </main>
                <footer data-home-footer>
                    <a aria-label="Pitlane home" href="/">
                        <Wordmark />
                    </a>
                    <span>
                        Built with Pitlane, <a href="https://remix.run">Remix</a>,{" "}
                        <a href="https://viteplus.dev">Vite+</a>, &{" "}
                        <a href="https://www.cloudflare.com/products/workers">Cloudflare Workers</a>
                        .
                    </span>
                    <div>
                        <a href="https://github.com/pitlane-tools/pitlane" target="_blank">
                            GitHub ↗
                        </a>
                        <a href="https://bsky.app/profile/pitlane.tools" target="_blank">
                            Bluesky ↗
                        </a>
                        <a
                            href="https://github.com/pitlane-tools/pitlane/blob/main/LICENSE"
                            target="_blank"
                        >
                            MIT License
                        </a>
                    </div>
                </footer>
            </div>
        </Document>
    );
}

let platforms = [
    { name: "Cloudflare", slug: "cloudflare", detail: "workerd" },
    { name: "Netlify", slug: "netlify", detail: "Node.js" },
    { name: "Vercel", slug: "vercel", detail: "Node.js" },
    { name: "Railway", slug: "railway", detail: "Node.js, Bun, or Deno" },
    { name: "Deno Deploy", slug: "deno-deploy", detail: "Deno" },
    { name: "GitHub Pages", slug: "github-pages", detail: "Browser" },
];

function Deployment() {
    return () => (
        <section aria-labelledby="deployment-title" data-deployment data-home-section>
            <div mix={sectionHeading}>
                <h2 id="deployment-title">Pick your circuit.</h2>
                <p>Deploy your Remix app anywhere JavaScript runs.</p>
            </div>
            <div data-deployment-grid>
                <div data-deployment-intro>
                    <span mix={css({ color: t.color.accent })}>Deployment control</span>
                    <p>
                        The same fetch handler.
                        <br />
                        Any JavaScript runtime.
                    </p>
                </div>
                <ul>
                    {platforms.map(platform => (
                        <li key={platform.slug}>
                            <a href={routes.deploy.href({ slug: platform.slug })}>
                                <span>{platform.name}</span>
                                <small>{platform.detail}</small>
                                <span aria-hidden="true">↗</span>
                            </a>
                        </li>
                    ))}
                </ul>
            </div>
        </section>
    );
}

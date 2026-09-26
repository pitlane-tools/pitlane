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
            <SiteHeader search="header" />
            <div data-home mix={home}>
                <main id="main-content" tabindex={-1}>
                    <section aria-labelledby="home-title" data-home-hero>
                        <div data-hero-copy>
                            <p data-team-label>
                                <span aria-hidden="true">▰</span> THE REMIX PIT CREW
                            </p>
                            <h1 id="home-title">
                                Your Remix app.
                                <br />
                                <em>Race ready.</em>
                            </h1>
                            <p data-hero-description>
                                Build, style, and ship. Independent packages that put your Remix app
                                on the grid.
                            </p>
                            <div data-hero-actions>
                                <a href={routes.guide.href({ slug: "vite-plugin" })} mix={action}>
                                    Get started <span aria-hidden="true">↗</span>
                                </a>
                                <a data-secondary-action href="#packages">
                                    Inspect the packages <span aria-hidden="true">↓</span>
                                </a>
                            </div>
                            <div data-hero-footnote>
                                <span>REMIX 3</span>
                                <span>WEB STANDARDS</span>
                                <span>OPEN SOURCE</span>
                            </div>
                        </div>
                        <TrackMonitor />
                    </section>
                    <section aria-labelledby="packages-title" data-home-section id="packages">
                        <div mix={sectionHeading}>
                            <h2 id="packages-title">
                                Your tools. <span>Your setup.</span>
                            </h2>
                            <p>Small packages. Nothing hidden under the hood.</p>
                        </div>
                        <Workbench />
                    </section>
                    <Deployment />
                    <section aria-labelledby="lap-title" data-home-section id="lap-time">
                        <div mix={sectionHeading}>
                            <h2 id="lap-title">
                                A short stop.
                                <br />
                                <span>A long way to go.</span>
                            </h2>
                            <p>From a fresh directory to your first build.</p>
                        </div>
                        <LapClock />
                    </section>
                    <section aria-labelledby="start-title" data-home-close>
                        <div>
                            <p>YOUR NEXT SESSION</p>
                            <h2 id="start-title">
                                Let’s get you
                                <br />
                                on the grid.
                            </h2>
                        </div>
                        <a href={routes.guide.href({ slug: "vite-plugin" })} mix={action}>
                            Build with Pitlane <span aria-hidden="true">↗</span>
                        </a>
                    </section>
                </main>
                <footer data-home-footer>
                    <a aria-label="Pitlane home" href="/">
                        <Wordmark />
                    </a>
                    <span>Built with the tools you’re looking at.</span>
                    <div>
                        <a href="https://github.com/pitlane-tools/pitlane">GitHub ↗</a>
                        <a href="https://github.com/pitlane-tools/pitlane/blob/main/LICENSE">
                            MIT License
                        </a>
                    </div>
                </footer>
            </div>
        </Document>
    );
}

let platforms = [
    { name: "Cloudflare", slug: "cloudflare", detail: "Workers" },
    { name: "Netlify", slug: "netlify", detail: "Functions" },
    { name: "Vercel", slug: "vercel", detail: "Functions" },
    { name: "Railway", slug: "railway", detail: "Node.js" },
    { name: "Deno Deploy", slug: "deno-deploy", detail: "Deno" },
    { name: "GitHub Pages", slug: "github-pages", detail: "Static" },
];

function Deployment() {
    return () => (
        <section aria-labelledby="deployment-title" data-deployment data-home-section>
            <div mix={sectionHeading}>
                <h2 id="deployment-title">Pick your circuit.</h2>
                <p>Your app stays yours. Your platform stays explicit.</p>
            </div>
            <div data-deployment-grid>
                <div data-deployment-intro>
                    <span mix={css({ color: t.color.accent })}>DEPLOYMENT CONTROL</span>
                    <p>
                        One fetch handler.
                        <br />
                        Your choice of host.
                    </p>
                    <a href={routes.deploy.href({ slug: "cloudflare" })}>
                        Find your deployment guide <span aria-hidden="true">↗</span>
                    </a>
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

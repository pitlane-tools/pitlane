import { css } from "@pitlane/theme";

import { t } from "../theme.ts";
import { examples } from "./examples.ts";
import { PackageTabs } from "./package-tabs.tsx";
import { workbench } from "./workbench-styles.ts";

export function Workbench() {
    return () => (
        <div mix={workbench}>
            <div data-workbench-bar>
                <span>PACKAGE INSPECTOR</span>
                <span>5 independent packages</span>
            </div>
            <div>
                <PackageTabs
                    options={examples.map(({ id, name, purpose }) => ({ id, name, purpose }))}
                />
                <p data-package-note>
                    Take what you need.
                    <br />
                    Leave what you don’t.
                </p>
            </div>
            <div data-package-panels>
                {examples.map(example => (
                    <section
                        aria-labelledby={`package-tab-${example.id}`}
                        data-code-package={example.id}
                        id={`package-panel-${example.id}`}
                        key={example.id}
                        role="tabpanel"
                        tabindex={0}
                    >
                        <h3>{example.purpose}</h3>
                        <p>{example.description}</p>
                        <div innerHTML={example.html} />
                        <a href={example.href}>
                            Explore {example.name} <span aria-hidden="true">↗</span>
                        </a>
                    </section>
                ))}
            </div>
            <div data-workbench-footer>
                <span>EXPLICIT CONFIGURATION</span>
                <span mix={css({ color: t.color.callout.tip.title })}>YOURS TO COMPOSE</span>
            </div>
        </div>
    );
}

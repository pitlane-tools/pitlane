import { css } from "@pitlane/theme";

import { t } from "../theme.ts";
import { examples } from "./examples.ts";
import { workbench } from "./workbench-styles.ts";

export function Workbench() {
    return () => (
        <div mix={workbench}>
            <div data-workbench-bar>
                <span>PACKAGE INSPECTOR</span>
                <span>5 independent packages</span>
            </div>
            <fieldset>
                <legend>Select a package</legend>
                {examples.map((example, index) => (
                    <label key={example.id}>
                        <input
                            checked={index === 0}
                            name="homepage-package"
                            type="radio"
                            value={example.id}
                        />
                        <span>
                            <strong>{example.name}</strong>
                            <small>{example.purpose}</small>
                        </span>
                    </label>
                ))}
                <p data-package-note>
                    Take what you need.
                    <br />
                    Leave what you don’t.
                </p>
            </fieldset>
            <div data-package-panels>
                {examples.map(example => (
                    <section data-code-package={example.id} key={example.id}>
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

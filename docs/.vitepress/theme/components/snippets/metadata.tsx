// @ts-nocheck
import { Head } from "pitlane/metadata";
import { createController } from "remix/router";

import styles from "./assets/index.css?url";
import { SITE } from "./site/data.ts";

export default createController(routes.about, {
    actions: {
        async index({ render }) {
            let title = "About Me";

            return await render(
                <Document breadcrumbs>
                    <Head>
                        <title>{`${title} | ${SITE.title}`}</title>
                        <link
                            data-precedence="route"
                            href={styles}
                            rel="stylesheet"
                        />
                    </Head>
                    <AboutPage />
                </Document>,
            );
        },
    },
});

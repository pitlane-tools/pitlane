// @ts-nocheck
import { env } from "cloudflare:workers";
import { D1DatabaseAdapter } from "pitlane/data-table-d1";
import { Database } from "remix/data-table";
import { createController } from "remix/router";

let adapter = new D1DatabaseAdapter(env.DB);
let db = new Database(adapter);

export default createController(routes.contacts, {
    actions: {
        async index({ render }) {
            let contacts = await db.findMany(Contacts);

            return await render(
                <Document breadcrumbs>
                    <Head>
                        <title>{`All Contacts (${contacts.length}) | Address Book`}</title>
                        <link
                            data-precedence="route"
                            href={styles}
                            rel="stylesheet"
                        />
                    </Head>
                    <ContactsList
                        contacts={contacts}
                    />
                </Document>,
            );
        },
    },
});

// @ts-nocheck
import { env } from "cloudflare:workers";
import { D1DatabaseAdapter } from "pitlane/data-table-d1";
import { Database } from "remix/data-table";

let adapter = new D1DatabaseAdapter(env.DB);
let db = new Database(adapter);

router.map(routes.contacts.list, async () =>
    Response.json(await db.findMany(Contacts)),
);

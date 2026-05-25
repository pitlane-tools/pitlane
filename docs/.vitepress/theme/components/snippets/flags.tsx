// @ts-nocheck
import { env } from "cloudflare:workers";
import { createFeatures, flags } from "pitlane/flags";
import * as flag from "pitlane/flags/schema";
import * as s from "remix/data-schema";
import { createController } from "remix/router";

let features = createFeatures({
    newCheckout: {
        name: "new-checkout",
        input: {
            userId: flag.header(
                "x-user-id",
                s.defaulted(s.string(), "anonymous"),
            ),
            plan: flag.header(
                "x-plan",
                s.defaulted(s.string(), "free"),
            ),
        },
        output: s.defaulted(s.boolean(), false),
    },
});

export default createController(routes.shop, {
    middleware: [flags(env.FLAGS)],
    actions: {
        async checkout({ headers, flags, render }) {
            let useNewCheckout = await flags.get(
                features.newCheckout,
            );
            if (useNewCheckout)
                return await render(<NewCheckout />);
            return await render(<Checkout />);
        },
    },
});

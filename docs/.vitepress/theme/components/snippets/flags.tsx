// @ts-nocheck
import { env } from "cloudflare:workers";
import { createFeatures, Flags, flag } from "pitlane/flags";
import * as s from "remix/data-schema";
import { createController } from "remix/router";
import { render } from "./utils/render.ts";

let features = createFeatures({
    newCheckout: {
        name: "new-checkout",
        input: {
            userId: flag.header("x-user-id", s.defaulted(s.string(), "anonymous")),
            plan: flag.header("x-plan", s.defaulted(s.string(), "free")),
        },
        output: s.defaulted(s.boolean(), false),
    },
});

export default createController(routes.shop, {
    middleware: [flags(env.FLAGS)],
    actions: {
        async checkout({ headers, flags }) {
            let useNewCheckout = await flags.get(features.newCheckout);
            if (useNewCheckout) return render(<NewCheckout />);
            return render(<Checkout />);
        },
    },
});

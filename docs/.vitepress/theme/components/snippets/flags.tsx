// @ts-nocheck
import { env } from "cloudflare:workers";
import { createFeatures, Flags } from "pitlane/flags";
import * as s from "remix/data-schema";

let features = createFeatures({
    newCheckout: {
        name: "new-checkout",
        input: s.object({
            userId: s.string(),
            plan: s.string(),
        }),
        output: s.defaulted(s.boolean(), false),
    },
});

let flags = new Flags(env.FLAGS);

router.map(routes.shop.checkout, async context => {
    let userId =
        context.headers.get("x-user-id") ??
        "anonymous";
    let plan = context.headers.get("x-plan") ?? "free";

    let useNewCheckout = await flags.get(
        features.newCheckout,
        { userId, plan },
    );

    if (useNewCheckout) {
        return render(<NewCheckout />);
    }

    return render(<Checkout />);
});

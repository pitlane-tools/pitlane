import { setTimeout as delay } from "node:timers/promises";

// In-memory cart state, as in the upstream example.
let cartStates: Record<string, boolean> = {};

export async function handleCartAction(request: Request): Promise<Response> {
    await delay(200 * (1 + Math.random()));

    let formData = await request.formData();
    let name = formData.get("name");
    let action = formData.get("action");
    if (typeof name !== "string") throw new Error("missing name");

    if (action === "add") {
        cartStates[name] = true;
    } else if (action === "remove") {
        cartStates[name] = false;
    } else {
        throw new Error("invalid action");
    }

    if (formData.get("redirect") === "none") {
        return new Response(null, { status: 204 });
    }

    return Response.redirect(new URL("/books", request.url), 303);
}

export function isInCart(name: string): boolean {
    return cartStates[name] === true;
}

// @ts-nocheck
import { env } from "cloudflare:workers";
import { AI, createTool } from "pitlane/ai";
import { kimi } from "pitlane/ai-moonshot";
import * as s from "remix/data-schema";

let ai = new AI(env.AI);

let weather = createTool({
    name: "get_weather",
    description: "Get the weather in a location",
    schema: s.object({
        location: s.string(),
    }),
    async handle({ location }) {
        return getWeatherFor(location);
    },
});

router.map(routes.messages, () => {
    let stream = ai.stream({
        model: kimi("k2.6"),
        prompt: "What's the temperature in Dallas?",
        tools: [weather],
    });

    return new Response(stream, {
        headers: {
            "Content-Type": "text/event-stream",
        },
    });
});

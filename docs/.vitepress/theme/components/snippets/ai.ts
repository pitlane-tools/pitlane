// @ts-nocheck
import { env } from "cloudflare:workers";
import { AI, createTool } from "pitlane/ai";
import { gemma } from "pitlane/ai-google";
import * as s from "remix/data-schema";
import { createController } from "remix/router";

let ai = new AI(env.AI);

let weather = createTool({
    name: "get_weather",
    description: "Get the weather in a location",
    schema: s.object({
        location: s.string(),
    }),
    async handle({ location }) {
        return await getWeather(location);
    },
});

export default createController(routes.messages, {
    actions: {
        async create({ formData }) {
            let { prompt } = s.parse(
                f.object({
                    prompt: f.field(
                        s.defaulted(
                            s.string(),
                            "What's the temperature in Dallas?",
                        ),
                    ),
                }),
                formData,
            );

            let stream = ai.stream({
                model: gemma("4-26b-a4b-it"),
                prompt,
                tools: [weather],
            });

            return new Response(stream, {
                headers: {
                    "Content-Type":
                        "text/event-stream",
                },
            });
        },
    },
});

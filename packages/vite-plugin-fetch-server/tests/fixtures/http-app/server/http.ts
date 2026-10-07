// A framework-free application server module: its default export is an
// object whose `fetch` method reads `this`, so it only works when called with
// that object as its receiver.

interface FixtureState {
    releaseStream?: () => void;
    failStream?: () => void;
    cancellation?: { signalAborted: boolean; bodyCancelled: boolean };
}

declare global {
    // Survives module re-evaluation, so state outlives a single import.
    var __fetchServerFixture: FixtureState | undefined;
}

let state = (globalThis.__fetchServerFixture ??= {});

let encoder = new TextEncoder();

export default {
    label: "fixture-handler",
    version: "v1",

    async fetch(request: Request): Promise<Response> {
        let url = new URL(request.url);

        switch (url.pathname) {
            case "/":
                return new Response("fixture home");

            case "/receiver":
                return new Response(this.label);

            case "/version":
                return new Response(this.version);

            case "/echo":
            // The base test serves under `base: "/app/"`. The handler sees the
            // full original path, so that route is spelled out here.
            case "/app/echo":
                return Response.json({
                    method: request.method,
                    url: request.url,
                    body: await request.text(),
                    header: request.headers.get("x-fixture"),
                });

            case "/created":
                return new Response("made", {
                    status: 201,
                    statusText: "Made",
                    headers: [
                        ["x-fixture", "created"],
                        ["set-cookie", "a=1"],
                        ["set-cookie", "b=2"],
                    ],
                });

            case "/stream":
                return new Response(
                    new ReadableStream<Uint8Array>({
                        start(controller) {
                            controller.enqueue(encoder.encode("first\n"));
                            state.releaseStream = () => {
                                controller.enqueue(encoder.encode("second\n"));
                                controller.close();
                            };
                        },
                    }),
                );

            case "/stream/release":
                state.releaseStream?.();
                state.releaseStream = undefined;
                return new Response(null, { status: 204 });

            case "/cancel": {
                let record = { signalAborted: false, bodyCancelled: false };
                state.cancellation = record;
                request.signal.addEventListener("abort", () => (record.signalAborted = true));
                return new Response(
                    new ReadableStream<Uint8Array>({
                        start(controller) {
                            controller.enqueue(encoder.encode("started\n"));
                        },
                        cancel() {
                            record.bodyCancelled = true;
                        },
                    }),
                );
            }

            case "/cancellation":
                return Response.json(state.cancellation ?? null);

            case "/throws":
                throw new Error("fixture handler failed");

            case "/stream/fails":
                return new Response(
                    new ReadableStream<Uint8Array>({
                        start(controller) {
                            controller.enqueue(encoder.encode("partial\n"));
                            state.failStream = () => controller.error(new Error("stream broke"));
                        },
                    }),
                );

            case "/stream/fail":
                state.failStream?.();
                state.failStream = undefined;
                return new Response(null, { status: 204 });

            default:
                return new Response("not found from fixture", { status: 404 });
        }
    },
};

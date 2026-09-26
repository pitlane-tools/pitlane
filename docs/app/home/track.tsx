import { css } from "@pitlane/theme";
import { clientEntry, type Handle, on, ref } from "remix/ui";

import { TURNS } from "./mosport.ts";
import {
    DIRECTION,
    KEYFRAMES,
    LAP_MS,
    PIT_LANE,
    RUNNERS,
    START_LINE,
    TRACK,
} from "./track-geometry.ts";
import {
    car,
    centreLine,
    controlStyle,
    figure,
    lead,
    map,
    mark,
    pitLane,
    track,
    turnLabel,
} from "./track-styles.ts";

/** Every car follows the circuit's own path data. */
let motion = css<SVGGElement>({ offsetPath: `path("${TRACK}")` });

/**
 * An illustrative track map in the manner of a pit wall's GPS monitor: the
 * red Pitlane car leads three anonymous cars around the Grand Prix circuit at
 * Canadian Tire Motorsport Park (Mosport). The server draws the formation
 * still; the client starts one set of animations, all driven by the same lap
 * curve, and pauses them while the figure is off screen, the page is hidden,
 * the reader pauses, or the reader asks for reduced motion.
 */
export let TrackMonitor = clientEntry(import.meta.url, (handle: Handle) => {
    let root: Element | undefined;
    let cars: SVGGElement[] = [];
    let animations: Animation[] = [];
    // Whether the reader wants the cars moving. The server renders them still.
    let playing = false;
    let inView = false;

    function sync() {
        let running = playing && inView && document.visibilityState === "visible";
        if (running && animations.length === 0) {
            animations = cars.map((element, index) =>
                element.animate(KEYFRAMES, {
                    duration: LAP_MS,
                    iterations: Infinity,
                    iterationStart: RUNNERS[index]!.phase,
                }),
            );
        }
        for (let animation of animations) {
            if (running) animation.play();
            else animation.pause();
        }
    }

    function choose(next: boolean) {
        playing = next;
        sync();
        void handle.update();
    }

    handle.queueTask(() => {
        let reduced = matchMedia("(prefers-reduced-motion: reduce)");
        reduced.addEventListener("change", () => reduced.matches && choose(false), {
            signal: handle.signal,
        });
        document.addEventListener("visibilitychange", sync, { signal: handle.signal });
        let observer = new IntersectionObserver(entries => {
            inView = entries.at(-1)!.isIntersecting;
            sync();
        });
        if (root) observer.observe(root);
        handle.signal.addEventListener("abort", () => {
            observer.disconnect();
            for (let animation of animations) animation.cancel();
        });
        choose(!reduced.matches);
    });

    return () => (
        <figure
            mix={[
                figure,
                ref(node => {
                    root = node;
                }),
            ]}
        >
            <div data-track-bar>
                <span>Track map · Mosport</span>
                <button mix={[controlStyle, on("click", () => choose(!playing))]} type="button">
                    <svg aria-hidden="true" viewBox="0 0 12 12">
                        {playing ? (
                            <path d="M2.5 1.5h2.5v9H2.5zM7 1.5h2.5v9H7z" />
                        ) : (
                            <path d="M3 1.5l7 4.5-7 4.5z" />
                        )}
                    </svg>
                    {playing ? "Pause" : "Play"}
                </button>
            </div>
            <svg
                aria-label="Map of the Grand Prix circuit at Canadian Tire Motorsport Park (Mosport), turns 1 to 10 numbered clockwise from the start/finish line: the red Pitlane car leads three grey anonymous cars in an illustrative race."
                mix={map}
                role="img"
                viewBox="-16 -16 632 392"
            >
                <path d={TRACK} mix={track} />
                <path d={TRACK} mix={centreLine} />
                <path d={PIT_LANE} mix={pitLane} />
                <line {...START_LINE} data-mark="start" mix={mark} />
                <path d={DIRECTION} data-mark="direction" mix={mark} />
                {TURNS.map(turn => (
                    <text mix={turnLabel} x={turn.x} y={turn.y}>
                        {turn.name}
                    </text>
                ))}
                {RUNNERS.map((runner, index) => (
                    <g
                        mix={[
                            motion,
                            runner.leader ? lead : car,
                            ref(node => {
                                cars[index] = node as SVGGElement;
                            }),
                        ]}
                        style={{ "--distance": runner.distance }}
                    >
                        {runner.leader ? <circle r="11" /> : null}
                        <circle r={runner.leader ? 6.5 : 5} />
                    </g>
                ))}
            </svg>
            <ul data-track-legend>
                <li data-runner="lead">P1 Pitlane</li>
                <li data-runner="field">P2–P4 Anonymous field</li>
            </ul>
            <figcaption>
                Canadian Tire Motorsport Park, Grand Prix circuit · Illustrative race · not a
                benchmark
            </figcaption>
        </figure>
    );
});

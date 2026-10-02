import { css } from "@pitlane/theme";
import { clientEntry, type Handle, ref } from "remix/component";

import { t } from "../theme.ts";
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
 * curve, and pauses them while the figure is off screen or the page is
 * hidden. A reader who asks for reduced motion keeps the formation still.
 */
export let TrackMonitor = clientEntry(import.meta.url, (handle: Handle) => {
    let root: Element | undefined;
    let cars: SVGGElement[] = [];
    let animations: Animation[] = [];
    let inView = false;

    handle.queueTask(() => {
        let reduced = matchMedia("(prefers-reduced-motion: reduce)");

        function sync() {
            if (reduced.matches) {
                for (let animation of animations) animation.cancel();
                animations = [];
                return;
            }
            let running = inView && document.visibilityState === "visible";
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

        reduced.addEventListener("change", sync, { signal: handle.signal });
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
                <span>Grand Prix Circuit · Motorsport Park</span>
            </div>
            <svg
                aria-label="Map of the Grand Prix circuit at Canadian Tire Motorsport Park, turns 1 to 10 numbered clockwise from the start/finish line: the red Pitlane car leads three grey anonymous cars in an illustrative race."
                mix={map}
                role="img"
                viewBox="-16 -16 632 392"
            >
                <path d={TRACK} mix={track} />
                <path d={TRACK} mix={centreLine} />
                <path d={PIT_LANE} mix={pitLane} />
                <line {...START_LINE} mix={css({ stroke: t.color.canvas, strokeWidth: 7 })} />
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
                <li data-runner="lead">P1 Remix + Pitlane</li>
                <li data-runner="field">P2–P4 Other frameworks</li>
            </ul>
        </figure>
    );
});

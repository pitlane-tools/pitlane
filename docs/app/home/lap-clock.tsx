import { css } from "@pitlane/theme";
import { clientEntry, type Handle, ref } from "remix/component";

import { routes } from "../routes.ts";
import { SECTORS } from "./lap-sequence.ts";
import {
    barStyle,
    boardStyle,
    captionStyle,
    clockStyle,
    command,
    footStyle,
    label,
    linkStyle,
    marker,
    readoutStyle,
    row,
    rowsStyle,
    sectorLabel,
    split,
    status,
    stripStyle,
} from "./lap-styles.ts";

/** When each sector ends, from the start of the lap. */
const ENDS = SECTORS.reduce<number[]>(
    (ends, { split }) => [...ends, (ends.at(-1) ?? 0) + split],
    [],
);
const LAP = ENDS.at(-1) ?? 0;
/** How long a finished lap stays on the board before the next one starts. */
const HOLD = 2000;

type SectorState = "done" | "live" | "pending";

const STATE_LABELS: Record<Exclude<SectorState, "done">, string> = {
    live: "Running",
    pending: "Waiting",
};

/** A lap time: `00:21.70`. */
function lapTime(ms: number): string {
    let total = Math.floor(ms / 10);
    let minutes = String(Math.floor(total / 6000)).padStart(2, "0");
    let seconds = String(Math.floor((total % 6000) / 100)).padStart(2, "0");
    return `${minutes}:${seconds}.${String(total % 100).padStart(2, "0")}`;
}

/** The sector running at `ms` into the lap, or -1 once the lap is over. */
function sectorAt(ms: number): number {
    return ENDS.findIndex(end => ms < end);
}

/**
 * The template's lap from scaffold to build: four real commands against a
 * running clock. The markup is the finished lap. In a browser the laps start
 * when the board scrolls into view and repeat, each finished lap held for a
 * moment, unless the reader prefers reduced motion. The clock stops while the
 * board is off screen or the tab is hidden.
 */
export let LapClock = clientEntry(import.meta.url, (handle: Handle) => {
    /** Time into the current lap and the hold after it. */
    let elapsed = LAP;
    /** Whether the laps have started and the reader has not asked for less motion. */
    let looping = false;
    /** `performance.now()` at the lap's zero, while the timer runs. */
    let origin = 0;
    let frame = 0;
    let onScreen = false;
    let board: HTMLElement | undefined;
    let clock: HTMLElement | undefined;
    let timestamps: HTMLElement[] = [];

    // The clock writes its own text between renders; a render happens only
    // when a sector changes hands or a lap starts.
    function showTime() {
        let timestamp = lapTime(Math.min(elapsed, LAP));
        let text = clock?.firstChild;
        if (text && text.nodeValue !== timestamp) text.nodeValue = timestamp;
        let activeTime = timestamps[sectorAt(elapsed)]?.firstChild;
        if (activeTime && activeTime.nodeValue !== timestamp) activeTime.nodeValue = timestamp;
    }

    function halt() {
        window.cancelAnimationFrame(frame);
        frame = 0;
    }

    function tick() {
        let sector = sectorAt(elapsed);
        let now = performance.now();
        elapsed = now - origin;
        if (elapsed >= LAP + HOLD) {
            origin = now;
            elapsed = 0;
        }
        showTime();
        if (sectorAt(elapsed) !== sector) void handle.update();
        frame = window.requestAnimationFrame(tick);
    }

    /** Runs the timer while the laps loop and the reader can see them. */
    function drive() {
        halt();
        if (!looping || !onScreen || document.hidden) return;
        origin = performance.now() - elapsed;
        frame = window.requestAnimationFrame(tick);
    }

    handle.queueTask(() => {
        if (!board) return;
        let reduced = matchMedia("(prefers-reduced-motion: reduce)");

        function sync() {
            if (reduced.matches) {
                looping = false;
                elapsed = LAP;
            } else if (onScreen && !looping) {
                looping = true;
                elapsed = 0;
            }
            showTime();
            drive();
            void handle.update();
        }

        reduced.addEventListener("change", sync, { signal: handle.signal });
        // The laps start once the board clears the bottom quarter of the screen.
        let observer = new IntersectionObserver(
            ([entry]) => {
                onScreen = entry?.isIntersecting ?? false;
                sync();
            },
            { rootMargin: "0px 0px -25% 0px" },
        );
        observer.observe(board);
        document.addEventListener("visibilitychange", drive, { signal: handle.signal });
        handle.signal.addEventListener("abort", () => {
            observer.disconnect();
            halt();
        });
    });

    return () => {
        let current = sectorAt(elapsed);
        let lap = SECTORS.map((sector, index) => {
            let state: SectorState = "live";
            if (current === -1 || index < current) state = "done";
            else if (index > current) state = "pending";
            let total = current === -1 && index === SECTORS.length - 1;
            return { ...sector, number: index + 1, state, total };
        });

        return (
            <div
                mix={[
                    boardStyle,
                    ref(node => {
                        board = node;
                    }),
                ]}
            >
                <div mix={barStyle}>
                    <span>Cloudflare template</span>
                    <span>{SECTORS.length} laps</span>
                </div>
                <div mix={readoutStyle}>
                    <div>
                        <p id={`${handle.id}-lap`} mix={css(label)}>
                            Lap
                        </p>
                        <span
                            aria-labelledby={`${handle.id}-lap`}
                            mix={[
                                clockStyle,
                                ref(node => {
                                    clock = node;
                                }),
                            ]}
                            role="timer"
                        >
                            {lapTime(Math.min(elapsed, LAP))}
                        </span>
                        <p mix={captionStyle}>Illustrative sequence · not a benchmark</p>
                    </div>
                    <ol aria-hidden="true" mix={stripStyle}>
                        {lap.map(sector => (
                            <li key={sector.command}>
                                <span mix={css(label)}>L{sector.number}</span>
                                <span mix={marker<HTMLSpanElement>({ state: sector.state })} />
                            </li>
                        ))}
                    </ol>
                </div>
                <ol aria-label="Commands" mix={rowsStyle}>
                    {lap.map(sector => (
                        <li
                            key={sector.command}
                            mix={row<HTMLLIElement>({ state: sector.state, total: sector.total })}
                        >
                            <span mix={sectorLabel<HTMLSpanElement>({ total: sector.total })}>
                                L{sector.number}
                            </span>
                            <span
                                data-lap-time
                                mix={[
                                    split<HTMLSpanElement>({
                                        state: sector.state,
                                        total: sector.total,
                                    }),
                                    ref(node => {
                                        timestamps[sector.number - 1] = node;
                                    }),
                                ]}
                            >
                                {sector.state === "pending"
                                    ? "\u00a0"
                                    : lapTime(
                                          sector.state === "done"
                                              ? ENDS[sector.number - 1]!
                                              : elapsed,
                                      )}
                            </span>
                            <pre
                                mix={command<HTMLPreElement>({ total: sector.total })}
                                tabindex={0}
                            >
                                <code>{sector.command}</code>
                            </pre>
                            <span
                                mix={status<HTMLSpanElement>({
                                    state: sector.state,
                                    total: sector.total,
                                })}
                            >
                                {sector.state === "done"
                                    ? sector.result
                                    : STATE_LABELS[sector.state]}
                            </span>
                        </li>
                    ))}
                </ol>
                <div mix={footStyle}>
                    <a href={routes.deploy.href({ slug: "cloudflare" })} mix={linkStyle}>
                        Deploy on Cloudflare Workers →
                    </a>
                </div>
            </div>
        );
    };
});

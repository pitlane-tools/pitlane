import { css } from "@pitlane/theme";
import { clientEntry, type Handle, on, ref } from "remix/ui";

import { routes } from "../routes.ts";
import { visuallyHidden } from "../styles/controls.ts";
import { SECTORS } from "./lap-sequence.ts";
import {
    barStyle,
    boardStyle,
    buttonStyle,
    captionStyle,
    clockStyle,
    commandStyle,
    controlsStyle,
    footStyle,
    label,
    linkStyle,
    marker,
    readoutStyle,
    row,
    rowsStyle,
    sectorStyle,
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

type Mode = "complete" | "running" | "paused";
type SectorState = "done" | "live" | "paused" | "pending";

const STATE_LABELS: Record<Exclude<SectorState, "done">, string> = {
    live: "Running",
    paused: "Paused",
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
 * running clock. The markup is the finished lap. In a browser the lap runs
 * once when the board scrolls into view, unless the reader prefers reduced
 * motion, and Replay runs it again on request. The clock stops while the
 * board is off screen or the tab is hidden.
 */
export let LapClock = clientEntry(import.meta.url, (handle: Handle) => {
    let mode: Mode = "complete";
    let elapsed = LAP;
    /** `performance.now()` at the lap's zero, while the timer runs. */
    let origin = 0;
    let frame = 0;
    let onScreen = false;
    /** Whether the lap has run once, by itself or on request. */
    let started = false;
    /** Whether the reader started the current run, so its end is worth announcing. */
    let requested = false;
    let announcement = "";
    let board: HTMLElement | undefined;
    let clock: HTMLElement | undefined;
    let timestamps: HTMLElement[] = [];

    // The clock writes its own text between renders; a render happens only
    // when a sector changes hands or the reader acts.
    function showTime() {
        let timestamp = lapTime(elapsed);
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
        elapsed = Math.min(performance.now() - origin, LAP);
        if (elapsed >= LAP) {
            frame = 0;
            mode = "complete";
            announcement = requested ? `Lap complete in ${lapTime(LAP)}` : "";
            void handle.update();
            return;
        }
        showTime();
        if (sectorAt(elapsed) !== sector) void handle.update();
        frame = window.requestAnimationFrame(tick);
    }

    /** Runs the timer while the lap is running and the reader can see it. */
    function drive() {
        halt();
        if (mode !== "running" || !onScreen || document.hidden) return;
        origin = performance.now() - elapsed;
        frame = window.requestAnimationFrame(tick);
    }

    function start() {
        started = true;
        elapsed = 0;
        mode = "running";
        showTime();
        drive();
        void handle.update();
    }

    function replay() {
        requested = true;
        announcement = "Lap restarted";
        start();
    }

    function pauseOrResume() {
        if (mode === "complete") return;
        if (mode === "running") {
            halt();
            mode = "paused";
            announcement = `Paused at ${lapTime(elapsed)}`;
        } else {
            mode = "running";
            announcement = "Resumed";
            drive();
        }
        void handle.update();
    }

    handle.queueTask(() => {
        if (!board) return;
        let reduced = matchMedia("(prefers-reduced-motion: reduce)");
        reduced.addEventListener(
            "change",
            () => {
                if (reduced.matches && mode === "running") pauseOrResume();
            },
            { signal: handle.signal },
        );
        // The lap starts once the board clears the bottom quarter of the screen.
        let observer = new IntersectionObserver(
            ([entry]) => {
                onScreen = entry?.isIntersecting ?? false;
                if (onScreen && !started && !reduced.matches) start();
                else drive();
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
        let current = mode === "complete" ? -1 : sectorAt(elapsed);
        let lap = SECTORS.map((sector, index) => {
            let state: SectorState = "live";
            if (current === -1 || index < current) state = "done";
            else if (index > current) state = "pending";
            else if (mode === "paused") state = "paused";
            return { ...sector, number: index + 1, state };
        });
        let idle = mode === "complete";

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
                    <span>{SECTORS.length} sectors</span>
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
                            {lapTime(elapsed)}
                        </span>
                        <p mix={captionStyle}>Illustrative sequence · not a benchmark</p>
                    </div>
                    <ol aria-hidden="true" mix={stripStyle}>
                        {lap.map(sector => (
                            <li key={sector.command}>
                                <span mix={css(label)}>S{sector.number}</span>
                                <span mix={marker<HTMLSpanElement>({ state: sector.state })} />
                            </li>
                        ))}
                    </ol>
                </div>
                <ol aria-label="Commands" mix={rowsStyle}>
                    {lap.map(sector => (
                        <li key={sector.command} mix={row<HTMLLIElement>({ state: sector.state })}>
                            <span mix={sectorStyle}>S{sector.number}</span>
                            <span
                                data-lap-time
                                mix={[
                                    split<HTMLSpanElement>({ state: sector.state }),
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
                            <pre mix={commandStyle} tabindex={0}>
                                <code>{sector.command}</code>
                            </pre>
                            <span mix={status<HTMLSpanElement>({ state: sector.state })}>
                                {sector.state === "done"
                                    ? sector.result
                                    : STATE_LABELS[sector.state]}
                            </span>
                        </li>
                    ))}
                </ol>
                <div mix={footStyle}>
                    <div mix={controlsStyle}>
                        <button
                            aria-label="Replay lap"
                            mix={[buttonStyle, on("click", replay)]}
                            type="button"
                        >
                            Replay
                        </button>
                        <button
                            aria-disabled={idle ? "true" : undefined}
                            aria-label={mode === "paused" ? "Resume lap clock" : "Pause lap clock"}
                            mix={[buttonStyle, on("click", pauseOrResume)]}
                            type="button"
                        >
                            {mode === "paused" ? "Resume" : "Pause"}
                        </button>
                    </div>
                    <a href={routes.deploy.href({ slug: "cloudflare" })} mix={linkStyle}>
                        Deploy it to Cloudflare Workers →
                    </a>
                </div>
                <span mix={css(visuallyHidden)} role="status">
                    {announcement}
                </span>
            </div>
        );
    };
});

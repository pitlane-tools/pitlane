import { clientEntry, css, type Handle, ref } from "remix/component";

import { Wordmark } from "../components/logo.tsx";
import { t } from "../theme.ts";

export let HomeBrand = clientEntry(import.meta.url, (handle: Handle) => {
    let link: HTMLAnchorElement | undefined;

    // As the page scrolls, the masthead's wordmark shrinks into the header and
    // hands over to the header's own. Only the large copy is ever scaled, and
    // only down: an enlarged small copy is a stretched bitmap on the compositor.
    // A scroll timeline runs the animations off the main thread (Safari 26.4+,
    // Chromium); elsewhere scroll events seek the same paused animations.
    handle.queueTask(() => {
        let masthead = document.querySelector<HTMLElement>("[data-home-brand]");
        if (!link || !masthead) return;
        let anchor = link;
        let source = masthead;
        let reduced = matchMedia("(prefers-reduced-motion: reduce)");
        let scrollTimeline = "ScrollTimeline" in window;
        let animations: Animation[] = [];
        let distance = 1;
        let frame = 0;
        let measuredWidth = -1;

        function seek() {
            frame = 0;
            let progress = Math.min(1, Math.max(0, window.scrollY / distance));
            for (let animation of animations) animation.currentTime = progress * 1000;
        }

        function animate(element: HTMLElement, keyframes: Keyframe[]): Animation {
            if (scrollTimeline) {
                return element.animate(keyframes, {
                    fill: "both",
                    timeline: new ScrollTimeline({ source: document.documentElement }),
                    rangeStart: "0px",
                    rangeEnd: `${distance}px`,
                });
            }
            let animation = element.animate(keyframes, { duration: 1000, fill: "both" });
            animation.pause();
            return animation;
        }

        function start() {
            for (let animation of animations) animation.cancel();
            animations = [];
            measuredWidth = window.innerWidth;
            if (reduced.matches) return;
            let destination = anchor.getBoundingClientRect();
            let origin = source.getBoundingClientRect();
            let horizontal =
                destination.left + destination.width / 2 - origin.left - origin.width / 2;
            let vertical =
                origin.top +
                window.scrollY +
                origin.height / 2 -
                destination.top -
                destination.height / 2;
            let scale = destination.width / source.firstElementChild!.getBoundingClientRect().width;
            distance = Math.max(origin.height, vertical);
            // The masthead scrolls up with the page by itself; the translation
            // adds only what carries it onto the header's wordmark at the end.
            let travel = `translate(${horizontal}px, ${distance - vertical}px) scale(${scale})`;
            // The two wordmarks swap at the end of the travel rather than cross-fading.
            animations = [
                animate(source, [{ transform: "none" }, { transform: travel }]),
                animate(source, [{ opacity: 1, easing: "step-end" }, { opacity: 0 }]),
                animate(anchor, [{ opacity: 0, easing: "step-end" }, { opacity: 1 }]),
            ];
            if (!scrollTimeline) seek();
        }

        function scroll() {
            if (!frame && !scrollTimeline && animations.length > 0) {
                frame = requestAnimationFrame(seek);
            }
        }

        // iOS resizes as its toolbar collapses mid-scroll; only a new width moves the masthead.
        function resize() {
            if (window.innerWidth !== measuredWidth) start();
        }

        window.addEventListener("scroll", scroll, { passive: true, signal: handle.signal });
        window.addEventListener("resize", resize, { signal: handle.signal });
        reduced.addEventListener("change", start, { signal: handle.signal });
        handle.signal.addEventListener("abort", () => {
            cancelAnimationFrame(frame);
            for (let animation of animations) animation.cancel();
        });
        start();
    });

    return () => (
        <a
            aria-label="Pitlane home"
            data-home-brand-link
            href="/"
            mix={[
                css({
                    display: "inline-flex",
                    alignItems: "center",
                    height: t.spacing(10),
                    marginInlineEnd: "auto",
                    color: t.color.text,
                    // Hidden from the first paint rather than once the swap
                    // animation starts, which would flash it at the top.
                    "@media (prefers-reduced-motion: no-preference)": { opacity: 0 },
                }),
                ref(node => {
                    link = node;
                }),
            ]}
        >
            <Wordmark />
        </a>
    );
});

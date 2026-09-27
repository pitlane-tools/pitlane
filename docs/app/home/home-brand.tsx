import { clientEntry, css, type Handle, ref } from "remix/ui";

import { Wordmark } from "../components/logo.tsx";
import { t } from "../theme.ts";

export let HomeBrand = clientEntry(import.meta.url, (handle: Handle) => {
    let link: HTMLAnchorElement | undefined;

    handle.queueTask(() => {
        let masthead = document.querySelector<HTMLElement>("[data-home-brand]");
        if (!link || !masthead) return;
        let anchor = link;
        let reduced = matchMedia("(prefers-reduced-motion: reduce)");
        let frame = 0;
        let horizontal = 0;
        let vertical = 0;
        let distance = 1;
        let scale = 1;

        function draw() {
            frame = 0;
            let remaining = 1 - Math.min(1, Math.max(0, window.scrollY / distance));
            anchor.style.transform = reduced.matches
                ? "none"
                : `translate(${horizontal * remaining}px, ${vertical * remaining}px) scale(${1 + (scale - 1) * remaining})`;
        }

        function measure() {
            anchor.style.transform = "none";
            let destination = anchor.getBoundingClientRect();
            let source = masthead!.getBoundingClientRect();
            horizontal = source.left + source.width / 2 - destination.left - destination.width / 2;
            vertical =
                source.top +
                window.scrollY +
                source.height / 2 -
                destination.top -
                destination.height / 2;
            distance = Math.max(source.height, vertical);
            scale = masthead!.firstElementChild!.getBoundingClientRect().width / destination.width;
            masthead!.style.visibility = reduced.matches ? "visible" : "hidden";
            draw();
        }

        function schedule() {
            if (!frame && !reduced.matches) frame = requestAnimationFrame(draw);
        }

        window.addEventListener("scroll", schedule, { passive: true, signal: handle.signal });
        window.addEventListener("resize", measure, { signal: handle.signal });
        reduced.addEventListener("change", measure, { signal: handle.signal });
        handle.signal.addEventListener("abort", () => cancelAnimationFrame(frame));
        measure();
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
                    transformOrigin: "center",
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

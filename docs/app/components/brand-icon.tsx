import { css, type Handle } from "remix/ui";

import type { PackageManager } from "../document.ts";

import { t } from "../theme.ts";

type Brand = PackageManager | "github" | "bluesky";

export function BrandIcon(handle: Handle<{ name: Brand }>) {
    return () => (
        <span
            aria-hidden="true"
            data-brand-icon={handle.props.name}
            mix={css({
                display: "inline-block",
                flex: "none",
                width: t.size.icon,
                height: t.size.icon,
                backgroundColor: "currentColor",
                maskImage: `url("/icons/${handle.props.name}.svg")`,
                maskSize: "contain",
                maskPosition: "center",
                maskRepeat: "no-repeat",
                ...(handle.props.name === "bun" || handle.props.name === "deno"
                    ? {
                          "@media (prefers-color-scheme: dark)": {
                              maskImage: `url("/icons/${handle.props.name}-dark.svg")`,
                          },
                      }
                    : {}),
            })}
        />
    );
}

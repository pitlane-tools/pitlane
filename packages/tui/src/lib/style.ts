import type { ElementProps, MixinFactory } from "@remix-run/ui";

import { createElement, createMixin } from "@remix-run/ui";

import type { TerminalElement, TerminalStyle } from "./host.ts";

/**
 * Applies tty layout and paint fields to a terminal element.
 *
 * Styles compose shallowly in the order the mixins are listed: a later
 * `style()` overrides the fields it names and leaves the rest alone. Nothing
 * is retained between renders, so dropping a conditional `style()` clears
 * exactly the fields it contributed.
 *
 * A `<Box>` takes element fields (`layout`, `bg`, `cornerRadius`, `border`,
 * `clip`, `floating`, `transition`) and a `<Text>` takes text fields
 * (`color`, `bg`, `fontSize`, `fontId`, `wrap`, `attrs`, `caret`). Applying
 * one kind to the other throws, since tty would drop the field silently.
 *
 * @example
 * ```tsx
 * import { grow, rgba } from "@bomb.sh/tty";
 * import { Box, style, Text } from "@pitlane/tui";
 *
 * <Box mix={[style({ layout: { width: grow(), direction: "ttb" } }), selected && style({ bg: rgba(40, 40, 60) })]}>
 *     <Text mix={style({ color: rgba(255, 255, 255) })}>Hello, terminal</Text>
 * </Box>
 * ```
 */
export let style: MixinFactory<TerminalElement, [styles: TerminalStyle], ElementProps> =
    createMixin<TerminalElement, [styles: TerminalStyle], ElementProps>(
        handle => (styles, props) => {
            // The component spreads its props fresh on every render, so `style` is
            // only ever the merge of the mixins ahead of this one in the same pass.
            let inherited = props.style as TerminalStyle | undefined;
            return createElement(handle.element, {
                ...props,
                style: inherited === undefined ? styles : { ...inherited, ...styles },
            });
        },
    );

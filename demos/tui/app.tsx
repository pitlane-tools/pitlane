import type { TerminalInputEvent, TerminalRoot } from "@pitlane/tui";
import type { Handle } from "@remix-run/ui";

import { fixed, grow, rgba } from "@bomb.sh/tty";
import { Box, style, Text } from "@pitlane/tui";
import { on } from "@remix-run/ui";

let background = rgba(20, 25, 32);
let foreground = rgba(232, 237, 242);
let muted = rgba(160, 177, 192);
let selectedBackground = rgba(37, 65, 88);
let accent = rgba(136, 209, 240);

interface QueueItem {
    id: string;
    label: string;
}

interface QueueContext {
    readonly selected: string | undefined;
    terminal: TerminalRoot;
    select(id: string): void;
}

export function App(handle: Handle<{ terminal: TerminalRoot }, QueueContext>) {
    let items: QueueItem[] = [
        { id: "routes", label: "Compile routes" },
        { id: "assets", label: "Bundle assets" },
        { id: "types", label: "Check types" },
    ];
    let selected = items[0]?.id;
    let nextId = 0;
    let status = "Select a task and increment its local run count.";
    let terminal = handle.props.terminal;

    handle.context.set({
        get selected() {
            return selected;
        },
        terminal,
        select(id) {
            selected = id;
            handle.update();
        },
    });
    terminal.addEventListener("input", navigate, { signal: handle.signal });

    function navigate(event: TerminalInputEvent): void {
        let key = event.detail;
        if (key.type !== "keydown" && key.type !== "keyrepeat") return;
        if (key.ctrl || key.alt) return;
        let index = items.findIndex(item => item.id === selected);
        switch (key.code) {
            case "q":
            case "Escape":
                terminal.unmount();
                return;
            case "ArrowDown":
            case "j":
                selected = items[Math.min(index + 1, items.length - 1)]?.id;
                break;
            case "ArrowUp":
            case "k":
                selected = items[Math.max(index - 1, 0)]?.id;
                break;
            case "r":
                items.reverse();
                status = "Order reversed. Each task keeps its local run count.";
                break;
            case "x":
                items = items.filter(item => item.id !== selected);
                selected = items[Math.min(index, items.length - 1)]?.id;
                status = "Task removed. Its component and input listener were disposed.";
                break;
            case "a": {
                let id = `task-${++nextId}`;
                items.push({ id, label: `New task ${nextId}` });
                selected = id;
                status = "New task mounted with its own state.";
                break;
            }
            default:
                return;
        }
        handle.update();
    }

    return () => (
        <Box
            mix={style({
                bg: background,
                layout: {
                    width: grow(),
                    height: grow(),
                    direction: "ttb",
                    padding: { left: 2, right: 2, top: 1, bottom: 1 },
                    gap: 1,
                },
            })}
        >
            <Box mix={style({ layout: { width: grow(), direction: "ttb" } })}>
                <Text mix={style({ color: accent })}>Pitlane / terminal renderer lab</Text>
                <Text mix={style({ color: foreground })}>Local task queue</Text>
                <Text mix={style({ color: muted })}>Demo only — no commands are executed.</Text>
            </Box>
            <Box
                mix={style({
                    layout: { width: grow(), height: grow(), direction: "ttb" },
                    clip: { vertical: true },
                })}
            >
                {items.length === 0 ? (
                    <Text mix={style({ color: foreground })}>
                        Queue empty. Press a to add a task.
                    </Text>
                ) : (
                    items.map(item => <TaskRow item={item} key={item.id} />)
                )}
            </Box>
            <Text mix={style({ color: muted })}>{status}</Text>
            <Box mix={style({ layout: { width: grow(), direction: "ttb" } })}>
                <Text mix={style({ color: foreground })}>↑/↓ select · Enter run · r reverse</Text>
                <Text mix={style({ color: foreground })}>x remove · a add · q quit</Text>
            </Box>
        </Box>
    );
}

function TaskRow(handle: Handle<{ item: QueueItem }>) {
    let queue = handle.context.get(App);
    let runs = 0;
    queue.terminal.addEventListener(
        "input",
        event => {
            let key = event.detail;
            if (key.type !== "keydown" || key.ctrl || key.alt) return;
            if (
                queue.selected === handle.props.item.id &&
                (key.code === "Enter" || key.code === " ")
            ) {
                increment();
            }
        },
        { signal: handle.signal },
    );

    function increment(): void {
        runs++;
        handle.update();
    }

    return () => {
        let { item } = handle.props;
        let selected = queue.selected === item.id;
        return (
            <Box
                mix={[
                    style({
                        bg: selected ? selectedBackground : background,
                        layout: { width: grow(), height: fixed(1), direction: "ltr" },
                    }),
                    on("pointerclick", () => {
                        queue.select(item.id);
                        increment();
                    }),
                ]}
            >
                <Text mix={style({ color: selected ? accent : foreground })}>
                    {selected ? "> " : "  "}
                    {item.label} · {runs} {runs === 1 ? "run" : "runs"}
                </Text>
            </Box>
        );
    };
}

/**
 * Error raised for terminal render failures, both the ones this package
 * detects while serializing the host tree and the ones the tty engine
 * reports back after a layout pass.
 */
export class TerminalRenderError extends Error {
    /**
     * Machine readable failure kind. Serialization failures use
     * `UNSUPPORTED_ELEMENT`, `UNSUPPORTED_PROP`, `UNSUPPORTED_STYLE`,
     * `UNSUPPORTED_NODE`, `UNSUPPORTED_NESTING`, and `INVALID_INSERT`. Engine
     * failures use the tty error type verbatim, e.g. `DUPLICATE_ID` or
     * `ELEMENTS_CAPACITY_EXCEEDED`.
     */
    readonly type: string;

    /**
     * @param type Machine readable failure kind.
     * @param message Human readable explanation.
     */
    constructor(type: string, message: string) {
        super(message);
        this.name = "TerminalRenderError";
        this.type = type;
    }
}

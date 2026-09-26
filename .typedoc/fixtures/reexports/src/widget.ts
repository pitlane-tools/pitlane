/** A widget declared once and exported by two public modules. */
export class Widget {
    /** Creates a widget with a display name. */
    constructor(readonly name: string) {}

    /** Renders the widget as text. */
    render(): string {
        return this.name;
    }
}

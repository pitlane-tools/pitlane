import { LitElement, css, html } from "lit";

export class Counter extends LitElement {
    static properties = { count: { type: Number } };

    // Shadow-DOM styles render into the declarative shadow root on the server
    // and ship inside the island's chunk, so they never need a <link>.
    static styles = css`
        button {
            font: inherit;
            padding: 0.5rem 1rem;
            border: 1px solid currentColor;
            border-radius: 0.5rem;
            background: #eef0ff;
            cursor: pointer;
        }
    `;

    // `declare` keeps a class field from shadowing Lit's reactive accessor.
    declare count: number;

    constructor() {
        super();
        this.count = 0;
    }

    render() {
        return html`<button type="button" @click=${() => this.count++}>
            Count: ${this.count}
        </button>`;
    }
}

customElements.define("lit-counter", Counter);

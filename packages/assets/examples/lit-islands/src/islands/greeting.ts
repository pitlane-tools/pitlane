import { LitElement, css, html } from "lit";

export class Greeting extends LitElement {
    static properties = { name: { type: String } };

    static styles = css`
        label {
            display: block;
        }
        p {
            font-weight: 600;
        }
    `;

    declare name: string;

    constructor() {
        super();
        this.name = "world";
    }

    render() {
        return html`
            <label>
                Your name
                <input
                    value=${this.name}
                    @input=${(event: InputEvent) => (this.name = (event.target as HTMLInputElement).value)}
                />
            </label>
            <p>Hello, ${this.name}!</p>
        `;
    }
}

customElements.define("lit-greeting", Greeting);

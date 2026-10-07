import { html } from "lit";

import "./home.css";

export let title = "Home";

export let content = html`
    <h1 class="hero">Lit islands</h1>
    <p>The page is static HTML. Only the two elements below load JavaScript.</p>
    <section class="islands">
        <lit-counter count="2"></lit-counter>
        <lit-greeting name="Lit"></lit-greeting>
    </section>
`;

import { html } from "lit";

import "./about.css";

export let title = "About";

export let content = html`
    <h1>About</h1>
    <p class="note">This page renders no islands, so it ships no JavaScript and no import map.</p>
`;

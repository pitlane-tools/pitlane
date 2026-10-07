// The only script every page loads. It hydrates each <preact-island> the server
// rendered by importing the island's own chunk, so a page pays only for the
// islands it holds.
import { h, hydrate } from "preact";

class PreactIsland extends HTMLElement {
    async connectedCallback() {
        let entry = this.getAttribute("entry")!;
        // The URL comes from the server's resolver at runtime, so the bundler
        // must leave this import alone rather than try to resolve it.
        let module = await import(/* @vite-ignore */ entry);
        let Component = module[this.getAttribute("export-name")!];
        hydrate(h(Component, JSON.parse(this.getAttribute("props")!)), this);
        this.setAttribute("hydrated", "");
    }
}

customElements.define("preact-island", PreactIsland);

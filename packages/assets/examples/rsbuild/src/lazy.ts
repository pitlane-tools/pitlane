import { stamp } from "./shared.ts";
import "./lazy.css";

export function activate(status: Element) {
    document.documentElement.dataset.lazy = stamp("lazy");
    status.textContent = "The lazy module ran.";
}

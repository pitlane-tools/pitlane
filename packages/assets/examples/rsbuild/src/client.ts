import logo from "./logo.svg";
import { stamp } from "./shared.ts";
import "./styles.css";

let status = document.querySelector("#status")!;
let image = Object.assign(new Image(40, 40), { src: logo, alt: "" });
document.querySelector(".page")!.prepend(image);
document.documentElement.dataset.client = stamp("client");
status.textContent = "The client entry ran.";

document.querySelector("#load")!.addEventListener("click", async () => {
    let { activate } = await import("./lazy.ts");
    activate(status);
});

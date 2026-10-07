import { createSignal } from "solid-js";

export default function Home() {
    let [count, setCount] = createSignal(0);
    return (
        <section>
            <h1>Home</h1>
            <button type="button" class="counter" onClick={() => setCount(value => value + 1)}>
                Count: {count()}
            </button>
        </section>
    );
}

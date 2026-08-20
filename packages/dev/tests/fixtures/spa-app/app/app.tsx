import "./styles.css";
import { ArrowCounter } from "./arrow-counter.tsx";
import { FnCounter } from "./fn-counter.tsx";

export function App() {
    return () => (
        <main>
            <h1 data-h1>Client heading A</h1>
            <FnCounter />
            <ArrowCounter />
        </main>
    );
}

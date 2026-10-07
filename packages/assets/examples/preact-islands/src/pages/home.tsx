import { Counter } from "../islands/counter.tsx";
import { Disclosure } from "../islands/disclosure.tsx";
import "./home.css";

export default function Home() {
    return (
        <main>
            <h1 class="home-title">Preact islands</h1>
            <p>This text is static. Only the two islands below load JavaScript of their own.</p>
            <Counter start={2} />
            <Disclosure
                summary="How does this page know its island chunks?"
                details="Each island module calls getScriptEntry with its own source key, so the build emits it as a browser entry."
            />
        </main>
    );
}

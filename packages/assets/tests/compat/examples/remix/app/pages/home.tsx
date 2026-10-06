import { Counter } from "../counter.tsx";
import "./index.css";

export function HomePage() {
    return () => (
        <main>
            <div className="hero">
                <h1>Island Framework</h1>
                <p className="subtitle">Remix Hydrated Components and Frames!</p>
            </div>
            <Counter initialCount={2} />
        </main>
    );
}

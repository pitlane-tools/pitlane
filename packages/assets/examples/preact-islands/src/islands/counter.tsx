import { useState } from "preact/hooks";

import "./counter.css";

export function Counter(props: { start: number }) {
    let [count, setCount] = useState(props.start);
    return (
        <div class="counter">
            <output>Count: {count}</output>
            <button type="button" onClick={() => setCount(count + 1)}>
                Increment
            </button>
        </div>
    );
}

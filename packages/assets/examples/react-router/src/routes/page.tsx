import { useState } from "react";

export function Component() {
    let [count, setCount] = useState(0);
    return (
        <>
            <h1>React Router with @pitlane/assets</h1>
            <p>Count: {count}</p>
            <button type="button" onClick={() => setCount(count + 1)}>
                Increment
            </button>
        </>
    );
}

import { useState } from "preact/hooks";

export function Disclosure(props: { summary: string; details: string }) {
    let [open, setOpen] = useState(false);
    return (
        <div>
            <button type="button" aria-expanded={open} onClick={() => setOpen(!open)}>
                {props.summary}
            </button>
            {open && <p>{props.details}</p>}
        </div>
    );
}

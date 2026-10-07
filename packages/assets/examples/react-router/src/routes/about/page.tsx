import "./page.css";

export function Component() {
    return (
        <>
            <h1>About</h1>
            <p className="about">
                Only this route imports <code>about/page.css</code>, so only its document links it.
            </p>
        </>
    );
}

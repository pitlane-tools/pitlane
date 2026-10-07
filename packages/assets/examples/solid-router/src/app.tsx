import { Router } from "./router.ts";
import "./styles.css";

/** `url` locates the server render; in the browser the router reads the location itself. */
export function App(props: { url?: string }) {
    return (
        <Router url={props.url}>
            {route => (
                <>
                    <nav>
                        <a href="/">Home</a>
                        <a href="/about">About</a>
                        <a href="/faq">FAQ</a>
                    </nav>
                    <main>{route.children}</main>
                </>
            )}
        </Router>
    );
}

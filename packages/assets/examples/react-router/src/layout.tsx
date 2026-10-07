import "./layout.css";
import { NavLink, Outlet } from "react-router";

export function Component() {
    return (
        <>
            <nav>
                <NavLink to="/">Home</NavLink>
                <NavLink to="/about">About</NavLink>
                <NavLink to="/blog/hello-world">Blog post</NavLink>
            </nav>
            <main>
                <Outlet />
            </main>
        </>
    );
}

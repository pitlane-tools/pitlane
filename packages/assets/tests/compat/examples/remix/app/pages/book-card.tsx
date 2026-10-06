import type { Handle } from "remix/component";

import { CartButton } from "../cart-button.tsx";
import { isInCart } from "../cart.ts";

export function BookCard(handle: Handle<{ name: string }>) {
    return () => {
        let { name } = handle.props;
        return (
            <div className="card book-card">
                <h4>{name}</h4>
                <CartButton inCart={isInCart(name)} name={name} />
            </div>
        );
    };
}

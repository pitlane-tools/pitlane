// @ts-nocheck
import parrotImage from "#/assets/images/parrot.png?url";
import robinImage from "#/assets/images/robin.png?url";
import { Image, Picture } from "pitlane/assets";

function Birds() {
    return () => (
        <>
            <Image
                src={robinImage}
                width={400}
                height={300}
                alt="A robin sitting on a nest of eggs."
            />
            <Picture
                src={parrotImage}
                width={400}
                height={300}
                formats={["avif", "webp"]}
                alt="A parrot sitting on a nest of eggs."
            />
        </>
    );
}

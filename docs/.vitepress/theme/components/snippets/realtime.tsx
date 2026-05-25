// @ts-nocheck
import { Realtime } from "pitlane/realtime";
import {
    addEventListeners,
    clientEntry,
} from "remix/ui";

let ChatPanel = clientEntry(
    import.meta.url,
    handle => {
        let realtime = handle.context.get(Realtime);

        addEventListeners(realtime, handle.signal, {
            chatmessage() {
                handle.update();
            },
            statuschange() {
                handle.update();
            },
        });

        return () => (
            <section>
                <ul>
                    {realtime.messages.map(message => (
                        <li key={message.id}>
                            {JSON.stringify(message)}
                        </li>
                    ))}
                </ul>
            </section>
        );
    },
);

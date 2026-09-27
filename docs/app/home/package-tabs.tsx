import { clientEntry, type Handle, on } from "remix/ui";

type PackageOption = { id: string; name: string; purpose: string };

export let PackageTabs = clientEntry(
    import.meta.url,
    (handle: Handle<{ options: PackageOption[] }>) => {
        let enhanced = false;
        let selected = 0;
        let vertical = true;

        handle.queueTask(() => {
            let compact = matchMedia("(max-width: 760px)");
            let update = () => {
                vertical = !compact.matches;
                enhanced = true;
                void handle.update();
            };
            compact.addEventListener("change", update, { signal: handle.signal });
            update();
        });

        return () => {
            let { options } = handle.props;
            function select(index: number, focus = false) {
                selected = index;
                void handle.update().then(() => {
                    if (focus)
                        document.getElementById(`package-tab-${options[index]!.id}`)?.focus();
                });
            }
            function navigate(event: KeyboardEvent) {
                let index = selected;
                if (event.key === "Home") index = 0;
                else if (event.key === "End") index = options.length - 1;
                else if (event.key === (vertical ? "ArrowDown" : "ArrowRight")) index++;
                else if (event.key === (vertical ? "ArrowUp" : "ArrowLeft")) index--;
                else return;
                event.preventDefault();
                select((index + options.length) % options.length, true);
            }
            return (
                <div
                    aria-label="Packages"
                    aria-orientation={enhanced ? (vertical ? "vertical" : "horizontal") : undefined}
                    data-package-options
                    role={enhanced ? "tablist" : "group"}
                >
                    <p data-package-legend>Select a package</p>
                    {options.map((option, index) =>
                        enhanced ? (
                            <button
                                aria-controls={`package-panel-${option.id}`}
                                aria-selected={selected === index}
                                data-package={option.id}
                                data-package-choice
                                id={`package-tab-${option.id}`}
                                key={option.id}
                                mix={[
                                    on("click", () => select(index)),
                                    on<HTMLButtonElement, "keydown">("keydown", navigate),
                                ]}
                                role="tab"
                                tabindex={selected === index ? 0 : -1}
                                type="button"
                            >
                                <span>
                                    <strong>{option.name}</strong>
                                    <small>{option.purpose}</small>
                                </span>
                            </button>
                        ) : (
                            <label
                                data-package-choice
                                id={`package-tab-${option.id}`}
                                key={option.id}
                            >
                                <input
                                    checked={index === 0}
                                    name="homepage-package"
                                    type="radio"
                                    value={option.id}
                                />
                                <span>
                                    <strong>{option.name}</strong>
                                    <small>{option.purpose}</small>
                                </span>
                            </label>
                        ),
                    )}
                </div>
            );
        };
    },
);

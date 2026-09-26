import type { ResolveFrameOptions } from "remix/ui";

/** Native navigation replaces stale content when a soft navigation cannot load its new URL. */
export async function resolveDocument(
    src: string,
    options?: ResolveFrameOptions,
): Promise<Response> {
    let method = options?.method?.toUpperCase() ?? "GET";
    let response: Response;
    try {
        response = await fetch(src, {
            method,
            body: method === "GET" || method === "HEAD" ? undefined : encode(options),
            headers: { accept: "text/html" },
            signal: options?.signal,
        });
    } catch (error) {
        navigateNatively(src, method, options);
        throw error;
    }
    let html = response.headers.get("content-type")?.toLowerCase().includes("text/html");
    if (html && response.status < 500) return response;
    navigateNatively(src, method, options);
    throw new Error(
        `Navigating to ${src} answered ${response.status} ${response.statusText}`.trimEnd(),
    );
}

function encode(options: ResolveFrameOptions | undefined): BodyInit | undefined {
    let data = options?.formData;
    if (!data || options?.encType === "multipart/form-data") return data;
    let body = new URLSearchParams();
    for (let [name, value] of data)
        body.append(name, typeof value === "string" ? value : value.name);
    return body;
}

/** Never replace a newer navigation with an earlier request's failure. */
function navigateNatively(
    src: string,
    method: string,
    options: ResolveFrameOptions | undefined,
): void {
    if (options?.signal?.aborted) return;
    if (method === "GET") return window.location.replace(src);
    let form = document.createElement("form");
    form.method = method.toLowerCase();
    form.action = src;
    form.enctype = options?.encType ?? "application/x-www-form-urlencoded";
    form.hidden = true;
    form.setAttribute("data-rmx-document", "");
    for (let [name, value] of options?.formData ?? []) {
        if (typeof value !== "string") continue;
        let field = document.createElement("input");
        field.type = "hidden";
        field.name = name;
        field.value = value;
        form.append(field);
    }
    document.body.append(form);
    form.submit();
}

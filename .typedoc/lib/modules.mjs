import { ReflectionKind } from "typedoc";

// TypeDoc names a module after its entry file unless the file carries a
// `@module` tag. A file basename is not what readers import, so modules are
// renamed to the package's public specifier: `index` is the package root and
// any other basename is a subpath export. The original name is kept so the
// legacy routing pass can reproduce the URLs those names produced.
let originalNames = new WeakMap();

export function nameModulesAfterExports(project, entryModule) {
    for (let module of project.getChildrenByKind(ReflectionKind.Module)) {
        if (module.name === entryModule || module.name.startsWith(`${entryModule}/`)) {
            continue;
        }
        originalNames.set(module, module.name);
        module.name = module.name === "index" ? entryModule : `${entryModule}/${module.name}`;
    }
}

export function withOriginalModuleNames(project, callback) {
    let renamed = project
        .getChildrenByKind(ReflectionKind.Module)
        .filter(module => originalNames.has(module))
        .map(module => [module, module.name]);
    for (let [module] of renamed) {
        module.name = originalNames.get(module);
    }
    try {
        return callback();
    } finally {
        for (let [module, name] of renamed) {
            module.name = name;
        }
    }
}

/**
 * The public import surfaces of one package and what each of them exports.
 *
 * A surface is a module reflection under the project, or the project itself
 * when a single entry point leaves TypeDoc no module to create. A declaration
 * exported by several surfaces has exactly one canonical surface: the one
 * whose entry file declares it, else the package root, else the first subpath
 * by name. That choice depends on the declaration and the surfaces alone,
 * never on the order TypeDoc converted the entry points in.
 */
export class PublicModules {
    #project;
    #surfaces = new Map();
    #exports = new Map();

    constructor(project, entryModule) {
        this.#project = project;
        let modules = project.getChildrenByKind(ReflectionKind.Module);
        let containers = modules.length ? modules : [project];
        for (let container of containers) {
            this.#surfaces.set(container, this.#describe(container, entryModule));
        }
        if (![...this.#surfaces.values()].some(surface => surface.isRoot)) {
            throw new Error(`[pitlane] entryModule "${entryModule}" names none of the modules`);
        }
        for (let container of this.#surfaces.keys()) {
            for (let child of container.children ?? []) {
                let isReference = child.kind === ReflectionKind.Reference;
                let declaration = isReference ? child.getTargetReflectionDeep() : child;
                if (declaration && this.#surfaces.has(declaration.parent)) {
                    this.#addExport(declaration, container, child.name);
                }
            }
        }
    }

    #describe(container, entryModule) {
        let name = container === this.#project ? entryModule : container.name;
        let isRoot = name === entryModule;
        if (!isRoot && !name.startsWith(`${entryModule}/`)) {
            throw new Error(`[pitlane] module "${name}" is not a subpath of ${entryModule}`);
        }
        return {
            reflection: container,
            name,
            isRoot,
            path: isRoot ? "" : name.slice(entryModule.length + 1),
            entryFile: this.#project.getSymbolIdFromReflection(container)?.fileName,
        };
    }

    #addExport(declaration, container, name) {
        let exports = this.#exports.get(declaration) ?? [];
        exports.push({ module: this.#surfaces.get(container), name });
        this.#exports.set(declaration, exports);
    }

    get(reflection) {
        return this.#surfaces.get(reflection);
    }

    all() {
        return [...this.#surfaces.values()];
    }

    isTopLevel(reflection) {
        return this.#surfaces.has(reflection.parent);
    }

    exportsOf(declaration) {
        return [...(this.#exports.get(declaration) ?? [])].sort(
            (a, b) => a.module.name.localeCompare(b.module.name) || a.name.localeCompare(b.name),
        );
    }

    canonical(declaration) {
        let exports = this.exportsOf(declaration);
        let declaringFile = this.#project.getSymbolIdFromReflection(declaration)?.fileName;
        let chosen =
            exports.find(({ module }) => module.entryFile === declaringFile) ??
            exports.find(({ module }) => module.isRoot) ??
            exports[0];
        return chosen?.module ?? this.#surfaces.get(declaration.parent);
    }

    aliasesOf(declaration) {
        let canonical = this.canonical(declaration);
        return this.exportsOf(declaration).filter(
            ({ module, name }) => module !== canonical || name !== declaration.name,
        );
    }
}

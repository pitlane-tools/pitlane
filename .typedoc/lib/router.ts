import type {
    Application,
    PageDefinition,
    ProjectReflection,
    ReferenceReflection,
    Reflection,
    RouterTarget,
} from "typedoc";

import { PageKind, ReflectionKind, Slugger } from "typedoc";
import { MemberRouter, ModuleRouter } from "typedoc-plugin-markdown";

import type { Layout } from "./layout.ts";

import { layoutFromOut } from "./layout.ts";
import { PublicModules, withOriginalModuleNames } from "./modules.ts";

// URL segment per page kind, in the order overview pages list them.
export const KIND_SEGMENTS = new Map([
    [ReflectionKind.Namespace, "namespace"],
    [ReflectionKind.Enum, "enum"],
    [ReflectionKind.Class, "class"],
    [ReflectionKind.Interface, "interface"],
    [ReflectionKind.TypeAlias, "type"],
    [ReflectionKind.Variable, "variable"],
    [ReflectionKind.Function, "function"],
]);

/**
 * One page per public module and per top-level export, addressed as
 * `[<subpath>/]<kind>/<Name>` under the package. Members of a class,
 * interface, enum, or namespace stay anchors on the containing page.
 */
export class SymbolRouter extends MemberRouter {
    // Set by buildPages; the theme and the manifest read them while rendering.
    declare layout: Layout;
    declare modules: PublicModules;
    declare legacy: LegacyRouter;

    buildPages(project: ProjectReflection): PageDefinition[] {
        this.layout = layoutFromOut(this.application.options.getValue("out"));
        this.modules = new PublicModules(project, this.entryModule);
        this.legacy = legacyRouting(this.application, project);
        let pages = super.buildPages(project);
        for (let reference of project.getReflectionsByKind(ReflectionKind.Reference)) {
            let target = (reference as ReferenceReflection).getTargetReflectionDeep();
            if (target && this.fullUrls.has(target)) {
                this.fullUrls.set(reference, this.fullUrls.get(target)!);
                this.anchors.delete(reference);
            }
        }
        return pages;
    }

    buildChildPages(reflection: Reflection, outPages: PageDefinition[]): void {
        let module = this.modules.get(reflection);
        if (module) {
            let url = module.isRoot
                ? `${this.entryFileName}${this.extension}`
                : this.getFileName(this.getIdealBaseName(reflection));
            this.fullUrls.set(reflection, url);
            this.sluggers.set(reflection, new Slugger(this.sluggerConfiguration));
            if (!module.isRoot) {
                outPages.push({ kind: PageKind.Reflection, model: reflection, url });
            }
            reflection.traverse(child => {
                this.buildChildPages(child, outPages);
                return true;
            });
            return;
        }
        let isSymbolPage =
            this.modules.isTopLevel(reflection) &&
            this.getPageKind(reflection) === PageKind.Reflection;
        if (isSymbolPage) {
            let url = this.getFileName(this.getIdealBaseName(reflection));
            this.fullUrls.set(reflection, url);
            this.sluggers.set(reflection, new Slugger(this.sluggerConfiguration));
            outPages.push({ kind: PageKind.Reflection, model: reflection, url });
            reflection.traverse(child => {
                this.buildAnchors(child, reflection);
                return true;
            });
            return;
        }
        // The router only walks the project's descendants, and each has a parent.
        this.buildAnchors(reflection, reflection.parent!);
    }

    getIdealBaseName(reflection: Reflection): string {
        let module = this.modules.get(reflection);
        if (module) {
            return module.isRoot ? this.entryFileName : module.path;
        }
        let segment = KIND_SEGMENTS.get(reflection.kind);
        let canonical = this.modules.canonical(reflection);
        return [canonical.path, segment, reflection.name].filter(Boolean).join("/");
    }

    // Two exports can only share a path through a bug in the naming scheme;
    // a numbered suffix would hide it behind an order-dependent URL.
    getFileName(baseName: string): string {
        let key = baseName.toLocaleLowerCase();
        if (this.usedFileNames.has(key)) {
            throw new Error(
                `[pitlane] two reference pages resolve to ${baseName}${this.extension}`,
            );
        }
        this.usedFileNames.add(key);
        return `${baseName}${this.extension}`;
    }
}

// The router the old site was generated with (upstream's module router plus
// the entry-module prefix strip the previous plugin added), run under the
// module names it saw, tells us which page and fragment every reflection used
// to have. Overview pages keep those fragments as anchors, and modules whose
// page moved become redirect entries.
class LegacyRouter extends ModuleRouter {
    // The manifest reads which page each module used to have.
    declare public fullUrls: Map<RouterTarget, string>;

    getIdealBaseName(reflection: Reflection): string {
        let baseName = super.getIdealBaseName(reflection);
        let prefix = `${this.entryModule}/`;
        return baseName.startsWith(prefix) ? baseName.slice(prefix.length) : baseName;
    }
}

function legacyRouting(application: Application, project: ProjectReflection): LegacyRouter {
    let router = new LegacyRouter(application);
    withOriginalModuleNames(project, () => router.buildPages(project));
    return router;
}

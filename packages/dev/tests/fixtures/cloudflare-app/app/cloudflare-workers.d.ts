// Resolvable only inside workerd at runtime; the fixture imports `env` solely
// to prove the bundle is workerd-only. A minimal ambient shape is enough for
// the root lint program, which never runs the module.
declare module "cloudflare:workers" {
    export const env: Record<string, unknown>;
}

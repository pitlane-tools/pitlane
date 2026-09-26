// Documents import every component explicitly; nothing is provided implicitly.
// Leaving this type undeclared makes MDX Analyzer type the component lookup as
// `any`, which silently accepts unknown components.
type MDXProvidedComponents = {};

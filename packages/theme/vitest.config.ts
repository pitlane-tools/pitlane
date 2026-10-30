import { defineConfig } from "vitest/config";

export default defineConfig({
    test: {
        include: ["**/*.test.ts"],
        // The public types are part of the contract, so `*.test-d.ts` runs too.
        typecheck: {
            enabled: true,
            checker: "tsc",
            tsconfig: "tsconfig.json",
        },
    },
});

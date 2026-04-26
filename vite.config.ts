import { defineConfig } from 'vite-plus';

export default defineConfig({
    fmt: {
        singleQuote: true,
    },
    lint: {
        ignorePatterns: [
            'docs/.vitepress/cache/**',
            'docs/.vitepress/dist/**',
            'node_modules/**',
        ],
        options: {
            typeAware: true,
            typeCheck: true,
        },
    },
});

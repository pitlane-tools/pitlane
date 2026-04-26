import { defineConfig } from 'vite-plus';

export default defineConfig({
  fmt: {
    ignorePatterns: [
      'docs/.vitepress/cache/**',
      'docs/.vitepress/dist/**',
      'docs/.vitepress/.temp/**',
      'docs/SETUP.md',
      'docs/superpowers/**',
      'node_modules/**',
      'pitlane.md',
      'vite-plus.md',
    ],
    singleQuote: true,
  },
  lint: {
    ignorePatterns: ['docs/.vitepress/cache/**', 'docs/.vitepress/dist/**', 'node_modules/**'],
    options: {
      typeAware: true,
      typeCheck: true,
    },
  },
});

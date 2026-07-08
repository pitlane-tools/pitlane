# VoidZero VitePress Template

A drop-in VitePress documentation site using `@voidzero-dev/vitepress-theme`.

## Usage

1. Copy this folder into your project (e.g. as `website/`, `site/`, or `docs/`):

```sh
cp -r ~/Developer/Templates/void-zero-docs ./docs
```

2. Install dependencies:

```sh
pnpm add -D vitepress @voidzero-dev/vitepress-theme vitepress-plugin-group-icons vue
```

3. Add scripts to your `package.json`:

```jsonc
{
    "scripts": {
        "docs:dev": "vitepress dev docs",
        "docs:build": "vitepress build docs",
        "docs:serve": "vitepress serve docs",
    },
}
```

Replace `docs` with whatever you named the folder.

4. Add to `.gitignore`:

```
docs/.vitepress/cache
docs/.vitepress/dist
```

## Structure

```
.vitepress/
├── config.ts              # VitePress + VoidZero theme config
└── theme/
    ├── index.ts           # Theme entry, layout slots, logo injection
    ├── custom.css         # Brand colors, fonts, kbd styling
    ├── components/
    │   ├── Hero.vue       # Two-column hero banner
    │   ├── Intro.vue      # "Why [project]" section
    │   └── FeatureGrid.vue # 2×2 feature grid
    └── layouts/
        └── Home.vue       # Composes Hero + Intro + FeatureGrid + theme Footer
```

## Customization

### Branding

- **Title**: `config.ts` → `title`, `index.ts` → `logoAlt`
- **Colors**: `custom.css` → `--color-brand`, `--vp-c-brand-*`, hero gradient
- **Logos**: Replace SVGs in `public/` (`logo-dark.svg`, `logo-light.svg`, `favicon.svg`)

### Home page

- **Hero**: `components/Hero.vue` — heading, tagline, CTA links
- **Intro**: `components/Intro.vue` — "Why" section with value proposition
- **Features**: `components/FeatureGrid.vue` — 2×2 grid of key features
- **Footer CTA**: `layouts/Home.vue` — heading, subheading, button text/link
- **Composition**: `layouts/Home.vue` — add/remove/reorder sections

### Navigation

- **Nav & sidebar**: `config.ts` → `themeConfig.nav` and sidebar arrays
- **Social links**: `config.ts` → `themeConfig.socialLinks`

## Theme Components

The `@voidzero-dev/vitepress-theme` package provides shared components you can
import into your layouts and components:

```vue
<!-- Section heading -->
<script setup>
import HeadingSection from "@components/oss/HeadingSection.vue";
import Footer from "@components/oss/Footer.vue";
import Sponsors from "@components/oss/Sponsors.vue";
import Spacer from "@components/shared/Spacer.vue";
</script>
```

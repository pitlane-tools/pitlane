<script setup lang="ts">
/**
 * The theme's layout with one addition: the build-mode toggle above every
 * page that declares a `build` in its frontmatter.
 *
 * Filling `doc-before` here rather than asking each guide to place a component
 * keeps the control in one place and out of the prose, and means a guide opts
 * in with frontmatter alone. `VPLayout` forwards every other slot untouched.
 */
import { VoidZeroTheme } from "@voidzero-dev/vitepress-theme";

import BuildModeToggle from "../components/BuildModeToggle.vue";

let Layout = VoidZeroTheme.Layout;
</script>

<template>
    <Layout>
        <template #doc-before>
            <BuildModeToggle />
        </template>
    </Layout>
</template>

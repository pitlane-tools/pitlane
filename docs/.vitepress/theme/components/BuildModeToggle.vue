<script setup lang="ts">
import { useData, withBase } from "vitepress";
import { computed } from "vue";

import { BUILD_MODE_LABELS, BUILD_MODES, counterpart } from "../../build-modes.ts";

let { frontmatter, page } = useData<{ build?: unknown }>();

let current = computed(() => BUILD_MODES.find(mode => mode === frontmatter.value.build));

/**
 * Both modes, in a fixed order, so the control does not rearrange itself
 * between the two pages of one guide.
 *
 * The pair comes from `BUILD_MODE_GUIDES` rather than from frontmatter: the
 * inline head script needs the same pairs to apply a stored choice, and one
 * registry that both read beats a `buildAlternate` on every page which can
 * disagree with it.
 *
 * Every option is a real `href`, which is what gives each mode its own address
 * and lets the switch work before hydration. `data-build-mode` is what the
 * head script records on a click, and what exempts these links from the
 * rewriting it does to every other link into a two-mode guide.
 */
let options = computed(() =>
    BUILD_MODES.map(mode => ({
        mode,
        label: BUILD_MODE_LABELS[mode],
        current: mode === current.value,
        href: mode === current.value ? undefined : counterpart(page.value.relativePath, mode),
    })),
);

/** Only a guide the registry knows in both setups shows the control. */
let available = computed(() => Boolean(current.value && options.value.some(o => o.href)));
</script>

<template>
    <!--
        Only a guide written in both setups shows this. A page with one setup
        has nothing to switch to, and a control whose other half never moves
        is noise that also has to explain itself.
    -->
    <div
        v-if="available"
        class="build-modes"
        role="group"
        aria-label="The setup this guide describes"
    >
        <template v-for="option in options" :key="option.mode">
            <a
                v-if="option.href"
                class="build-mode"
                :data-build-mode="option.mode"
                :href="withBase(option.href)"
            >
                {{ option.label }}
            </a>
            <span
                v-else
                class="build-mode is-current"
                :data-build-mode="option.mode"
                aria-current="page"
            >
                {{ option.label }}
            </span>
        </template>
    </div>
</template>

<style scoped>
.build-modes {
    display: inline-flex;
    padding: 3px;
    margin-bottom: 2rem;
    border: 1px solid var(--vp-c-divider);
    border-radius: 8px;
    background-color: var(--vp-c-bg-alt);
}

.build-mode {
    padding: 0.25rem 0.7rem;
    border-radius: 6px;
    color: var(--vp-c-text-2);
    font-size: 0.8125rem;
    font-weight: 500;
    line-height: 1.4;
    text-decoration: none;
    white-space: nowrap;
    transition:
        color 0.2s,
        background-color 0.2s;
}

a.build-mode:hover {
    color: var(--vp-c-text-1);
    background-color: var(--vp-c-default-soft);
}

a.build-mode:focus-visible {
    outline: 2px solid var(--vp-c-brand-1);
    outline-offset: 1px;
}

/* The selected mode is the one surface that sits above the group's own, which
   is what makes the pair read as a switch rather than as two labels. */
.build-mode.is-current {
    padding: calc(0.25rem - 1px) calc(0.7rem - 1px);
    border: 1px solid var(--vp-c-divider);
    border-radius: 6px;
    background-color: var(--vp-c-bg);
    box-shadow: 0 1px 2px rgb(0 0 0 / 0.08);
    color: var(--vp-c-text-1);
}
</style>

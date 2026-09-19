<script setup lang="ts">
import { useData, withBase } from "vitepress";
import { computed } from "vue";

import { BUILD_MODE_LABELS, BUILD_MODES, type BuildMode } from "../../build-modes.ts";

interface BuildModeFrontmatter {
    build?: unknown;
    buildAlternate?: unknown;
    buildAlternateNote?: unknown;
}

let { frontmatter } = useData<BuildModeFrontmatter>();

function asMode(value: unknown): BuildMode | undefined {
    return BUILD_MODES.find(mode => mode === value);
}

function asText(value: unknown): string | undefined {
    return typeof value === "string" && value.length > 0 ? value : undefined;
}

let current = computed(() => asMode(frontmatter.value.build));
let alternateLink = computed(() => asText(frontmatter.value.buildAlternate));
let note = computed(() => asText(frontmatter.value.buildAlternateNote));

/**
 * Both modes, in a fixed order, so the control does not rearrange itself
 * between two pages of the same guide.
 *
 * The mode a page did not declare is a link when that page exists and inert
 * when it does not. Making each option a real `href` is what gives both modes
 * their own address and lets the switch work before hydration.
 */
let options = computed(() =>
    BUILD_MODES.map(mode => ({
        mode,
        label: BUILD_MODE_LABELS[mode],
        current: mode === current.value,
        href: mode === current.value ? undefined : alternateLink.value,
    })),
);
</script>

<template>
    <div v-if="current" class="build-modes">
        <div class="build-modes-group" role="group" aria-label="The setup this guide describes">
            <template v-for="option in options" :key="option.mode">
                <a v-if="option.href" class="build-mode" :href="withBase(option.href)">
                    {{ option.label }}
                </a>
                <span
                    v-else
                    class="build-mode"
                    :class="{ 'is-current': option.current, 'is-unavailable': !option.current }"
                    :aria-current="option.current ? 'page' : undefined"
                    :aria-disabled="option.current ? undefined : true"
                    :aria-describedby="!option.current && note ? 'build-mode-note' : undefined"
                >
                    {{ option.label }}
                </span>
            </template>
        </div>
        <span v-if="note && !alternateLink" id="build-mode-note" class="build-modes-note">
            {{ note }}
        </span>
    </div>
</template>

<style scoped>
.build-modes {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.375rem 0.625rem;
    margin-bottom: 2rem;
}

.build-modes-group {
    display: inline-flex;
    padding: 3px;
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
    color: var(--vp-c-text-1);
    background-color: var(--vp-c-bg);
    border: 1px solid var(--vp-c-divider);
    padding: calc(0.25rem - 1px) calc(0.7rem - 1px);
    box-shadow: 0 1px 2px rgb(0 0 0 / 0.08);
}

/*
 * Dimmed rather than removed: that this guide has one setup and not two is
 * itself worth saying, and the note beside it says why.
 *
 * This lands near 2.9:1 in light and 3.5:1 in dark, under the 4.5:1 the rest
 * of this component holds to. WCAG 1.4.3 exempts text that is part of an
 * inactive control, and dimming is the only visual difference between this
 * and the other mode's link — at rest they are otherwise the same element.
 * The reason a reader actually needs is in the note, which is not dimmed.
 */
.build-mode.is-unavailable {
    color: var(--vp-c-text-3);
    cursor: not-allowed;
}

.build-modes-note {
    color: var(--vp-c-text-2);
    font-size: 0.8125rem;
    line-height: 1.4;
}
</style>

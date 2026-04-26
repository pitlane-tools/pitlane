<script setup>
// import logoLight from '@assets/logos/voidzero-light.svg';
</script>

<template>
    <div class="wrapper wrapper--ticks grid md:grid-cols-2 w-full border-nickel divide-x">
        <div class="flex flex-col p-10 justify-center items-center md:items-start">
            <div
                class="flex flex-col gap-5 max-w-[30rem] text-center md:text-left items-center md:items-start"
            >
                <!-- Optional "By" attribution link -->
                <!-- <a class="flex items-center gap-2" href="https://voidzero.dev" target="_blank">
                    <span class="text-grey text-xs font-mono uppercase tracking-wide">By</span>
                    <img :src="logoLight" alt="VoidZero" class="h-2.5">
                </a> -->
                <h1 class="text-white text-pretty">
                    My Project
                </h1>
                <p class="text-white/70 text-lg max-w-[25rem] text-pretty">
                    A brief description of your project.
                </p>
                <div class="flex items-center gap-5 mt-8">
                    <a
                        href="/guides/getting-started"
                        class="button button--primary inline-block w-fit"
                    >
                        <span>Get Started</span>
                    </a>
                    <a
                        href="https://github.com/"
                        target="_blank"
                        rel="noopener noreferrer"
                        class="button inline-block w-fit"
                    >
                        View on GitHub
                    </a>
                </div>
            </div>
        </div>
        <div class="flex flex-col min-h-[22rem] sm:min-h-[30rem]">
            <div
                class="relative pl-6 sm:pl-16 h-full flex flex-col justify-center overflow-clip py-8 sm:py-16 hero-background"
            >
                <!-- Hero right-side content (terminal screenshot, animation, etc.) -->
            </div>
        </div>
    </div>
</template>

<style scoped>
.hero-background {
    background-image: url('@assets/vitest/hero-background.jpg');
    background-size: cover;
    background-position: center;
}
</style>

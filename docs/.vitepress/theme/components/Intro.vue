<template>
    <div class="wrapper wrapper--ticks border-t py-14 lg:py-30 px-5 sm:px-10 lg:px-20">
        <div
            class="flex flex-col lg:flex-row lg:justify-between lg:items-center gap-5 lg:gap-8 text-left"
        >
            <div class="flex flex-col gap-3 max-w-md">
                <div class="flex gap-3 items-center">
                    <span
                        class="text-grey text-xs font-medium font-mono uppercase tracking-wide"
                    >
                        Why My Project
                    </span>
                </div>
                <h3 class="text-white max-w-xl text-balance">
                    A heading that explains your core value proposition.
                </h3>
                <a
                    href="/guides/getting-started"
                    class="button w-fit mt-8 hidden lg:block"
                >
                    Learn more
                </a>
            </div>
            <div class="lg:max-w-lg">
                <p class="text-pretty mb-5">
                    Describe what makes your project unique and why developers should use
                    it. This is the first detailed section visitors see after the hero.
                </p>
                <p class="text-pretty">
                    Add a second paragraph for additional context, technical details, or
                    to highlight compatibility with other tools in the ecosystem.
                </p>
                <a
                    href="/guides/getting-started"
                    class="button w-fit mt-8 block lg:hidden"
                >
                    Learn more
                </a>
            </div>
        </div>
    </div>
</template>

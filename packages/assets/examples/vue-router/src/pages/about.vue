<script setup vapor lang="ts">
let stack = ["vue 3.6 (Vapor)", "vue-router 5", "@pitlane/assets", "Vite 8"];
</script>

<template>
    <main>
        <h1>About</h1>
        <p>Only this page has a stylesheet of its own, so only its document links it.</p>
        <ul class="stack">
            <li v-for="item in stack" :key="item">{{ item }}</li>
        </ul>
    </main>
</template>

<style scoped>
.stack {
    border-left: 4px solid rgb(66, 184, 131);
    padding-left: 1.5rem;
}
</style>

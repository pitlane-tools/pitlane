<script setup vapor lang="ts">
import { ref } from "vue";

let count = ref(0);
</script>

<template>
    <main>
        <h1>Vue Vapor with Vue Router</h1>
        <p>
            Each page is a Vapor component rendered on the server and hydrated in the browser. The
            document links only the matched routes' preloads and stylesheets.
        </p>
        <button type="button" @click="count++">Count: {{ count }}</button>
    </main>
</template>

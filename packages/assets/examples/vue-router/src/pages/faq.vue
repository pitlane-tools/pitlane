<script setup vapor lang="ts"></script>

<template>
    <main>
        <h1>FAQ</h1>
        <h2>Why is every page a separate chunk?</h2>
        <p>
            Routes come from <code>import.meta.glob</code> without <code>eager</code>, so each page
            loads only when its route first matches.
        </p>
    </main>
</template>

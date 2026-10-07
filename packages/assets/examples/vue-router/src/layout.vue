<script setup lang="ts">
import { RouterLink, RouterView } from "vue-router";

import "./styles.css";
</script>

<template>
    <nav>
        <RouterLink to="/">Home</RouterLink>
        <RouterLink to="/about">About</RouterLink>
        <RouterLink to="/faq">FAQ</RouterLink>
    </nav>
    <RouterView />
</template>

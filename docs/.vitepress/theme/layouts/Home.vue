<script setup>
import Footer from "@components/oss/Footer.vue";
import HeadingSection from "@components/oss/HeadingSection.vue";
import Spacer from "@components/shared/Spacer.vue";

import FeatureGrid from "../components/FeatureGrid.vue";
import Hero from "../components/Hero.vue";
import Intro from "../components/Intro.vue";
</script>

<template>
    <Hero />
    <Intro />
    <HeadingSection heading="The Remix platform layer for Cloudflare." />
    <FeatureGrid />
    <Spacer />
    <Footer
        heading="Start with Pitlane"
        subheading="Create a Remix 3 app, configure Cloudflare resources, and deploy through the same Vite+ workflow you use every day."
        button-text="Get started"
        button-link="/guides/getting-started"
    />
</template>

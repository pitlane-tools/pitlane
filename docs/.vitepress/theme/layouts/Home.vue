<script setup>
import Footer from '@components/oss/Footer.vue';
import HeadingSection from '@components/oss/HeadingSection.vue';
import Spacer from '@components/shared/Spacer.vue';
import Hero from '../components/Hero.vue';
import Intro from '../components/Intro.vue';
import FeatureGrid from '../components/FeatureGrid.vue';
</script>

<template>
    <Hero />
    <Intro />
    <HeadingSection heading="Built for the modern web." />
    <FeatureGrid />
    <Spacer />
    <Footer
        heading="Get started with My Project"
        subheading="The fastest way to build for the modern web"
        button-text="Get started"
        button-link="/guides/getting-started"
    />
</template>

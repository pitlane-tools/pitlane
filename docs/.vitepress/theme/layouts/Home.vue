<script setup>
import Footer from "@components/oss/Footer.vue";
import Spacer from "@components/shared/Spacer.vue";

import CheckerDivider from "../components/CheckerDivider.vue";
import Hero from "../components/Hero.vue";
import InstallCommand from "../components/InstallCommand.vue";
import Intro from "../components/Intro.vue";
import OperationsArt from "../components/OperationsArt.vue";
import PartnerLogos from "../components/PartnerLogos.vue";
import PrimitivesGrid from "../components/PrimitivesGrid.vue";
import ProductivityStats from "../components/ProductivityStats.vue";
import Stack3Col from "../components/Stack3Col.vue";
import TerminalTranscript from "../components/TerminalTranscript.vue";
</script>

<template>
    <Hero />
    <InstallCommand />
    <Stack3Col />
    <Intro />
    <PrimitivesGrid />
    <CheckerDivider />
    <TerminalTranscript />
    <OperationsArt />
    <ProductivityStats />
    <PartnerLogos />
    <Spacer />
    <Footer
        heading="Start with Pitlane"
        subheading="Create a Remix app, configure Cloudflare resources, and deploy through the same Vite+ workflow you use every day."
        button-text="Get started"
        button-link="/guides/getting-started"
    />
</template>

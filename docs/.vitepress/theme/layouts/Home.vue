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
    <Suspense>
        <PrimitivesGrid />
    </Suspense>
    <CheckerDivider />
    <TerminalTranscript />
    <OperationsArt />
    <ProductivityStats />
    <PartnerLogos />
    <Footer
        heading="Start with Pitlane"
        subheading="Add the remix() plugin to your Vite config, keep the workflow you have, and deploy the same fetch handler anywhere."
        button-text="Get started"
        button-link="/guides/vite-plugin"
    />
</template>

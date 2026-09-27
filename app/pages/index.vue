<script setup lang="ts">
const showPreview = ref(false)
const area = ref('')

async function submitArea() {
  await navigateTo('/register')
}
</script>

<template>
  <div>
    <section class="hero">
      <div class="container hero-copy">
        <p class="location-label">Recycling made rewarding</p>
        <h1>The scan that turns waste into <span>value.</span></h1>
        <p class="hero-description">
          Snap it. Know its worth. Find a recycler nearby.
        </p>
        <form class="hero-area-form" @submit.prevent="submitArea">
          <div class="hero-area-fields">
            <label for="hero-area">See what we offer in your neighborhood</label>
            <div class="hero-area-input">
              <span class="hero-area-icon" aria-hidden="true">
                <AppIcon name="pin" :size="18" tone="brand" />
              </span>
              <input
                id="hero-area"
                v-model="area"
                type="text"
                autocomplete="address-level2"
                placeholder="Enter your area in Africa"
                required
              >
            </div>
          </div>
          <BaseButton type="submit" variant="secondary">Check pickup</BaseButton>
        </form>
        <a class="hero-area-why" href="#what-you-can-recycle">Why do we need your area?</a>
      </div>

      <div class="hero-media container" aria-label="ReCircle demo video">
        <div class="demo-video-frame">
          <img
            class="demo-video"
            src="/demo-video.gif"
            alt="ReCircle demo: recycling bins ready for pickup"
            width="1280"
            height="720"
            decoding="async"
            fetchpriority="high"
          >
        </div>
      </div>
    </section>

    <RecycleCategories />

    <PlatformRoles />

    <HomeHowItWorks />

    <HomeFaq />

    <section id="the-mission" class="section container">
      <div class="mission-panel">
        <div>
          <p class="eyebrow">Made for the Africa we believe in</p>
          <h2>Waste is a challenge.<br>What comes next is<br><span>an opportunity.</span></h2>
        </div>
        <div class="mission-copy">
          <p>We believe recycling should feel like a natural next step. ReCircle connects people with recyclers so materials move from homes to recovery with clarity and fair value.</p>
          <BaseButton variant="secondary" @click="showPreview = true">Our mission <AppIcon name="external" :size="16" /></BaseButton>
        </div>
      </div>
    </section>

    <BaseModal v-model:open="showPreview" title="Building a better circle">
      <p class="muted">ReCircle helps Africa identify recyclables, estimate their worth, and coordinate pickup with trusted recyclers — so less waste is lost and more value stays in the community.</p>
      <template #footer><BaseButton @click="showPreview = false">Got it</BaseButton></template>
    </BaseModal>
  </div>
</template>

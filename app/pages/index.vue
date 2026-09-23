<script setup lang="ts">
const showPreview = ref(false)
const area = ref('')
const areaSubmitted = ref(false)

function submitArea() {
  areaSubmitted.value = true
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
                <svg viewBox="0 0 24 24" fill="none" width="18" height="18">
                  <path d="M12 21s7-5.4 7-11a7 7 0 1 0-14 0c0 5.6 7 11 7 11Z" stroke="currentColor" stroke-width="1.8" />
                  <circle cx="12" cy="10" r="2.4" stroke="currentColor" stroke-width="1.8" />
                </svg>
              </span>
              <input
                id="hero-area"
                v-model="area"
                type="text"
                autocomplete="address-level2"
                placeholder="Enter your area in Nigeria"
                required
              >
            </div>
          </div>
          <BaseButton type="submit" variant="secondary">Check pickup</BaseButton>
        </form>
        <p v-if="areaSubmitted" class="hero-area-confirmation" role="status">Thanks — we’ll check pickup options for {{ area }}.</p>
        <a class="hero-area-why" href="#what-you-can-recycle">Why do we need your area?</a>
      </div>

      <div class="hero-media container" aria-label="ReCircle demo video">
        <div class="demo-video-frame">
          <video
            class="demo-video"
            poster="/demo-video-poster.jpg"
            autoplay
            muted
            loop
            playsinline
            controls
            preload="metadata"
          >
            <source src="/Demo-video.mp4" type="video/mp4">
          </video>
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
          <p class="eyebrow">Made for the Nigeria we believe in</p>
          <h2>Waste is a challenge.<br>What comes next is<br><span>an opportunity.</span></h2>
        </div>
        <div class="mission-copy">
          <p>We believe recycling should feel like a natural next step. ReCircle connects people, recyclers, and waste operators so materials move from homes to recovery with clarity and fair value.</p>
          <BaseButton variant="secondary" @click="showPreview = true">Our mission <span aria-hidden="true">↗</span></BaseButton>
        </div>
      </div>
    </section>

    <BaseModal v-model:open="showPreview" title="Building a better circle">
      <p class="muted">ReCircle helps Nigeria identify recyclables, estimate their worth, and coordinate pickup with trusted recyclers and operators — so less waste is lost and more value stays in the community.</p>
      <template #footer><BaseButton @click="showPreview = false">Got it</BaseButton></template>
    </BaseModal>
  </div>
</template>

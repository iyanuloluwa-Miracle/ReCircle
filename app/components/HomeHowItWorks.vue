<script setup lang="ts">
const steps = [
  {
    id: 'scan',
    number: '01',
    title: 'Scan your material',
    description: 'Take a clear photo. ReCircle identifies the recyclable and flags what to prepare before pickup.',
    image: '/how-it-works/scan.png',
    imageAlt: 'Smartphone photographing a plastic bottle for recycling identification'
  },
  {
    id: 'value',
    number: '02',
    title: 'Know its value',
    description: 'Add the weight. Transparent recycler pricing powers an estimate so you understand what the material is worth.',
    image: '/how-it-works/value.png',
    imageAlt: 'Recyclable can weighed to estimate material value'
  },
  {
    id: 'pickup',
    number: '03',
    title: 'Request a pickup',
    description: 'Match with a nearby recycler, request collection, and keep materials moving into a second life.',
    image: '/how-it-works/pickup.png',
    imageAlt: 'Sorted recyclables ready for household pickup'
  }
]
</script>

<template>
  <section id="how-it-works" class="how-it-works" aria-labelledby="how-it-works-heading">
    <div class="container">
      <header class="how-it-works-intro">
        <p class="eyebrow">How it works</p>
        <h2 id="how-it-works-heading">From your hands. Back into the circle.</h2>
        <p>Three clear steps from a photo to a matched recycler—built to make recycling feel like the natural next move.</p>
      </header>

      <ol class="how-it-works-grid">
        <li v-for="step in steps" :key="step.id" class="how-step">
          <article>
            <div class="how-step-media">
              <img :src="step.image" :alt="step.imageAlt" loading="lazy" decoding="async">
              <span class="how-step-number" aria-hidden="true">{{ step.number }}</span>
            </div>
            <div class="how-step-copy">
              <h3>{{ step.title }}</h3>
              <p>{{ step.description }}</p>
            </div>
          </article>
        </li>
      </ol>

      <div class="how-it-works-cta">
        <BaseButton to="/register" variant="secondary">Get started <AppIcon name="external" :size="16" /></BaseButton>
      </div>
    </div>
  </section>
</template>

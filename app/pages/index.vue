<script setup lang="ts">
const showPreview = ref(false)
const email = ref('')
const emailSubmitted = ref(false)

function submitEmail() {
  emailSubmitted.value = true
}

const steps = [
  { number: '01', title: 'See the potential.', description: 'The planned experience starts with a photo to help identify your recyclable material.', symbol: '⌁' },
  { number: '02', title: 'Know its value.', description: 'Add the weight. Recycler prices will power a transparent estimate, calculated by the platform.', symbol: '₦' },
  { number: '03', title: 'Keep it moving.', description: 'Find a suitable recycler nearby and coordinate a pickup that gives your material a new beginning.', symbol: '↗' }
]
const roles = [
  { title: 'For everyday recyclers', label: 'Consumers', copy: 'Make room at home. Make a difference outside it. A simpler route from sorted waste to its next use.' },
  { title: 'For recycling businesses', label: 'Recyclers', copy: 'Connect with people who have the materials you need, with clearer information before every pickup.' },
  { title: 'For the people connecting it all', label: 'Waste operators', copy: 'Bring pickups, people and progress into one place, so less gets lost along the way.' }
]
</script>

<template>
  <div>
    <section class="hero container">
      <div class="hero-copy">
        <p class="location-label">ReCircle Pickups</p>
        <h1>The scan that turns waste into <span>value.</span></h1>
        <p class="hero-description">
          Snap it. Know its worth. Find a recycler nearby.
        </p>
        <form class="hero-email-form" @submit.prevent="submitEmail">
          <div class="hero-email-fields">
            <label for="hero-email">See what we offer in your neighborhood</label>
            <input
              id="hero-email"
              v-model="email"
              type="email"
              autocomplete="email"
              placeholder="Enter your email"
              required
            >
          </div>
          <BaseButton type="submit">Get started</BaseButton>
        </form>
        <p v-if="emailSubmitted" class="hero-email-confirmation" role="status">Thanks — we’ll be in touch.</p>
        <a class="hero-email-why" href="#how-it-works">Why do we need your email?</a>
      </div>
    </section>

    <div class="principles-strip"><div class="container principles-inner"><span>Built around people.</span><span aria-hidden="true">✳</span><span>Rooted in Lagos.</span><span aria-hidden="true">✳</span><span>Made for a second life.</span><span aria-hidden="true">✳</span></div></div>

    <section id="how-it-works" class="section container">
      <div class="section-heading"><div><p class="eyebrow">Small steps. Real possibility.</p><h2>From your hands.<br>Back into the circle.</h2></div><p>A connected recycling experience,<br>designed to make the next step clearer.</p></div>
      <div class="steps-grid">
        <BaseCard v-for="step in steps" :key="step.number" class="step-card">
          <div class="step-top"><span class="step-symbol" aria-hidden="true">{{ step.symbol }}</span><span class="step-number">{{ step.number }}</span></div>
          <h3>{{ step.title }}</h3><p>{{ step.description }}</p>
        </BaseCard>
      </div>
      <p class="preview-caption"><BaseBadge tone="green">In development</BaseBadge> This is our planned experience. Recycling requests are not available in this preview.</p>
    </section>

    <section id="our-circle" class="circle-section">
      <div class="container section">
        <div class="section-heading"><div><p class="eyebrow">Better, together</p><h2>One city.<br>A connected circle.</h2></div><p>Good systems connect people.<br>We're starting with three sides of the same story.</p></div>
        <div class="roles-grid">
          <article v-for="(role, index) in roles" :key="role.label" class="role-card"><span class="role-index">0{{ index + 1 }} / {{ role.label }}</span><h3>{{ role.title }}</h3><p>{{ role.copy }}</p></article>
        </div>
      </div>
    </section>

    <section id="the-mission" class="section container">
      <div class="mission-panel"><div><p class="eyebrow">Made for the Lagos we believe in</p><h2>Waste is a challenge.<br>What comes next is<br><span>an opportunity.</span></h2></div><div class="mission-copy"><p>We believe recycling should feel like a natural next step. ReCircle is a hackathon prototype exploring how technology can help people, recyclers and waste operators work better together.</p><BaseButton variant="secondary" @click="showPreview = true">About this preview <span aria-hidden="true">↗</span></BaseButton></div></div>
    </section>

    <BaseModal v-model:open="showPreview" title="A first step for ReCircle">
      <p class="muted">You're exploring our application foundation: the public website and workspace shell. Material identification, pricing, pickup coordination and analytics are planned for later phases.</p>
      <template #footer><BaseButton @click="showPreview = false">Got it</BaseButton></template>
    </BaseModal>
  </div>
</template>

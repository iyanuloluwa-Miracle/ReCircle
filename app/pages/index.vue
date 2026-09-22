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
        <div class="location-label"><span class="status-dot" /> Recycling made rewarding</div>
        <h1>The smarter way to turn waste<br>into <span>value.</span></h1>
        <form class="hero-email-form" @submit.prevent="submitEmail">
          <label class="sr-only" for="hero-email">Lagos area</label>
          <input id="hero-email" v-model="email" autocomplete="address-level2" placeholder="Enter your Lagos area" required>
          <BaseButton type="submit">Keep me posted <span aria-hidden="true">→</span></BaseButton>
        </form>
        <p v-if="emailSubmitted" class="hero-email-confirmation" role="status">Thanks — we’ll be in touch.</p>
        <p class="hero-description">Photograph your recyclable waste, discover its material and fair value, then connect with a trusted recycler near you.</p>
        <p class="hero-scan-note">Or scan first—we'll help you find the right recycler afterward.</p>
        <div class="hero-actions">
          <BaseButton to="/demo">Explore ReCircle <span aria-hidden="true">↗</span></BaseButton>
          <BaseButton variant="ghost" to="/#how-it-works">See how it works <span aria-hidden="true">↓</span></BaseButton>
        </div>
        <div class="hero-footnote"><span class="mini-orbit" aria-hidden="true">↻</span> Less waste. More value. One connected circle.</div>
      </div>
      <div class="hero-art" role="img" aria-label="Illustration of a reusable bottle surrounded by a circular path, representing a second life for materials">
        <div class="art-topline"><span>RETHINK. RECYCLE. REPEAT.</span><span aria-hidden="true">↗</span></div>
        <div class="orbit orbit-one" /><div class="orbit orbit-two" />
        <span class="orbit-label orbit-label-top">A little change</span>
        <svg class="bottle-art" viewBox="0 0 240 370" fill="none" aria-hidden="true">
          <defs>
            <linearGradient id="bottle-fill" x1="55" y1="130" x2="186" y2="275" gradientUnits="userSpaceOnUse"><stop stop-color="#D1E7B5" /><stop offset=".48" stop-color="#A8CA8F" /><stop offset="1" stop-color="#6D9A6C" /></linearGradient>
            <linearGradient id="bottle-shine" x1="70" y1="150" x2="104" y2="150" gradientUnits="userSpaceOnUse"><stop stop-color="white" stop-opacity=".55" /><stop offset="1" stop-color="white" stop-opacity="0" /></linearGradient>
          </defs>
          <ellipse cx="123" cy="339" rx="68" ry="12" fill="#082D24" opacity=".2" />
          <path d="M96 54h48v38c0 22 41 36 41 66v146c0 19-13 28-30 28H85c-17 0-30-9-30-28V158c0-30 41-44 41-66V54Z" fill="url(#bottle-fill)" stroke="#DDF0C6" stroke-width="2" />
          <path d="M102 68v23c0 29-34 43-34 68v142c0 12 6 18 18 18h9V157c0-33 21-38 21-68V68h-14Z" fill="url(#bottle-shine)" />
          <rect x="90" y="40" width="60" height="30" rx="8" fill="#D5F491" />
          <path d="M99 44v21m10-21v21m11-21v21m11-21v21m10-21v21" stroke="#97B56A" stroke-width="2" />
          <path d="M56 184h129v86H56z" fill="#F5F4E9" />
          <path d="m119 202 15 9-5 9m5-9-12 2m19 25-16 9-5-9m5 9 5-11m-28-19v19h10m-10 0 6-10" stroke="#214F3C" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" />
          <path d="M67 286h106M67 303h106" stroke="#648D62" stroke-opacity=".4" stroke-width="3" />
        </svg>
        <div class="material-note"><span class="material-icon" aria-hidden="true">↻</span><div><strong>New life. Same material.</strong><span>Keep the good going.</span></div></div>
        <span class="orbit-label orbit-label-bottom">A bigger possibility</span>
        <div class="art-bottomline"><span>THE FUTURE IS CIRCULAR</span><span>01 / LAGOS</span></div>
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

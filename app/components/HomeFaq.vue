<script setup lang="ts">
const faqs = [
  {
    id: 'what-is-recircle',
    question: 'What is ReCircle?',
    answer: 'ReCircle is a Nigeria-first recycling platform that helps people identify recyclable materials, estimate their value, and connect with nearby recyclers.'
  },
  {
    id: 'how-scan-works',
    question: 'How does the scan work?',
    answer: 'Take a photo of your recyclable item. ReCircle analyses the material, suggests preparation steps, and helps you find a recycler that can accept it.'
  },
  {
    id: 'what-materials',
    question: 'What materials can I recycle?',
    answer: 'We currently focus on plastic bottles, cardboard, aluminium cans, glass, paper, and small e-waste. Check the “What you can recycle” section for examples and prep tips.'
  },
  {
    id: 'why-area',
    question: 'Why do you ask for my area?',
    answer: 'Your area helps us show relevant pickup coverage and nearby recycler options across Nigeria. We use it to personalise availability, not to share your address publicly.'
  },
  {
    id: 'who-is-it-for',
    question: 'Who is ReCircle for?',
    answer: 'Consumers who want clearer recycling routes and recyclers who need matched supply.'
  },
  {
    id: 'is-live',
    question: 'Is pickup available today?',
    answer: 'Yes — once you scan an item and match a nearby recycler, you can request pickup and track the job from your dashboard.'
  }
]

const openId = ref<string | null>(null)

function toggle(id: string) {
  openId.value = openId.value === id ? null : id
}
</script>

<template>
  <section id="faq" class="home-faq" aria-labelledby="faq-heading">
    <div class="container">
      <header class="home-faq-intro">
        <p class="eyebrow">Questions, answered</p>
        <h2 id="faq-heading">Everything you need to know about ReCircle.</h2>
      </header>

      <div class="home-faq-list">
        <div v-for="item in faqs" :key="item.id" class="home-faq-item" :class="{ 'is-open': openId === item.id }">
          <h3>
            <button
              type="button"
              class="home-faq-trigger"
              :aria-expanded="openId === item.id"
              :aria-controls="`faq-panel-${item.id}`"
              :id="`faq-trigger-${item.id}`"
              @click="toggle(item.id)"
            >
              <span>{{ item.question }}</span>
              <span class="home-faq-icon" aria-hidden="true">{{ openId === item.id ? '−' : '+' }}</span>
            </button>
          </h3>
          <div
            :id="`faq-panel-${item.id}`"
            class="home-faq-panel"
            role="region"
            :aria-labelledby="`faq-trigger-${item.id}`"
            :hidden="openId !== item.id"
          >
            <p>{{ item.answer }}</p>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
type CategoryTone = 'blue' | 'mustard' | 'forest' | 'terracotta'

type RecycleCategory = {
  id: string
  number: string
  name: string
  materialCode: string
  recyclability: string
  summary: string
  examples: string[]
  preparation: string
  tone: CategoryTone
  image: string
  imageAlt: string
}

const categories: RecycleCategory[] = [
  {
    id: 'plastic-bottles',
    number: '01',
    name: 'Plastic bottles',
    materialCode: 'PET',
    recyclability: 'Highly recyclable',
    summary: 'Clear and coloured drink bottles that can be remade into new packaging and fibre.',
    examples: ['Water bottles', 'Soft-drink bottles', 'Juice bottles'],
    preparation: 'Empty, rinse lightly, and leave caps on if your collector accepts them.',
    tone: 'blue',
    image: '/categories/plastic-bottles.png',
    imageAlt: 'Clear plastic bottles arranged for recycling'
  },
  {
    id: 'cardboard',
    number: '02',
    name: 'Cardboard',
    materialCode: 'CORRUGATED',
    recyclability: 'Readily recyclable',
    summary: 'Clean shipping and packaging board that fibre mills can turn into new boxes.',
    examples: ['Delivery boxes', 'Cereal boxes', 'Dry food cartons'],
    preparation: 'Flatten boxes and remove plastic tape, foam, and food residue.',
    tone: 'mustard',
    image: '/categories/cardboard.png',
    imageAlt: 'Flattened cardboard boxes stacked for recycling'
  },
  {
    id: 'aluminium-cans',
    number: '03',
    name: 'Aluminium cans',
    materialCode: 'ALUMINUM',
    recyclability: 'Infinitely recyclable',
    summary: 'Beverage cans keep nearly all of their value and melt back into new metal quickly.',
    examples: ['Soft-drink cans', 'Energy-drink cans', 'Canned-beverage tins'],
    preparation: 'Empty and rinse. Crushing is optional but helps save space.',
    tone: 'forest',
    image: '/categories/aluminium-cans.png',
    imageAlt: 'Empty aluminium beverage cans ready for recycling'
  },
  {
    id: 'glass',
    number: '04',
    name: 'Glass',
    materialCode: 'GLASS',
    recyclability: 'Fully recyclable',
    summary: 'Bottles and jars can be remelted endlessly without losing quality.',
    examples: ['Drink bottles', 'Sauce jars', 'Preserve jars'],
    preparation: 'Rinse clean. Remove lids when possible and never include broken ceramics.',
    tone: 'terracotta',
    image: '/categories/glass.png',
    imageAlt: 'Glass bottles and jars prepared for recycling'
  },
  {
    id: 'paper',
    number: '05',
    name: 'Paper',
    materialCode: 'PAPER',
    recyclability: 'Readily recyclable',
    summary: 'Clean paper fibre that printers and mills can process into new sheets and packaging.',
    examples: ['Office paper', 'Newspapers', 'Magazines'],
    preparation: 'Keep dry and free of food, oil, and plastic windows.',
    tone: 'blue',
    image: '/categories/paper.png',
    imageAlt: 'Stacks of clean paper ready for recycling'
  },
  {
    id: 'e-waste',
    number: '06',
    name: 'E-waste',
    materialCode: 'EWASTE',
    recyclability: 'Special handling',
    summary: 'Small electronics hold recoverable metals and need responsible collection channels.',
    examples: ['Phones', 'Chargers', 'Earphones'],
    preparation: 'Wipe personal data where possible and keep batteries with the device.',
    tone: 'mustard',
    image: '/categories/e-waste.png',
    imageAlt: 'Small electronics and chargers prepared for e-waste collection'
  }
]

const activeId = ref(categories[0]!.id)
const itemRefs = ref<HTMLElement[]>([])
const reduceMotion = ref(false)
let scrollingProgrammatically = false
let unlockTimer: ReturnType<typeof setTimeout> | null = null
let frame = 0

const activeCategory = computed(() => categories.find(entry => entry.id === activeId.value) ?? categories[0]!)
const activeIndex = computed(() => categories.findIndex(entry => entry.id === activeId.value))

function setItemRef(el: unknown, index: number) {
  if (el instanceof HTMLElement) itemRefs.value[index] = el
}

function pickClosestCategory() {
  if (scrollingProgrammatically || !itemRefs.value.length) return

  const viewportCenter = window.innerHeight * 0.45
  let bestId = activeId.value
  let bestDistance = Number.POSITIVE_INFINITY

  for (const category of categories) {
    const node = itemRefs.value.find(entry => entry?.dataset.categoryId === category.id)
    if (!node) continue
    const rect = node.getBoundingClientRect()
    if (rect.bottom < 0 || rect.top > window.innerHeight) continue
    const midpoint = rect.top + rect.height / 2
    const distance = Math.abs(midpoint - viewportCenter)
    const adjusted = category.id === activeId.value ? distance - 28 : distance
    if (adjusted < bestDistance) {
      bestDistance = adjusted
      bestId = category.id
    }
  }

  if (bestId !== activeId.value) activeId.value = bestId
}

function onScroll() {
  if (frame) return
  frame = window.requestAnimationFrame(() => {
    frame = 0
    pickClosestCategory()
  })
}

function activateCategory(id: string) {
  activeId.value = id
  const node = itemRefs.value.find(entry => entry?.dataset.categoryId === id)
  if (!node) return

  scrollingProgrammatically = true
  if (unlockTimer) clearTimeout(unlockTimer)

  node.scrollIntoView({
    behavior: reduceMotion.value ? 'auto' : 'smooth',
    block: 'center'
  })

  unlockTimer = setTimeout(() => {
    scrollingProgrammatically = false
    pickClosestCategory()
  }, reduceMotion.value ? 50 : 650)
}

onMounted(() => {
  reduceMotion.value = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  pickClosestCategory()
  window.addEventListener('scroll', onScroll, { passive: true })
  window.addEventListener('resize', onScroll)
})

onBeforeUnmount(() => {
  window.removeEventListener('scroll', onScroll)
  window.removeEventListener('resize', onScroll)
  if (frame) cancelAnimationFrame(frame)
  if (unlockTimer) clearTimeout(unlockTimer)
})
</script>

<template>
  <section id="what-you-can-recycle" class="recycle-categories" aria-labelledby="recycle-categories-heading">
    <div class="container">
      <header class="recycle-categories-intro">
        <p class="eyebrow">Accepted materials</p>
        <h2 id="recycle-categories-heading">What you can recycle</h2>
        <p>Six everyday streams ReCircle is built to recognise, value, and route to the right recycler.</p>
      </header>

      <div class="recycle-categories-layout">
        <aside class="recycle-sticky" aria-live="polite" aria-atomic="true">
          <div class="recycle-visual" :data-tone="activeCategory.tone">
            <div class="recycle-visual-media">
              <div class="recycle-visual-stack" aria-hidden="true">
                <img
                  v-for="category in categories"
                  :key="category.id"
                  :src="category.image"
                  alt=""
                  class="recycle-visual-photo"
                  :class="{ 'is-active': category.id === activeId }"
                  loading="lazy"
                  decoding="async"
                >
              </div>
              <div class="recycle-visual-scrim" />
              <div class="recycle-visual-overlay">
                <div class="recycle-visual-meta">
                  <span class="recycle-visual-progress">{{ activeCategory.number }} / 06</span>
                  <span class="recycle-visual-label">{{ activeCategory.recyclability }}</span>
                </div>
                <h3>{{ activeCategory.name }}</h3>
                <p class="recycle-visual-code">Material · {{ activeCategory.materialCode }}</p>
              </div>
              <div class="recycle-visual-dots" aria-hidden="true">
                <span
                  v-for="(category, index) in categories"
                  :key="category.id"
                  :class="{ 'is-active': index === activeIndex }"
                />
              </div>
            </div>
            <div class="recycle-visual-bottom">
              <p class="recycle-visual-kicker">Accepted examples</p>
              <ul>
                <li v-for="example in activeCategory.examples" :key="example">{{ example }}</li>
              </ul>
              <p class="recycle-visual-prep"><strong>Prep:</strong> {{ activeCategory.preparation }}</p>
            </div>
          </div>
        </aside>

        <ul class="recycle-list">
          <li v-for="(category, index) in categories" :key="category.id" class="recycle-list-item">
            <button
              :ref="el => setItemRef(el, index)"
              type="button"
              class="recycle-item"
              :data-category-id="category.id"
              :data-tone="category.tone"
              :class="{ 'is-active': category.id === activeId }"
              :aria-current="category.id === activeId ? 'true' : undefined"
              @click="activateCategory(category.id)"
            >
              <span class="recycle-item-rail" aria-hidden="true" />
              <span class="recycle-item-thumb">
                <img :src="category.image" :alt="category.imageAlt" loading="lazy" decoding="async">
              </span>
              <span class="recycle-item-body">
                <span class="recycle-item-number">{{ category.number }}</span>
                <span class="recycle-item-title">{{ category.name }}</span>
                <span class="recycle-item-summary">{{ category.summary }}</span>
                <span class="recycle-item-examples">{{ category.examples.join(' · ') }}</span>
                <span class="recycle-item-prep">{{ category.preparation }}</span>
              </span>
            </button>
          </li>
        </ul>
      </div>
    </div>
  </section>
</template>

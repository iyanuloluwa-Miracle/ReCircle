<script setup lang="ts">
const roles = [
  {
    id: 'consumers',
    title: 'Consumers',
    copy: 'Scan waste, discover value, request pickup and track earnings.',
    image: '/roles/consumers.png',
    imageAlt: 'Person scanning a recyclable bottle with a smartphone'
  },
  {
    id: 'recyclers',
    title: 'Recyclers',
    copy: 'Review matched supply, accept requests and manage collections.',
    image: '/roles/recyclers.png',
    imageAlt: 'Modern recycling facility with sorted material bales'
  },
  {
    id: 'operators',
    title: 'Waste operators',
    copy: 'Monitor requests, coordinate batches and analyse performance.',
    image: '/roles/operators.png',
    imageAlt: 'Operations desk with logistics and network monitors'
  }
]
</script>

<template>
  <section id="platform-roles" class="platform-roles" aria-labelledby="platform-roles-heading">
    <div class="container">
      <header class="platform-roles-intro">
        <p class="eyebrow">One connected platform</p>
        <h2 id="platform-roles-heading">Designed for every role in the recycling chain.</h2>
      </header>

      <ul class="platform-roles-grid">
        <li v-for="role in roles" :key="role.id">
          <article class="platform-role">
            <div class="platform-role-media">
              <img :src="role.image" :alt="role.imageAlt" loading="lazy" decoding="async">
            </div>
            <div class="platform-role-copy">
              <h3>{{ role.title }}</h3>
              <p>{{ role.copy }}</p>
            </div>
          </article>
        </li>
      </ul>
    </div>
  </section>
</template>

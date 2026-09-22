<script setup lang="ts">
const open = ref(false)
const route = useRoute()
watch(() => route.fullPath, () => { open.value = false })
</script>

<template>
  <header class="site-header">
    <nav class="container nav-bar" aria-label="Main navigation">
      <BrandMark />
      <button class="menu-toggle" type="button" :aria-expanded="open" aria-controls="main-links" @click="open = !open">
        {{ open ? 'Close' : 'Menu' }} <span aria-hidden="true">{{ open ? '−' : '+' }}</span>
      </button>
      <div id="main-links" class="nav-links" :class="{ 'is-open': open }">
        <NuxtLink to="/#what-you-can-recycle" @click="open = false">What we take</NuxtLink>
        <NuxtLink to="/#how-it-works" @click="open = false">How it works</NuxtLink>
        <NuxtLink to="/#our-circle" @click="open = false">Our circle</NuxtLink>
        <NuxtLink to="/#the-mission" @click="open = false">The mission</NuxtLink>
        <NuxtLink to="/login" @click="open = false">Sign in</NuxtLink>
        <BaseButton to="/demo" size="sm">Try the demo <span aria-hidden="true">↗</span></BaseButton>
      </div>
    </nav>
  </header>
</template>

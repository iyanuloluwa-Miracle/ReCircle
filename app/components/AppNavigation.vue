<script setup lang="ts">
const open = ref(false)
const route = useRoute()
watch(() => route.fullPath, () => { open.value = false })
</script>

<template>
  <header class="site-header">
    <nav class="container nav-bar" aria-label="Main navigation">
      <BrandMark />
      <button
        class="menu-toggle"
        type="button"
        :class="{ 'is-open': open }"
        :aria-expanded="open"
        aria-controls="main-links"
        :aria-label="open ? 'Close menu' : 'Open menu'"
        @click="open = !open"
      >
        <span class="menu-toggle-bar" aria-hidden="true" />
        <span class="menu-toggle-bar" aria-hidden="true" />
        <span class="menu-toggle-bar" aria-hidden="true" />
      </button>
      <div id="main-links" class="nav-links" :class="{ 'is-open': open }">
        <NuxtLink to="/#what-you-can-recycle" @click="open = false">What we take</NuxtLink>
        <NuxtLink to="/#platform-roles" @click="open = false">Who it’s for</NuxtLink>
        <NuxtLink to="/#how-it-works" @click="open = false">How it works</NuxtLink>
        <NuxtLink to="/#faq" @click="open = false">FAQ</NuxtLink>
        <NuxtLink to="/#the-mission" @click="open = false">The mission</NuxtLink>
        <NuxtLink to="/login" @click="open = false">Sign in</NuxtLink>
        <BaseButton to="/demo" size="sm">Try the demo <span aria-hidden="true">↗</span></BaseButton>
      </div>
    </nav>
  </header>
</template>

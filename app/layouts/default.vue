<template>
  <div>
    <a class="skip-link" href="#main-content">Skip to content</a>
    <AppNavigation />
    <main id="main-content"><slot /></main>
    <footer class="site-footer container">
      <BrandMark />
      <p>A little less waste. A lot more possibility.</p>
      <span>Lagos, Nigeria · Hackathon prototype</span>
    </footer>
  </div>
</template>

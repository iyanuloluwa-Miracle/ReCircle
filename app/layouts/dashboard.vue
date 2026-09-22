<template>
  <div class="workspace-shell">
    <a class="skip-link" href="#main-content">Skip to content</a>
    <aside class="workspace-sidebar">
      <BrandMark />
      <p class="eyebrow workspace-label">Your workspace</p>
      <nav aria-label="Workspace navigation">
        <NuxtLink to="/workspace" class="workspace-nav-item" aria-current="page"><span aria-hidden="true">◈</span> Overview</NuxtLink>
        <NuxtLink to="/" class="workspace-nav-item"><span aria-hidden="true">↗</span> Back to home</NuxtLink>
      </nav>
      <div class="workspace-note"><span class="status-dot" /> Built for a better circle.<br><span class="muted">Starting with Lagos.</span></div>
    </aside>
    <div class="workspace-body">
      <header class="workspace-header"><span>Recykle AI / Workspace</span><BaseBadge tone="green">Foundation preview</BaseBadge></header>
      <main id="main-content" class="workspace-main"><slot /></main>
    </div>
  </div>
</template>

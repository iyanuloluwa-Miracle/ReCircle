<script setup lang="ts">
import AdminConsole from './operator.vue'

definePageMeta({ layout: 'dashboard', middleware: 'auth' })
</script>

<template><AdminConsole /></template>

<script setup lang="ts">
import { formatNumber } from '~~/utils/format'
import type { PickupRequestView } from '../../../types'

definePageMeta({ layout: 'dashboard', middleware: 'auth' })
useSeoMeta({ title: 'Activity history — ReCircle', robots: 'noindex' })

type HistoryItem = {
  id: string
  imageUrl: string
  itemName: string | null
  materialCode: string | null
  status: string
  weightKg: number | null
  createdAt: string | null
}

type HistoryResponse = {
  items: HistoryItem[]
  requests: PickupRequestView[]
  itemsTotal: number
  requestsTotal: number
  itemsPage: number
  requestsPage: number
  itemsPageSize: number
  requestsPageSize: number
}

const q = ref('')
const status = ref('')
const itemsPage = ref(1)
const requestsPage = ref(1)

const query = computed(() => ({
  q: q.value || undefined,
  status: status.value || undefined,
  itemsPage: itemsPage.value,
  requestsPage: requestsPage.value
}))

watch([q, status], () => {
  itemsPage.value = 1
  requestsPage.value = 1
}, { flush: 'sync' })

const { data, pending, refresh } = await useAsyncData(
  'history',
  () => $fetch<HistoryResponse>('/api/history', { query: query.value }),
  { watch: [query] }
)

watch(data, (value) => {
  if (!value) return
  if (value.itemsPage !== itemsPage.value) itemsPage.value = value.itemsPage
  if (value.requestsPage !== requestsPage.value) requestsPage.value = value.requestsPage
})

const itemsPageSize = computed(() => data.value?.itemsPageSize ?? 5)
const requestsPageSize = computed(() => data.value?.requestsPageSize ?? 3)
const itemsTotal = computed(() => data.value?.itemsTotal ?? 0)
const requestsTotal = computed(() => data.value?.requestsTotal ?? 0)
const itemsPageCount = computed(() => Math.max(1, Math.ceil(itemsTotal.value / itemsPageSize.value)))
const requestsPageCount = computed(() => Math.max(1, Math.ceil(requestsTotal.value / requestsPageSize.value)))

const itemsRangeLabel = computed(() => {
  if (!itemsTotal.value) return ''
  const start = (itemsPage.value - 1) * itemsPageSize.value + 1
  const end = Math.min(itemsPage.value * itemsPageSize.value, itemsTotal.value)
  return `Showing ${start}–${end} of ${itemsTotal.value}`
})

const requestsRangeLabel = computed(() => {
  if (!requestsTotal.value) return ''
  const start = (requestsPage.value - 1) * requestsPageSize.value + 1
  const end = Math.min(requestsPage.value * requestsPageSize.value, requestsTotal.value)
  return `Showing ${start}–${end} of ${requestsTotal.value}`
})

function itemLink(item: { id: string; status: string }) {
  return item.status === 'draft' || item.status === 'analyzed' ? `/scan/${item.id}/analysis` : `/scan/${item.id}/match`
}

function onRequestUpdated() {
  void refresh()
}
</script>

<template>
  <div class="dash-page">
    <div class="dash-hero">
      <div>
        <p class="eyebrow">Your activity</p>
        <h1 class="page-title">Scan & pickup history.</h1>
        <p class="muted workspace-intro">Find a previous item, check a pickup, or continue where you left off.</p>
      </div>
    </div>

    <div class="history-filters">
      <input v-model="q" type="search" placeholder="Search item, material, or recycler">
      <select v-model="status">
        <option value="">All scan statuses</option>
        <option value="draft">Draft</option>
        <option value="analyzed">Analyzed</option>
        <option value="matched">Matched</option>
        <option value="pickup_requested">Pickup requested</option>
        <option value="picked_up">Picked up</option>
        <option value="completed">Completed</option>
      </select>
      <BaseButton size="sm" variant="ghost" @click="refresh">Refresh</BaseButton>
    </div>

    <LoadingSkeleton v-if="pending" :lines="6" label="Loading history" />
    <template v-else>
      <DashboardSection title="Your scans" description="Recent items, from first photo to completed recycling.">
        <template v-if="itemsRangeLabel" #action>
          <span class="history-range">{{ itemsRangeLabel }}</span>
        </template>
        <div v-if="data?.items.length" class="history-list">
          <NuxtLink v-for="item in data.items" :key="item.id" :to="itemLink(item)">
            <WasteThumb :src="item.imageUrl" :alt="item.itemName || 'Waste scan'" />
            <div>
              <strong>{{ item.itemName || item.materialCode || 'Draft item' }}</strong>
              <span>{{ item.status.replaceAll('_', ' ') }}{{ item.weightKg != null ? ` · ${formatNumber(item.weightKg)} kg` : '' }}</span>
            </div>
            <time v-if="item.createdAt">{{ new Date(item.createdAt).toLocaleDateString('en-NG') }}</time>
          </NuxtLink>
        </div>
        <EmptyState v-else compact title="No scans found" description="Try a different search or scan a new item." />
        <nav v-if="itemsPageCount > 1" class="history-pagination" aria-label="Scans pagination">
          <BaseButton size="sm" variant="ghost" :disabled="itemsPage <= 1" @click="itemsPage -= 1">Previous</BaseButton>
          <span>Page {{ itemsPage }} of {{ itemsPageCount }}</span>
          <BaseButton size="sm" variant="ghost" :disabled="itemsPage >= itemsPageCount" @click="itemsPage += 1">Next</BaseButton>
        </nav>
      </DashboardSection>

      <DashboardSection title="Pickup requests" description="Every recycler request and its latest status.">
        <template v-if="requestsRangeLabel" #action>
          <span class="history-range">{{ requestsRangeLabel }}</span>
        </template>
        <div v-if="data?.requests.length" class="request-list">
          <RequestCard
            v-for="request in data.requests"
            :key="request.id"
            :request="request"
            role="user"
            compact
            @updated="onRequestUpdated"
          />
        </div>
        <EmptyState v-else compact title="No pickup requests found" description="Pickup requests will appear here once you choose a recycler." />
        <nav v-if="requestsPageCount > 1" class="history-pagination" aria-label="Pickup requests pagination">
          <BaseButton size="sm" variant="ghost" :disabled="requestsPage <= 1" @click="requestsPage -= 1">Previous</BaseButton>
          <span>Page {{ requestsPage }} of {{ requestsPageCount }}</span>
          <BaseButton size="sm" variant="ghost" :disabled="requestsPage >= requestsPageCount" @click="requestsPage += 1">Next</BaseButton>
        </nav>
      </DashboardSection>
    </template>
  </div>
</template>

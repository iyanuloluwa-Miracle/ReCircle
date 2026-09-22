<script setup lang="ts">
import { formatNaira, formatNumber } from '~~/utils/format'

defineProps<{
  batch: {
    batchNumber: number
    pickupCount: number
    totalWeightKg: number
    estimatedRecyclerValueNgn: number
    suggestedSequenceLabels: string[]
    suggestedOrder: Array<{
      order: number
      areaLabel: string
      latitude: number
      longitude: number
      weightKg: number
      expectedPayout: number
      materialCode: string | null
      status: string
    }>
    naiveDistanceKm: number
    suggestedDistanceKm: number
    distanceSavedKm: number
  }
}>()
</script>

<template>
  <article class="batch-card">
    <header class="batch-card-head">
      <div>
        <p class="analysis-kicker">Collection batch #{{ batch.batchNumber }}</p>
        <h3>{{ batch.pickupCount }} pickups</h3>
      </div>
      <BaseBadge tone="green">SUGGESTED SEQUENCE</BaseBadge>
    </header>

    <div class="batch-card-stats">
      <div>
        <span>Material</span>
        <strong>{{ formatNumber(batch.totalWeightKg) }} kg recyclable</strong>
      </div>
      <div>
        <span>Estimated recycler value</span>
        <strong>{{ formatNaira(batch.estimatedRecyclerValueNgn) }}</strong>
      </div>
    </div>

    <div class="batch-card-columns">
      <div>
        <p class="batch-subtitle">Suggested order</p>
        <ol class="batch-order-list">
          <li v-for="stop in batch.suggestedOrder" :key="stop.order">
            <strong>{{ stop.order }}. {{ stop.areaLabel }}</strong>
            <span class="muted">{{ stop.materialCode || 'Material' }} · {{ formatNumber(stop.weightKg) }} kg · {{ stop.status }}</span>
          </li>
        </ol>

        <div class="batch-distance-compare">
          <div>
            <span>Original naive estimate</span>
            <strong>{{ formatNumber(batch.naiveDistanceKm) }} km</strong>
          </div>
          <div>
            <span>Suggested sequence estimate</span>
            <strong>{{ formatNumber(batch.suggestedDistanceKm) }} km</strong>
          </div>
          <p class="muted">
            {{ batch.distanceSavedKm > 0
              ? `About ${formatNumber(batch.distanceSavedKm)} km less straight-line travel than id order.`
              : 'Sequence matches or ties the naive baseline for this cluster.' }}
          </p>
        </div>
      </div>

      <BatchSequenceMap :stops="batch.suggestedOrder" />
    </div>
  </article>
</template>

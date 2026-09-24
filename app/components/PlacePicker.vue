<script setup lang="ts">
import type { GeoPoint } from '../../types'

type LatLngLiteral = { lat: number; lng: number }

type MapsApi = {
  Map: new (el: HTMLElement, opts: Record<string, unknown>) => {
    setCenter: (p: LatLngLiteral) => void
    setZoom: (z: number) => void
  }
  Marker: new (opts: Record<string, unknown>) => {
    setPosition: (p: LatLngLiteral) => void
  }
  event: { clearInstanceListeners: (target: unknown) => void }
  places: {
    Autocomplete: new (
      input: HTMLInputElement,
      opts: Record<string, unknown>
    ) => {
      bindTo: (key: string, map: unknown) => void
      addListener: (event: string, handler: () => void) => void
      getPlace: () => {
        formatted_address?: string
        name?: string
        geometry?: { location?: { lat: () => number; lng: () => number } }
      }
    }
  }
}

const NIGERIA_CENTER = { lat: 9.082, lng: 8.6753 }
const DEFAULT_ZOOM = 6
const SELECTED_ZOOM = 15

const props = withDefaults(defineProps<{
  location?: GeoPoint | null
  label?: string
  disabled?: boolean
  inputId?: string
  placeholder?: string
}>(), {
  location: null,
  label: '',
  disabled: false,
  inputId: 'place-picker-input',
  placeholder: 'Search an address in Nigeria'
})

const emit = defineEmits<{
  select: [payload: { location: GeoPoint; label: string }]
}>()

const { configured, loadMaps } = useGoogleMaps()
const inputEl = ref<HTMLInputElement | null>(null)
const mapEl = ref<HTMLDivElement | null>(null)
const STATUS_LABELS = new Set([
  'Choose a pickup location',
  'Saved pickup location',
  'Current device location',
  'Demo pickup location · Nigeria',
  'Manually entered pickup location',
  'Selected pickup location'
])

function displayLabel(value: string | undefined): string {
  const trimmed = (value || '').trim()
  if (!trimmed || STATUS_LABELS.has(trimmed)) return ''
  return trimmed
}

const query = ref(displayLabel(props.label))
const loadError = ref('')
const lookingUp = ref(false)
const mapsReady = ref(false)

let mapsApi: MapsApi | null = null
let map: InstanceType<MapsApi['Map']> | null = null
let marker: InstanceType<MapsApi['Marker']> | null = null
let autocomplete: InstanceType<MapsApi['places']['Autocomplete']> | null = null

function pointToLatLng(point: GeoPoint): LatLngLiteral {
  const [lng, lat] = point.coordinates
  return { lat, lng }
}

function syncMap(point: GeoPoint | null | undefined) {
  if (!map || !mapsApi || !point) return
  const position = pointToLatLng(point)
  map.setCenter(position)
  map.setZoom(SELECTED_ZOOM)
  if (marker) {
    marker.setPosition(position)
  } else {
    marker = new mapsApi.Marker({ map, position })
  }
}

function applyPlace(location: GeoPoint, label: string) {
  query.value = label
  emit('select', { location, label })
  syncMap(location)
}

async function geocodeTypedAddress() {
  const text = query.value.trim()
  if (text.length < 3 || lookingUp.value || props.disabled) return
  lookingUp.value = true
  loadError.value = ''
  try {
    const result = await $fetch<{ location: GeoPoint; label: string }>('/api/geocode', {
      method: 'POST',
      body: { query: text }
    })
    applyPlace(result.location, result.label)
  } catch (err: unknown) {
    const status = typeof err === 'object' && err && 'statusCode' in err
      ? Number((err as { statusCode?: number }).statusCode)
      : undefined
    if (status === 404) {
      loadError.value = 'No matching address found in Nigeria. Try a clearer street or area name.'
    } else if (status === 503) {
      loadError.value = 'Google Maps is not configured yet. Add the Maps API keys to continue.'
    } else {
      loadError.value = 'Could not look up that address. Try again in a moment.'
    }
  } finally {
    lookingUp.value = false
  }
}

function onPlaceChanged() {
  const place = autocomplete?.getPlace()
  const loc = place?.geometry?.location
  if (!loc) {
    loadError.value = 'Pick an address from the suggestions, or press Enter to look it up.'
    return
  }
  const lat = loc.lat()
  const lng = loc.lng()
  const label = (place.formatted_address || place.name || query.value).trim()
  applyPlace({ type: 'Point', coordinates: [lng, lat] }, label || 'Selected pickup location')
  loadError.value = ''
}

onMounted(async () => {
  if (!configured.value) {
    loadError.value = 'Google Maps is not configured. Add NUXT_PUBLIC_GOOGLE_MAPS_API_KEY to continue.'
    return
  }
  try {
    const loaded = await loadMaps() as unknown as MapsApi
    mapsApi = loaded
    mapsReady.value = true
    await nextTick()
    if (!mapEl.value || !inputEl.value || !mapsApi) return

    map = new mapsApi.Map(mapEl.value, {
      center: props.location ? pointToLatLng(props.location) : NIGERIA_CENTER,
      zoom: props.location ? SELECTED_ZOOM : DEFAULT_ZOOM,
      disableDefaultUI: true,
      zoomControl: true,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false,
      clickableIcons: false
    })

    if (props.location) syncMap(props.location)

    autocomplete = new mapsApi.places.Autocomplete(inputEl.value, {
      fields: ['formatted_address', 'geometry', 'name'],
      componentRestrictions: { country: 'ng' },
      types: ['geocode']
    })
    autocomplete.bindTo('bounds', map)
    autocomplete.addListener('place_changed', onPlaceChanged)
  } catch (error) {
    loadError.value = error instanceof Error
      ? error.message
      : 'Could not load Google Maps.'
  }
})

watch(() => props.location, (next) => {
  if (next) syncMap(next)
}, { deep: true })

watch(() => props.label, (next) => {
  const shown = displayLabel(next)
  if (shown && shown !== query.value && document.activeElement !== inputEl.value) {
    query.value = shown
  }
})

onBeforeUnmount(() => {
  if (autocomplete && mapsApi) {
    mapsApi.event.clearInstanceListeners(autocomplete)
    autocomplete = null
  }
  marker = null
  map = null
  mapsApi = null
})
</script>

<template>
  <div class="place-picker">
    <label :for="inputId">Address</label>
    <div class="place-picker-search">
      <input
        :id="inputId"
        ref="inputEl"
        v-model="query"
        type="text"
        autocomplete="off"
        :placeholder="placeholder"
        :disabled="disabled || !configured || lookingUp"
        @keydown.enter.prevent="geocodeTypedAddress"
      >
      <BaseButton
        variant="ghost"
        size="sm"
        type="button"
        :loading="lookingUp"
        :disabled="disabled || lookingUp || query.trim().length < 3"
        @click="geocodeTypedAddress"
      >
        Look up
      </BaseButton>
    </div>
    <p class="place-picker-hint">Start typing, then pick a suggestion — or press Enter to look up a full address.</p>
    <div
      ref="mapEl"
      class="place-picker-map"
      :class="{ 'is-ready': mapsReady && location }"
      role="img"
      :aria-label="location ? `Map pin for ${label || 'selected location'}` : 'Map preview of Nigeria'"
    />
    <p v-if="loadError" class="place-picker-error" role="alert">{{ loadError }}</p>
  </div>
</template>

<style scoped>
.place-picker {
  display: grid;
  gap: .55rem;
}
.place-picker > label {
  font-size: .75rem;
  font-weight: 650;
  color: #263c34;
}
.place-picker-search {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: .5rem;
  align-items: center;
}
.place-picker-search input {
  width: 100%;
  min-height: 2.65rem;
  border: 1px solid #d5ddd0;
  border-radius: .65rem;
  padding: .65rem .85rem;
  background: #fff;
  color: #123f32;
  font: inherit;
}
.place-picker-search input:focus {
  outline: 2px solid #c5d9a8;
  outline-offset: 1px;
  border-color: #9bb57a;
}
.place-picker-search input:disabled {
  opacity: .65;
  cursor: not-allowed;
}
.place-picker-hint {
  margin: 0;
  font-size: .7rem;
  line-height: 1.45;
  color: #657269;
}
.place-picker-map {
  width: 100%;
  height: 180px;
  border-radius: .75rem;
  border: 1px solid #e6eadf;
  background:
    linear-gradient(160deg, #f4f7ef 0%, #e8eee0 55%, #dde6d2 100%);
  overflow: hidden;
}
.place-picker-map.is-ready {
  border-color: #dbe7c9;
}
.place-picker-error {
  margin: 0;
  font-size: .8125rem;
  color: #9b2c2c;
}
</style>

<style>
/* Places Autocomplete dropdown is attached to document.body */
.pac-container {
  z-index: 10050;
  border-radius: .65rem;
  border: 1px solid #d5ddd0;
  box-shadow: 0 10px 28px #123f3220;
  margin-top: 4px;
  font-family: inherit;
}
.pac-item {
  padding: .55rem .75rem;
  cursor: pointer;
}
.pac-item:hover,
.pac-item-selected {
  background: #f4f7ef;
}
</style>

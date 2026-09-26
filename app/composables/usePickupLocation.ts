import type { GeoPoint } from '../../types'

export type PickupLocationSource = 'device' | 'demo' | 'manual'

type GeocodeResponse = {
  location: GeoPoint
  label: string
}

function geolocationErrorMessage(error: unknown): string {
  const code = typeof error === 'object' && error && 'code' in error
    ? Number((error as { code?: number }).code)
    : undefined
  if (code === 1) {
    return 'Location access is blocked. Allow it in your browser, or search for an address below.'
  }
  if (code === 2) {
    return 'Your device could not determine a position. Search for an address below.'
  }
  if (code === 3) {
    return 'Finding your location timed out. Try again, or search for an address below.'
  }
  return 'Could not access your location. Allow location access or search for an address below.'
}

export function usePickupLocation() {
  const auth = useAuth()
  const location = ref<GeoPoint | null>(null)
  const source = ref<PickupLocationSource | null>(null)
  const label = ref('Choose a pickup location')
  const error = ref('')
  const pending = ref(false)
  const showFallback = ref(false)
  const address = ref('')
  const latitude = ref('')
  const longitude = ref('')

  if (auth.user.value?.isDemo && auth.user.value.location) {
    location.value = auth.user.value.location
    source.value = 'demo'
    label.value = 'Demo pickup location · Africa'
  } else if (auth.user.value?.location) {
    location.value = auth.user.value.location
    source.value = 'manual'
    label.value = 'Saved pickup location'
  }

  function setPlace(next: GeoPoint, nextLabel: string, nextSource: PickupLocationSource = 'manual') {
    location.value = next
    source.value = nextSource
    label.value = nextLabel.trim() || 'Selected pickup location'
    error.value = ''
    showFallback.value = false
    if (nextSource === 'manual' || nextSource === 'demo') {
      address.value = nextLabel.trim()
    }
  }

  async function useDeviceLocation() {
    error.value = ''
    if (!import.meta.client || !navigator.geolocation) {
      error.value = 'Location is unavailable on this device. Search for an address instead.'
      showFallback.value = true
      return
    }
    pending.value = true
    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: false, timeout: 12000, maximumAge: 60000 })
      })
      setPlace(
        { type: 'Point', coordinates: [position.coords.longitude, position.coords.latitude] },
        'Current device location',
        'device'
      )
    } catch (err) {
      error.value = geolocationErrorMessage(err)
      showFallback.value = true
    } finally {
      pending.value = false
    }
  }

  function useManualLocation() {
    error.value = ''
    const lat = Number(latitude.value)
    const lon = Number(longitude.value)
    if (!latitude.value.trim() || !longitude.value.trim() || !Number.isFinite(lat) || !Number.isFinite(lon)
      || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
      error.value = 'Enter a valid latitude and longitude.'
      return
    }
    setPlace(
      { type: 'Point', coordinates: [lon, lat] },
      'Manually entered pickup location',
      'manual'
    )
  }

  async function useAddressLocation() {
    error.value = ''
    const query = address.value.trim()
    if (query.length < 3) {
      error.value = 'Enter a fuller street address (at least a few characters).'
      return
    }
    pending.value = true
    try {
      const result = await $fetch<GeocodeResponse>('/api/geocode', {
        method: 'POST',
        body: { query }
      })
      setPlace(result.location, result.label, 'manual')
    } catch (err: unknown) {
      const status = typeof err === 'object' && err && 'statusCode' in err
        ? Number((err as { statusCode?: number }).statusCode)
        : undefined
      if (status === 404) {
        error.value = 'No matching address found in Africa. Try a clearer street or area name.'
      } else if (status === 503) {
        error.value = 'Google Maps is not configured yet. Add the Maps API keys to continue.'
      } else {
        error.value = 'Could not look up that address. Try again in a moment.'
      }
      showFallback.value = true
    } finally {
      pending.value = false
    }
  }

  return {
    location,
    source,
    label,
    error,
    pending,
    showFallback,
    address,
    latitude,
    longitude,
    setPlace,
    useDeviceLocation,
    useManualLocation,
    useAddressLocation
  }
}

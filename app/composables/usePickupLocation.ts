import type { GeoPoint } from '../../types'

export type PickupLocationSource = 'device' | 'demo' | 'manual'

export function usePickupLocation() {
  const auth = useAuth()
  const location = ref<GeoPoint | null>(null)
  const source = ref<PickupLocationSource | null>(null)
  const label = ref('Choose a pickup location')
  const error = ref('')
  const pending = ref(false)
  const latitude = ref('')
  const longitude = ref('')

  if (auth.user.value?.isDemo && auth.user.value.location) {
    location.value = auth.user.value.location
    source.value = 'demo'
    label.value = 'Demo pickup location · Lagos'
  }

  async function useDeviceLocation() {
    error.value = ''
    if (!import.meta.client || !navigator.geolocation) {
      error.value = 'Location is unavailable on this device. Enter coordinates instead.'
      return
    }
    pending.value = true
    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: false, timeout: 12000, maximumAge: 60000 })
      })
      location.value = { type: 'Point', coordinates: [position.coords.longitude, position.coords.latitude] }
      source.value = 'device'
      label.value = 'Current device location'
    } catch {
      error.value = 'Could not access your location. Allow location access or enter coordinates below.'
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
    location.value = { type: 'Point', coordinates: [lon, lat] }
    source.value = 'manual'
    label.value = 'Manually entered pickup location'
  }

  return { location, source, label, error, pending, latitude, longitude, useDeviceLocation, useManualLocation }
}

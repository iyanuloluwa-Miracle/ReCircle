type MapsNamespace = {
  maps: {
    places?: unknown
  }
}

declare global {
  interface Window {
    google?: MapsNamespace
    __recircleGoogleMapsReady?: () => void
  }
}

const SCRIPT_ID = 'recircle-google-maps'
let mapsPromise: Promise<MapsNamespace['maps']> | null = null

export function useGoogleMaps() {
  const config = useRuntimeConfig()
  const apiKey = computed(() => String(config.public.googleMapsApiKey || '').trim())
  const configured = computed(() => Boolean(apiKey.value))

  async function loadMaps(): Promise<MapsNamespace['maps']> {
    if (!import.meta.client) {
      throw new Error('Google Maps is only available in the browser.')
    }
    if (!apiKey.value) {
      throw new Error('Google Maps is not configured. Add NUXT_PUBLIC_GOOGLE_MAPS_API_KEY.')
    }
    if (window.google?.maps?.places) {
      return window.google.maps
    }
    if (mapsPromise) return mapsPromise

    mapsPromise = new Promise<MapsNamespace['maps']>((resolve, reject) => {
      const existing = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null
      if (existing) {
        const check = () => {
          if (window.google?.maps?.places) resolve(window.google.maps)
          else setTimeout(check, 50)
        }
        check()
        return
      }

      window.__recircleGoogleMapsReady = () => {
        if (window.google?.maps?.places) resolve(window.google.maps)
        else reject(new Error('Google Maps loaded without Places library.'))
      }

      const script = document.createElement('script')
      script.id = SCRIPT_ID
      script.async = true
      script.defer = true
      script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey.value)}&libraries=places&callback=__recircleGoogleMapsReady&v=weekly&region=NG&language=en`
      script.onerror = () => {
        mapsPromise = null
        reject(new Error('Could not load Google Maps.'))
      }
      document.head.appendChild(script)
    })

    try {
      return await mapsPromise
    } catch (error) {
      mapsPromise = null
      throw error
    }
  }

  return { apiKey, configured, loadMaps }
}

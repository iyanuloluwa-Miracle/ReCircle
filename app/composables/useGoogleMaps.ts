type MapsNamespace = {
  maps?: {
    places?: unknown
  }
  accounts?: {
    id: {
      initialize: (config: {
        client_id: string
        callback: (response: { credential?: string }) => void
        auto_select?: boolean
        cancel_on_tap_outside?: boolean
      }) => void
      prompt: (momentListener?: (notification: {
        isNotDisplayed: () => boolean
        isSkippedMoment: () => boolean
        isDismissedMoment: () => boolean
      }) => void) => void
      renderButton: (parent: HTMLElement, options: Record<string, unknown>) => void
    }
  }
}

declare global {
  interface Window {
    google?: MapsNamespace
    __recircleGoogleMapsReady?: () => void
    gm_authFailure?: () => void
  }
}

const SCRIPT_ID = 'recircle-google-maps'
type GoogleMapsApi = NonNullable<MapsNamespace['maps']>
let mapsPromise: Promise<GoogleMapsApi> | null = null

export const MAPS_AUTH_FAILURE_MESSAGE = [
  'Google Maps rejected this API key.',
  'In Google Cloud Console: enable billing, then enable Maps JavaScript API, Places API, and Geocoding API.',
  'For the browser key, set Application restrictions → HTTP referrers to include http://localhost:3000/* and your production domain.',
  'Restart the Nuxt dev server after changing .env.'
].join(' ')

/** Shared so PlacePicker can show Google's async auth failure after the script "succeeds". */
const mapsAuthError = ref('')

export function useGoogleMaps() {
  const config = useRuntimeConfig()
  const apiKey = computed(() => String(config.public.googleMapsApiKey || '').trim())
  const configured = computed(() => Boolean(apiKey.value))

  async function loadMaps(): Promise<GoogleMapsApi> {
    if (!import.meta.client) {
      throw new Error('Google Maps is only available in the browser.')
    }
    if (!apiKey.value) {
      throw new Error('Google Maps is not configured. Add NUXT_PUBLIC_GOOGLE_MAPS_API_KEY to .env and restart the dev server.')
    }
    if (window.google?.maps?.places && !mapsAuthError.value) {
      return window.google.maps
    }
    if (mapsPromise) return mapsPromise

    mapsAuthError.value = ''
    mapsPromise = new Promise<GoogleMapsApi>((resolve, reject) => {
      const fail = (message: string) => {
        mapsAuthError.value = message
        mapsPromise = null
        reject(new Error(message))
      }

      window.gm_authFailure = () => {
        mapsAuthError.value = MAPS_AUTH_FAILURE_MESSAGE
        mapsPromise = null
      }

      const existing = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null
      if (existing) {
        const check = () => {
          if (mapsAuthError.value) {
            reject(new Error(mapsAuthError.value))
            return
          }
          if (window.google?.maps?.places) resolve(window.google.maps)
          else setTimeout(check, 50)
        }
        check()
        return
      }

      window.__recircleGoogleMapsReady = () => {
        if (mapsAuthError.value) {
          reject(new Error(mapsAuthError.value))
          return
        }
        if (window.google?.maps?.places) resolve(window.google.maps)
        else fail('Google Maps loaded without Places library. Enable Places API for this key.')
      }

      const script = document.createElement('script')
      script.id = SCRIPT_ID
      script.async = true
      script.defer = true
      script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey.value)}&libraries=places&callback=__recircleGoogleMapsReady&v=weekly&language=en`
      script.onerror = () => {
        fail('Could not load Google Maps. Check your network and NUXT_PUBLIC_GOOGLE_MAPS_API_KEY.')
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

  return { apiKey, configured, loadMaps, mapsAuthError }
}

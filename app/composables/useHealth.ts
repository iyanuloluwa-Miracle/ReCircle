import type { HealthResponse } from '../../types'

export function useHealth() {
  return useFetch<HealthResponse>('/api/health', {
    key: 'service-health',
    server: false,
    lazy: true,
    retry: 0,
    timeout: 12000
  })
}

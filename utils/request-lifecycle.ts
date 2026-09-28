export const requestStatuses = [
  'pending',
  'accepted',
  'picked_up',
  'completed',
  'rejected',
  'cancelled'
] as const

export type RequestStatus = (typeof requestStatuses)[number]

/** Legal status transitions. Anything else must fail. */
export const requestTransitions: Record<RequestStatus, readonly RequestStatus[]> = {
  pending: ['accepted', 'rejected', 'cancelled'],
  accepted: ['picked_up', 'completed', 'rejected', 'cancelled'],
  // Once collection is recorded, the consumer cannot cancel and release
  // funds for an item the recycler may already possess.
  picked_up: ['completed'],
  completed: [],
  rejected: [],
  cancelled: []
}


export function canTransitionRequest(from: RequestStatus, to: RequestStatus) {
  return (requestTransitions[from] ?? []).includes(to)
}

export type TimelineStepState = 'complete' | 'current' | 'pending'

export interface TimelineStep {
  id: string
  label: string
  state: TimelineStepState
  at: string | null
}

export interface TimelineInput {
  wasteStatus: string
  requestStatus: RequestStatus | null
  /** True when reserved funds have settled into the consumer wallet. */
  settled?: boolean
  analyzedAt?: string | Date | null
  matchedAt?: string | Date | null
  requestedAt?: string | Date | null
  acceptedAt?: string | Date | null
  pickedUpAt?: string | Date | null
  completedAt?: string | Date | null
  settledAt?: string | Date | null
}


function iso(value: string | Date | null | undefined) {
  if (!value) return null
  return value instanceof Date ? value.toISOString() : value
}

function mark(steps: Array<Omit<TimelineStep, 'state'> & { done: boolean }>): TimelineStep[] {
  let foundCurrent = false
  return steps.map((step) => {
    if (step.done) return { id: step.id, label: step.label, state: 'complete' as const, at: step.at }
    if (!foundCurrent) {
      foundCurrent = true
      return { id: step.id, label: step.label, state: 'current' as const, at: step.at }
    }
    return { id: step.id, label: step.label, state: 'pending' as const, at: step.at }
  })
}

/** Build the reusable pickup workflow timeline from persisted statuses. */
export function buildRequestTimeline(input: TimelineInput): TimelineStep[] {
  const request = input.requestStatus
  const waste = input.wasteStatus
  const analyzed = ['analyzed', 'matched', 'pickup_requested', 'picked_up', 'completed'].includes(waste)
    || request != null
  const matched = ['matched', 'pickup_requested', 'picked_up', 'completed'].includes(waste)
    || request != null
  const requested = request != null && request !== 'cancelled' && request !== 'rejected'
    ? true
    : waste === 'pickup_requested' || waste === 'picked_up' || waste === 'completed'
  const accepted = request === 'accepted' || request === 'picked_up' || request === 'completed'
  const collected = request === 'picked_up' || request === 'completed' || waste === 'picked_up' || waste === 'completed'
  // Wallet credit completes when pickup is settled in-app — not when a bank transfer succeeds.
  const credited = Boolean(input.settled) || request === 'completed'

  return mark([
    { id: 'analyzed', label: 'Analyzed', done: analyzed, at: iso(input.analyzedAt) },
    { id: 'matched', label: 'Recycler matched', done: matched, at: iso(input.matchedAt) },
    { id: 'requested', label: 'Pickup requested', done: requested, at: iso(input.requestedAt) },
    { id: 'accepted', label: 'Recycler accepted', done: accepted, at: iso(input.acceptedAt) },
    { id: 'collected', label: 'Collected', done: collected, at: iso(input.pickedUpAt ?? (request === 'completed' ? input.completedAt : null)) },
    { id: 'wallet', label: 'Wallet credited', done: credited, at: iso(input.settledAt ?? (credited ? input.completedAt : null)) }
  ])
}


/** Convert UI match score (0–100) to the Request schema scale (0–1). */
export function toStoredMatchScore(scoreOutOf100: number) {
  if (!Number.isFinite(scoreOutOf100)) return 0
  return Math.min(1, Math.max(0, Math.round(scoreOutOf100) / 100))
}

export function toDisplayMatchScore(stored: number) {
  if (!Number.isFinite(stored)) return 0
  return Math.round(stored <= 1 ? stored * 100 : stored)
}

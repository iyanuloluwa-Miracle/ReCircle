import type { Types } from 'mongoose'
import { Recycler } from '../models/Recycler'
import { toRecyclerMaterialCodes } from '../../utils/material-codes'
import { isOpenForMatching, type OperatingHoursDay } from '../../utils/recycler-hours'
import {
  estimateValueRange,
  filterEligibleRecyclers,
  scoreRecyclerMatches,
  type EligibleRecyclerInput,
  type ScoredMatch
} from '../../utils/recycler-matching'

interface GeoPoint {
  type: 'Point'
  coordinates: [number, number]
}

interface GeoNearRecycler {
  _id: Types.ObjectId
  businessName: string
  distanceMeters: number
  capacityKgPerDay: number
  currentLoadKg: number
  availability: 'available' | 'busy' | 'offline'
  acceptedMaterials: string[]
  pricingRules: Array<{ material: string; pricePerKg: number; currency?: string }>
  serviceRadiusKm: number
  operatingHours?: OperatingHoursDay[]
}

export interface MatchRecyclerResult {
  matches: ScoredMatch[]
  allMatches: ScoredMatch[]
  recommended: ScoredMatch | null
  estimatedValueMin: number | null
  estimatedValueMax: number | null
  currency: 'NGN'
  weightKg: number
  materialCode: string
}

/** Find nearby recyclers with MongoDB $geoNear, then apply deterministic eligibility and scoring. */
export async function matchRecyclersForWaste(options: {
  location: GeoPoint
  materialCode: string
  weightKg: number
}): Promise<MatchRecyclerResult> {
  const { location, materialCode, weightKg } = options
  const materialKeys = toRecyclerMaterialCodes(materialCode)

  const nearby = await Recycler.aggregate<GeoNearRecycler>([
    {
      $geoNear: {
        near: location,
        key: 'location',
        distanceField: 'distanceMeters',
        spherical: true,
        query: {
          availability: 'available',
          acceptedMaterials: { $in: materialKeys }
        }
      }
    },
    {
      $project: {
        businessName: 1,
        distanceMeters: 1,
        capacityKgPerDay: 1,
        currentLoadKg: 1,
        availability: 1,
        acceptedMaterials: 1,
        pricingRules: 1,
        serviceRadiusKm: 1,
        operatingHours: 1
      }
    }
  ])

  const candidates: EligibleRecyclerInput[] = nearby.filter(doc => isOpenForMatching(doc.operatingHours)).map(doc => ({
    id: doc._id.toString(),
    businessName: doc.businessName,
    distanceKm: doc.distanceMeters / 1000,
    capacityKgPerDay: doc.capacityKgPerDay,
    currentLoadKg: doc.currentLoadKg,
    availability: doc.availability,
    acceptedMaterials: doc.acceptedMaterials,
    pricingRules: doc.pricingRules,
    serviceRadiusKm: doc.serviceRadiusKm
  }))

  const eligible = filterEligibleRecyclers(candidates, materialCode, weightKg)
  const scored = scoreRecyclerMatches(eligible, materialCode, weightKg)
  const withinRadius = scored.filter(entry => entry.withinServiceRadius)
  const estimateSource = withinRadius.length > 0 ? withinRadius : scored
  const { estimatedValueMin, estimatedValueMax } = estimateValueRange(estimateSource)

  return {
    matches: scored,
    allMatches: scored,
    recommended: scored[0] ?? null,
    estimatedValueMin,
    estimatedValueMax,
    currency: 'NGN',
    weightKg,
    materialCode
  }
}

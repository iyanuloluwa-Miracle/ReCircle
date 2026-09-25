import { createError, defineEventHandler } from 'h3'
import { Recycler } from '../../models/Recycler'
import { requireSessionUser } from '../../utils/session'

export default defineEventHandler(async (event) => {
  const user = await requireSessionUser(event, ['recycler'])
  const profile = await Recycler.findOne({ userId: user.id })
    .select('businessName availability businessHours operatingHours contactPhone serviceRadiusKm capacityKgPerDay acceptedMaterials pricingRules')
    .lean()
  if (!profile) throw createError({ statusCode: 404, statusMessage: 'Recycler profile not found' })

  return {
    id: profile._id.toString(),
    businessName: profile.businessName,
    availability: profile.availability,
    businessHours: profile.businessHours ?? '',
    operatingHours: profile.operatingHours ?? [],
    contactPhone: profile.contactPhone ?? null,
    serviceRadiusKm: profile.serviceRadiusKm,
    capacityKgPerDay: profile.capacityKgPerDay,
    acceptedMaterials: profile.acceptedMaterials,
    pricingRules: profile.pricingRules
  }
})

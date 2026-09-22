import { createError, defineEventHandler, setResponseStatus } from 'h3'
import { z } from 'zod'
import { materialCodePattern } from '../../models/shared'
import { Recycler } from '../../models/Recycler'
import { connectDatabase } from '../../utils/db'
import { assertSameOrigin } from '../../utils/origin'
import { requireSessionUser } from '../../utils/session'
import { readValidatedJson } from '../../utils/validation'

const longitude = z.number().finite().min(-180).max(180)
const latitude = z.number().finite().min(-90).max(90)
const materialCode = z.string().regex(materialCodePattern)

const recyclerProfileSchema = z.strictObject({
  businessName: z.string().trim().min(2).max(160),
  location: z.strictObject({
    type: z.literal('Point'),
    coordinates: z.tuple([longitude, latitude])
  }),
  serviceRadiusKm: z.number().finite().min(1).max(100),
  acceptedMaterials: z.array(materialCode).min(1).max(20),
  pricingRules: z.array(z.strictObject({
    material: materialCode,
    pricePerKg: z.number().finite().min(0).max(1_000_000),
    currency: z.literal('NGN')
  })).min(1).max(20),
  capacityKgPerDay: z.number().finite().min(1).max(100_000),
  availability: z.enum(['available', 'busy', 'offline'])
}).superRefine((data, ctx) => {
  if (new Set(data.acceptedMaterials).size !== data.acceptedMaterials.length) {
    ctx.addIssue({ code: 'custom', message: 'Accepted materials must be unique', path: ['acceptedMaterials'] })
  }
  if (new Set(data.pricingRules.map(rule => rule.material)).size !== data.pricingRules.length) {
    ctx.addIssue({ code: 'custom', message: 'Pricing rules must have unique materials', path: ['pricingRules'] })
  }
  for (const rule of data.pricingRules) {
    if (!data.acceptedMaterials.includes(rule.material)) {
      ctx.addIssue({ code: 'custom', message: 'Pricing must match accepted materials', path: ['pricingRules'] })
    }
  }
  for (const material of data.acceptedMaterials) {
    if (!data.pricingRules.some(rule => rule.material === material)) {
      ctx.addIssue({ code: 'custom', message: 'Every accepted material needs a price', path: ['pricingRules'] })
    }
  }
})

export default defineEventHandler(async (event) => {
  assertSameOrigin(event)
  const user = await requireSessionUser(event, ['recycler'])
  const body = await readValidatedJson(event, recyclerProfileSchema)
  await connectDatabase()

  const existing = await Recycler.findOne({ userId: user.id }).select('_id').lean()
  if (existing) {
    throw createError({ statusCode: 409, statusMessage: 'Recycler profile already exists' })
  }

  const recycler = await Recycler.create({
    userId: user.id,
    businessName: body.businessName,
    location: body.location,
    acceptedMaterials: body.acceptedMaterials,
    pricingRules: body.pricingRules,
    capacityKgPerDay: body.capacityKgPerDay,
    currentLoadKg: 0,
    availability: body.availability,
    serviceRadiusKm: body.serviceRadiusKm,
    isDemo: false
  })

  setResponseStatus(event, 201)
  return {
    id: recycler.id,
    businessName: recycler.businessName,
    availability: recycler.availability
  }
})

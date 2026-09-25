import { createError, defineEventHandler } from 'h3'
import { z } from 'zod'
import { Recycler } from '../../models/Recycler'
import { materialCodePattern } from '../../models/shared'
import { defaultOperatingHours } from '../../../utils/recycler-hours'
import { assertSameOrigin } from '../../utils/origin'
import { requireSessionUser } from '../../utils/session'
import { readValidatedJson } from '../../utils/validation'

const material = z.string().regex(materialCodePattern)
const operatingDay = z.strictObject({ day: z.number().int().min(0).max(6), open: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/), close: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/), enabled: z.boolean() })
const businessName = z.string().trim().min(2).max(160)

const availabilitySchema = z.strictObject({
  businessName: businessName.optional(),
  availability: z.enum(['available', 'busy', 'offline']),
  businessHours: z.string().trim().min(3).max(160),
  operatingHours: z.array(operatingDay).length(7),
  contactPhone: z.string().trim().max(40).nullable(),
  serviceRadiusKm: z.number().finite().min(1).max(100),
  capacityKgPerDay: z.number().finite().min(1).max(100_000),
  acceptedMaterials: z.array(material).min(1).max(20),
  pricingRules: z.array(z.strictObject({ material, pricePerKg: z.number().finite().min(0).max(1_000_000), currency: z.literal('NGN') })).min(1).max(20)
}).superRefine((value, ctx) => {
  if (new Set(value.acceptedMaterials).size !== value.acceptedMaterials.length) ctx.addIssue({ code: 'custom', message: 'Materials must be unique' })
  if (new Set(value.operatingHours.map(day => day.day)).size !== 7 || value.operatingHours.some(day => day.enabled && day.close <= day.open)) ctx.addIssue({ code: 'custom', message: 'Set unique days and a closing time after opening time' })
  if (value.pricingRules.length !== value.acceptedMaterials.length || value.pricingRules.some(rule => !value.acceptedMaterials.includes(rule.material))) ctx.addIssue({ code: 'custom', message: 'Every accepted material needs one price' })
})

const nameOnlySchema = z.strictObject({
  businessName
})

const schema = z.union([nameOnlySchema, availabilitySchema])

export default defineEventHandler(async (event) => {
  assertSameOrigin(event)
  const user = await requireSessionUser(event, ['recycler'])
  const body = await readValidatedJson(event, schema)
  const profile = await Recycler.findOne({ userId: user.id })
  if (!profile) throw createError({ statusCode: 404, statusMessage: 'Recycler profile not found' })

  if ('availability' in body) {
    if (body.capacityKgPerDay < profile.currentLoadKg) {
      throw createError({ statusCode: 400, statusMessage: 'Capacity cannot be lower than your current reserved load' })
    }
    profile.set({
      ...body,
      operatingHours: body.operatingHours.length ? body.operatingHours : defaultOperatingHours
    })
  } else {
    profile.businessName = body.businessName
  }

  await profile.save()
  return { ok: true, businessName: profile.businessName }
})

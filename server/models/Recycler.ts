import mongoose, { Schema, type InferSchemaType, type Model } from 'mongoose'
import { geoPointSchema, materialCodePattern } from './shared.ts'

const pricingRuleSchema = new Schema({
  material: { type: String, required: true, match: materialCodePattern },
  pricePerKg: { type: Number, required: true, min: 0, validate: Number.isFinite },
  currency: { type: String, enum: ['NGN'], default: 'NGN', required: true }
}, { _id: false })

const operatingHoursSchema = new Schema({
  day: { type: Number, required: true, min: 0, max: 6 },
  open: { type: String, required: true, match: /^([01]\d|2[0-3]):[0-5]\d$/ },
  close: { type: String, required: true, match: /^([01]\d|2[0-3]):[0-5]\d$/ },
  enabled: { type: Boolean, required: true }
}, { _id: false })

const recyclerSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  businessName: { type: String, required: true, trim: true, minlength: 2, maxlength: 160 },
  location: { type: geoPointSchema, required: true },
  acceptedMaterials: { type: [String], required: true, validate: {
    validator: (values: string[]) => values.length > 0 && values.every(value => materialCodePattern.test(value)) && new Set(values).size === values.length,
    message: 'Accepted materials must be unique valid material codes'
  } },
  pricingRules: { type: [pricingRuleSchema], required: true, validate: {
    validator: (rules: Array<{ material: string }>) => rules.length > 0 && new Set(rules.map(rule => rule.material)).size === rules.length,
    message: 'Pricing rules must have unique materials'
  } },
  capacityKgPerDay: { type: Number, required: true, min: 0, validate: Number.isFinite },
  currentLoadKg: { type: Number, required: true, min: 0, validate: Number.isFinite },
  availability: { type: String, enum: ['available', 'busy', 'offline'], required: true, index: true },
  businessHours: { type: String, default: 'Mon–Sat, 9:00 AM–5:00 PM', maxlength: 160 },
  serviceRadiusKm: { type: Number, required: true, min: 0, validate: Number.isFinite },
  operatingHours: { type: [operatingHoursSchema], default: undefined },
  contactPhone: { type: String, default: null, trim: true, maxlength: 40 },
  isDemo: { type: Boolean, default: false }
}, { timestamps: true })

recyclerSchema.path('pricingRules').validate(function (rules: Array<{ material: string }>) {
  return rules.every(rule => this.acceptedMaterials.includes(rule.material))
}, 'Every pricing rule must refer to an accepted material')
recyclerSchema.path('currentLoadKg').validate(function (load: number) {
  return load <= this.capacityKgPerDay
}, 'Current load cannot exceed daily capacity')
recyclerSchema.index({ location: '2dsphere' })
recyclerSchema.index({ acceptedMaterials: 1, availability: 1 })
recyclerSchema.index({ createdAt: -1 })

export type RecyclerDocument = InferSchemaType<typeof recyclerSchema>
export const Recycler: Model<RecyclerDocument> = (mongoose.models.Recycler as Model<RecyclerDocument> | undefined) ?? mongoose.model<RecyclerDocument>('Recycler', recyclerSchema)

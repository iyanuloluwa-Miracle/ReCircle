import mongoose, { Schema, type InferSchemaType } from 'mongoose'
import { geoPointSchema, materialCodePattern } from './shared.ts'

const wasteItemSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  imageUrl: { type: String, required: true },
  materialCode: { type: String, required: true, match: materialCodePattern },
  itemName: { type: String, required: true, trim: true },
  recyclability: { type: String, required: true, enum: ['recyclable', 'conditionally_recyclable', 'non_recyclable'] },
  confidence: { type: Number, required: true, min: 0, max: 1, validate: Number.isFinite },
  disposalMethod: { type: String, required: true },
  preparationInstructions: { type: [String], default: [] },
  hazardWarning: { type: String, default: null },
  weightKg: { type: Number, min: 0, default: null, validate: { validator: (value: number | null) => value === null || Number.isFinite(value) } },
  location: { type: geoPointSchema, required: true },
  estimatedValueMin: { type: Number, min: 0, default: null, validate: { validator: (value: number | null) => value === null || Number.isFinite(value) } },
  estimatedValueMax: { type: Number, min: 0, default: null, validate: { validator: (value: number | null) => value === null || Number.isFinite(value) } },
  currency: { type: String, enum: ['NGN'], default: 'NGN', required: true },
  status: { type: String, required: true, enum: ['draft', 'analyzed', 'matched', 'pickup_requested', 'picked_up', 'completed'], default: 'draft' },
  isDemo: { type: Boolean, default: false }
}, { timestamps: true })

wasteItemSchema.path('estimatedValueMax').validate(function (max: number | null) {
  return max == null || this.estimatedValueMin == null || max >= this.estimatedValueMin
}, 'Maximum estimated value must be at least the minimum')
wasteItemSchema.index({ location: '2dsphere' })
wasteItemSchema.index({ userId: 1, createdAt: -1 })
wasteItemSchema.index({ status: 1, createdAt: -1 })

export type WasteItemDocument = InferSchemaType<typeof wasteItemSchema>
export const WasteItem = mongoose.models.WasteItem || mongoose.model('WasteItem', wasteItemSchema)

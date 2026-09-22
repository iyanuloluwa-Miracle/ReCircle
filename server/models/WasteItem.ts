import mongoose, { Schema, type InferSchemaType, type Model } from 'mongoose'
import { geoPointSchema } from './shared.ts'

const wasteItemSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  imageUrl: { type: String, required: true },
  storagePath: { type: String, unique: true, sparse: true },
  locationSource: { type: String, enum: ['device', 'demo', 'manual'], default: null },
  materialCode: { type: String, required: function (this: { status: string }) { return this.status !== 'draft' }, default: null, match: /^(PET|HDPE|LDPE|PP|ALUMINUM|STEEL|GLASS|CARDBOARD|PAPER|EWASTE|ORGANIC|MIXED|UNKNOWN)$/i },
  itemName: { type: String, required: function (this: { status: string }) { return this.status !== 'draft' }, trim: true, default: null },
  recyclability: { type: String, required: function (this: { status: string }) { return this.status !== 'draft' }, enum: ['recyclable', 'conditionally_recyclable', 'non_recyclable'], default: null },
  confidence: { type: Number, required: function (this: { status: string }) { return this.status !== 'draft' }, min: 0, max: 1, default: null, validate: { validator: (value: number | null) => value === null || Number.isFinite(value) } },
  disposalMethod: { type: String, required: function (this: { status: string }) { return this.status !== 'draft' }, default: null },
  preparationInstructions: { type: [String], default: [] },
  hazardWarning: { type: String, default: null },
  weightKg: { type: Number, min: 0, default: null, validate: { validator: (value: number | null) => value === null || Number.isFinite(value) } },
  location: { type: geoPointSchema, required: true },
  estimatedValueMin: { type: Number, min: 0, default: null, validate: { validator: (value: number | null) => value === null || Number.isFinite(value) } },
  estimatedValueMax: { type: Number, min: 0, default: null, validate: { validator: (value: number | null) => value === null || Number.isFinite(value) } },
  currency: { type: String, enum: ['NGN'], default: 'NGN', required: true },
  status: { type: String, required: true, enum: ['draft', 'analyzed', 'matched', 'pickup_requested', 'picked_up', 'completed'], default: 'draft' },
  analysisLockUntil: { type: Date, default: null },
  classificationSource: { type: String, enum: ['ai', 'manual'], default: null },
  isDemo: { type: Boolean, default: false }
}, { timestamps: true })

wasteItemSchema.path('estimatedValueMax').validate(function (max: number | null) {
  return max == null || this.estimatedValueMin == null || max >= this.estimatedValueMin
}, 'Maximum estimated value must be at least the minimum')
wasteItemSchema.index({ location: '2dsphere' })
wasteItemSchema.index({ userId: 1, createdAt: -1 })
wasteItemSchema.index({ status: 1, createdAt: -1 })

export type WasteItemDocument = InferSchemaType<typeof wasteItemSchema>
export const WasteItem: Model<WasteItemDocument> = (mongoose.models.WasteItem as Model<WasteItemDocument> | undefined) ?? mongoose.model<WasteItemDocument>('WasteItem', wasteItemSchema)

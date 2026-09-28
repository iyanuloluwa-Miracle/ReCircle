import mongoose, { Schema, type InferSchemaType, type Model } from 'mongoose'
import { geoPointSchema } from './shared.ts'

const requestSchema = new Schema({
  wasteItemId: { type: Schema.Types.ObjectId, ref: 'WasteItem', required: true, unique: true },
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  recyclerId: { type: Schema.Types.ObjectId, ref: 'Recycler', required: true },
  pickupLocation: { type: geoPointSchema, required: true },
  requestedPickupTime: { type: Date, default: null },
  confirmedPickupTime: { type: Date, default: null },
  acceptedAt: { type: Date, default: null },
  pickedUpAt: { type: Date, default: null },
  completedAt: { type: Date, default: null },
  rejectedAt: { type: Date, default: null },
  cancelledAt: { type: Date, default: null },
  matchScore: { type: Number, required: true, min: 0, max: 1, validate: Number.isFinite },
  matchReasons: { type: [String], default: [] },
  distanceKm: { type: Number, required: true, min: 0, validate: Number.isFinite },
  pricePerKg: { type: Number, required: true, min: 0, validate: Number.isFinite },
  expectedPayout: { type: Number, required: true, min: 0, validate: Number.isFinite },
  /** Frozen on accept: weightKg × pricePerKg. Settled exactly on complete (v1). */
  lockedPayout: {
    type: Number,
    default: null,
    min: 0,
    validate: (value: number | null) => value == null || Number.isFinite(value)
  },
  /** Set once when reserved funds settle into the consumer wallet. */
  settledAt: { type: Date, default: null },
  /** True while daily kg capacity is held for this accepted pickup. */
  capacityHeld: { type: Boolean, default: false },
  status: { type: String, required: true, enum: ['pending', 'accepted', 'picked_up', 'completed', 'rejected', 'cancelled'] },
  isDemo: { type: Boolean, default: false }
}, { timestamps: true })


requestSchema.index({ recyclerId: 1, status: 1, createdAt: -1 })
requestSchema.index({ userId: 1, createdAt: -1 })
requestSchema.index({ status: 1, createdAt: -1 })

export type RequestDocument = InferSchemaType<typeof requestSchema>
export const Request: Model<RequestDocument> = (mongoose.models.Request as Model<RequestDocument> | undefined) ?? mongoose.model<RequestDocument>('Request', requestSchema)

import mongoose, { Schema, type InferSchemaType, type Model } from 'mongoose'

const topUpSchema = new Schema({
  recyclerId: { type: Schema.Types.ObjectId, ref: 'Recycler', required: true, index: true },
  amount: { type: Number, required: true, min: 0, validate: Number.isFinite },
  currency: { type: String, enum: ['NGN'], default: 'NGN', required: true },
  status: { type: String, enum: ['pending', 'completed', 'failed'], required: true },
  provider: { type: String, enum: ['paystack', 'demo'], required: true },
  providerRef: { type: String, default: null, trim: true, maxlength: 120 },
  failureReason: { type: String, default: null, trim: true, maxlength: 280 }
}, { timestamps: true })

topUpSchema.index({ recyclerId: 1, createdAt: -1 })
topUpSchema.index({ status: 1, createdAt: -1 })
topUpSchema.index({ providerRef: 1 }, { unique: true, sparse: true })

export type TopUpDocument = InferSchemaType<typeof topUpSchema>
export const TopUp: Model<TopUpDocument> = (
  mongoose.models.TopUp as Model<TopUpDocument> | undefined
) ?? mongoose.model<TopUpDocument>('TopUp', topUpSchema)

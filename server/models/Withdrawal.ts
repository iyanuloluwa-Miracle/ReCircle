import mongoose, { Schema, type InferSchemaType, type Model } from 'mongoose'

const withdrawalSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  amount: { type: Number, required: true, min: 0, validate: Number.isFinite },
  currency: { type: String, enum: ['NGN'], default: 'NGN', required: true },
  status: { type: String, enum: ['pending', 'completed', 'failed'], required: true },
  provider: { type: String, enum: ['paystack', 'demo'], required: true },
  providerRef: { type: String, default: null, trim: true, maxlength: 120 },
  failureReason: { type: String, default: null, trim: true, maxlength: 280 }
}, { timestamps: true })

withdrawalSchema.index({ userId: 1, createdAt: -1 })
withdrawalSchema.index({ status: 1, createdAt: -1 })
withdrawalSchema.index({ providerRef: 1 }, { unique: true, sparse: true })

export type WithdrawalDocument = InferSchemaType<typeof withdrawalSchema>
export const Withdrawal: Model<WithdrawalDocument> = (
  mongoose.models.Withdrawal as Model<WithdrawalDocument> | undefined
) ?? mongoose.model<WithdrawalDocument>('Withdrawal', withdrawalSchema)

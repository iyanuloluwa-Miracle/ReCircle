import mongoose, { Schema, type InferSchemaType, type Model } from 'mongoose'

const transactionSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  requestId: { type: Schema.Types.ObjectId, ref: 'Request', required: true, unique: true },
  amount: { type: Number, required: true, min: 0, validate: Number.isFinite },
  currency: { type: String, enum: ['NGN'], default: 'NGN', required: true },
  type: { type: String, enum: ['recycling_reward'], default: 'recycling_reward', required: true },
  provider: { type: String, enum: ['mock', 'paystack'], required: true },
  status: { type: String, enum: ['pending', 'completed', 'failed'], required: true },
  isDemo: { type: Boolean, default: false }
}, { timestamps: { createdAt: true, updatedAt: false } })

transactionSchema.index({ userId: 1, createdAt: -1 })
transactionSchema.index({ status: 1, createdAt: -1 })

export type TransactionDocument = InferSchemaType<typeof transactionSchema>
export const Transaction: Model<TransactionDocument> = (mongoose.models.Transaction as Model<TransactionDocument> | undefined) ?? mongoose.model<TransactionDocument>('Transaction', transactionSchema)

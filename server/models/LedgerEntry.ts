import mongoose, { Schema, type InferSchemaType, type Model } from 'mongoose'

export const ledgerEntryTypes = [
  'top_up',
  'reserve',
  'release',
  'settle_debit',
  'settle_credit',
  'withdraw',
  'withdraw_failed'
] as const

export type LedgerEntryType = (typeof ledgerEntryTypes)[number]

const ledgerEntrySchema = new Schema({
  ownerType: { type: String, enum: ['recycler', 'user'], required: true, index: true },
  ownerId: { type: Schema.Types.ObjectId, required: true, index: true },
  type: { type: String, enum: ledgerEntryTypes, required: true },
  amount: { type: Number, required: true, min: 0, validate: Number.isFinite },
  currency: { type: String, enum: ['NGN'], default: 'NGN', required: true },
  requestId: { type: Schema.Types.ObjectId, ref: 'Request', default: null, index: true },
  topUpId: { type: Schema.Types.ObjectId, ref: 'TopUp', default: null },
  withdrawalId: { type: Schema.Types.ObjectId, ref: 'Withdrawal', default: null },
  provider: { type: String, enum: ['paystack', 'demo', 'internal'], required: true },
  providerRef: { type: String, default: null, trim: true, maxlength: 120 },
  failureReason: { type: String, default: null, trim: true, maxlength: 280 },
  idempotencyKey: { type: String, required: true, unique: true, trim: true, maxlength: 160 }
}, { timestamps: { createdAt: true, updatedAt: false } })

ledgerEntrySchema.index({ ownerType: 1, ownerId: 1, createdAt: -1 })
ledgerEntrySchema.index({ providerRef: 1 }, { sparse: true })

export type LedgerEntryDocument = InferSchemaType<typeof ledgerEntrySchema>
export const LedgerEntry: Model<LedgerEntryDocument> = (
  mongoose.models.LedgerEntry as Model<LedgerEntryDocument> | undefined
) ?? mongoose.model<LedgerEntryDocument>('LedgerEntry', ledgerEntrySchema)

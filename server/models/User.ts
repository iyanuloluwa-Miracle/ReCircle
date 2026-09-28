import mongoose, { Schema, type InferSchemaType, type Model } from 'mongoose'
import { geoPointSchema } from './shared.ts'

const userSchema = new Schema({
  name: { type: String, required: true, trim: true, minlength: 2, maxlength: 120 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 254, match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/ },
  passwordHash: {
    type: String,
    select: false,
    default: null,
    required: function (this: { googleId?: string | null }) {
      return !this.googleId
    }
  },
  // Omit this field for password accounts. A sparse unique index still indexes
  // explicit null values, which would allow only one password-only account.
  googleId: { type: String, sparse: true, unique: true, index: true },
  role: { type: String, required: true, enum: ['user', 'recycler', 'admin'], index: true },
  avatarUrl: { type: String, default: null },
  location: { type: geoPointSchema, default: null },
  emailVerified: { type: Boolean, required: true, default: false },
  onboardingCompletedAt: { type: Date, default: null },
  isDemo: { type: Boolean, default: false },
  /** Consumer NUBAN destination for Paystack withdraw Transfers (TEST). */
  bankCode: { type: String, default: null, trim: true, maxlength: 10 },
  accountNumber: { type: String, default: null, trim: true, maxlength: 20 },
  accountName: { type: String, default: null, trim: true, maxlength: 160 },
  paystackRecipientCode: { type: String, default: null, trim: true, maxlength: 64 },
  /** Spendable consumer wallet balance (server ledger is source of truth). */
  walletAvailable: { type: Number, default: 0, min: 0, validate: Number.isFinite }
}, { timestamps: true })


export type UserDocument = InferSchemaType<typeof userSchema>
export const User: Model<UserDocument> = (mongoose.models.User as Model<UserDocument> | undefined) ?? mongoose.model<UserDocument>('User', userSchema)

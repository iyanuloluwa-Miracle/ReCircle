import mongoose, { Schema, type InferSchemaType, type Model } from 'mongoose'

const signupIntentSchema = new Schema({
  email: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 254 },
  name: { type: String, required: true, trim: true, minlength: 2, maxlength: 120 },
  role: { type: String, required: true, enum: ['user', 'recycler'] },
  otpHash: { type: String, required: true, select: false },
  otpExpiresAt: { type: Date, required: true },
  otpAttempts: { type: Number, required: true, default: 0, min: 0 },
  otpLastSentAt: { type: Date, required: true },
  emailVerifiedAt: { type: Date, default: null },
  signupTokenHash: { type: String, default: null, select: false },
  signupTokenExpiresAt: { type: Date, default: null },
  expiresAt: { type: Date, required: true, index: true }
}, { timestamps: true })

signupIntentSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 })

export type SignupIntentDocument = InferSchemaType<typeof signupIntentSchema>
export const SignupIntent: Model<SignupIntentDocument> = (mongoose.models.SignupIntent as Model<SignupIntentDocument> | undefined)
  ?? mongoose.model<SignupIntentDocument>('SignupIntent', signupIntentSchema)

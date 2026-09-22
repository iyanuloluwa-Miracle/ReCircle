import mongoose, { Schema, type InferSchemaType } from 'mongoose'
import { geoPointSchema } from './shared.ts'

const userSchema = new Schema({
  name: { type: String, required: true, trim: true, minlength: 2, maxlength: 120 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 254, match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/ },
  passwordHash: { type: String, required: true, select: false },
  role: { type: String, required: true, enum: ['user', 'recycler', 'waste_operator'], index: true },
  avatarUrl: { type: String, default: null },
  location: { type: geoPointSchema, default: null },
  isDemo: { type: Boolean, default: false }
}, { timestamps: true })

export type UserDocument = InferSchemaType<typeof userSchema>
export const User = mongoose.models.User || mongoose.model('User', userSchema)

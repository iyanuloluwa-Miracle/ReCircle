import mongoose, { Schema, type InferSchemaType, type Model } from 'mongoose'

const notificationSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  type: { type: String, required: true, maxlength: 64 },
  title: { type: String, required: true, maxlength: 160 },
  body: { type: String, required: true, maxlength: 500 },
  href: { type: String, default: null, maxlength: 500 },
  readAt: { type: Date, default: null }
}, { timestamps: true })

notificationSchema.index({ userId: 1, readAt: 1, createdAt: -1 })

export type NotificationDocument = InferSchemaType<typeof notificationSchema>
export const Notification: Model<NotificationDocument> = (mongoose.models.Notification as Model<NotificationDocument> | undefined)
  ?? mongoose.model<NotificationDocument>('Notification', notificationSchema)

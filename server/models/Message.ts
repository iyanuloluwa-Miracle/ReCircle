import mongoose, { Schema, type InferSchemaType, type Model } from 'mongoose'

const messageSchema = new Schema({
  requestId: { type: Schema.Types.ObjectId, ref: 'Request', required: true, index: true },
  senderUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  body: { type: String, required: true, trim: true, minlength: 1, maxlength: 1000 }
}, { timestamps: true })

messageSchema.index({ requestId: 1, createdAt: 1 })

export type MessageDocument = InferSchemaType<typeof messageSchema>
export const Message: Model<MessageDocument> = (mongoose.models.Message as Model<MessageDocument> | undefined)
  ?? mongoose.model<MessageDocument>('Message', messageSchema)

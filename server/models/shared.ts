import { Schema } from 'mongoose'

export interface GeoPoint {
  type: 'Point'
  coordinates: [number, number]
}

export const geoPointSchema = new Schema<GeoPoint>({
  type: { type: String, enum: ['Point'], default: 'Point', required: true },
  coordinates: {
    type: [Number],
    required: true,
    validate: {
      validator(value: number[]) {
        return value.length === 2 && Number.isFinite(value[0]) && Number.isFinite(value[1])
          && value[0]! >= -180 && value[0]! <= 180
          && value[1]! >= -90 && value[1]! <= 90
      },
      message: 'Coordinates must be [longitude, latitude] within geographic bounds'
    }
  }
}, { _id: false })

export const materialCodePattern = /^[a-z][a-z0-9_]*$/

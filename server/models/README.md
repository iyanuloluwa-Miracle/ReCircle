# Mongoose models

Domain models will be added in the relevant feature phases. Reuse the connection in
`server/utils/db.ts`; do not create connections per model or buffer operations when offline.
Future recycler coordinates must use GeoJSON with a 2dsphere index.

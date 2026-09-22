# Mongoose models

`User`, `Recycler`, `WasteItem`, `Request`, and `Transaction` contain the Phase 2
operational schema. `shared.ts` validates GeoJSON points as `[longitude, latitude]`.
The `isDemo` marker distinguishes seeded examples from real records. Monetary
amounts are numeric NGN. Demo prices and payouts are whole naira; later financial
logic must calculate and validate values on the server.

# Mongoose models

`User`, `Recycler`, `WasteItem`, `Request`, and `Transaction` contain the Phase 2
operational schema. `shared.ts` validates GeoJSON points as `[longitude, latitude]`.
The `isDemo` marker distinguishes seeded examples from real records. Monetary
amounts are numeric NGN. Demo prices and payouts are whole naira; later financial
logic must calculate and validate values on the server.
`Transaction.provider` may be `mock` (local/demo rewards) or `paystack` (TEST
Transfers). Paystack rows may stay `pending` until a signed webhook confirms
success or failure. Consumers store optional NUBAN payout fields on `User`
(`bankCode`, `accountNumber`, `accountName`, `paystackRecipientCode`).
Waste items can begin as `draft` records with an image and pickup location; material
classification fields become required when status advances. `storagePath` is sparse
and unique so a retried upload confirmation returns the same draft.
`analysisLockUntil` coordinates concurrent OpenRouter requests. A successful
classification records `classificationSource: ai`; consumer confirmation changes it
to `manual`. Weight is supplied by the consumer. Valuation fields
`estimatedValueMin` / `estimatedValueMax` and status `matched` are written by
deterministic matching — never by the classifier. Pickup requests advance the
item through `pickup_requested`, `picked_up`, and `completed`, with audit
timestamps stored on the Request document.

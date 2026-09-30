# ReCircle ♻️

ReCircle is an Africa-focused recycling coordination platform that makes recycling more practical, transparent, and rewarding. It helps people identify recyclable materials, estimate their value, find suitable nearby recyclers, and request pickups—all from one streamlined experience.

Built to connect consumers, recycling companies, and platform admins, ReCircle turns the journey from “I have recyclable waste” into a clear, trackable workflow—and gives partner companies a shared channel to discover supply, manage capacity, and complete collections.

## Project Details

| | |
|---|---|
| **Target audience** | Everyday consumers with recyclable waste at home or work; partner recycling companies and collection yards that buy materials and run pickups; and internal admins who oversee the network across cities in Africa. |
| **Demo video** | [ReCircle demo video](https://drive.google.com/drive/folders/1-F0aUbUDZz5HwTvRreHHeQCV8LreXi1w?usp=sharing) |

## Screenshots

| Screen | Preview |
|--------|---------|
| Landing (desktop) | ![Landing desktop](docs/screenshots/01-landing-desktop.png) |
| Landing (mobile) | ![Landing mobile](docs/screenshots/02-landing-mobile.jpeg) |
| Consumer dashboard | ![Consumer dashboard](docs/screenshots/03-consumer-dashboard.png) |
| Scan / match recycler | ![Scan match](docs/screenshots/04-scan-match.png) |
| Recycler incoming pickups | ![Recycler dashboard](docs/screenshots/05-recycler-dashboard.jpeg) |
| Wallet / top-up / withdraw | ![Wallet](docs/screenshots/06-payout-wallet.png) |
| Admin / analytics | ![Admin analytics](docs/screenshots/07-admin-analytics.png) |
| Settings withdrawal bank | ![Settings bank](docs/screenshots/08-settings-payout.png) |

## Inspiration 🧠

Recycling often breaks down before it begins: people may not know whether an item is recyclable, how to prepare it, what it is worth, or where to take it. Meanwhile, recycling companies need a reliable way to discover available materials, coordinate pickups, and manage daily capacity—often without a shared system that works across partners.

ReCircle was created to close that gap. The goal was to build a digital bridge between households and recycling companies, with admins overseeing the network—making recycling easier to participate in while helping valuable materials stay out of landfills.

## What it does ❔

ReCircle supports three key roles:

- **Consumers** can scan or upload waste images, receive AI-assisted material identification, review preparation guidance, estimate waste value, compare nearby recyclers, request pickups, and withdraw earnings to their bank.
- **Recyclers** (partner recycling companies) can manage their service areas, accepted materials, pricing, capacity, wallet balance, and incoming pickup requests—prepaid funds lock when they accept a job and settle to the consumer when collection is complete.
- **Admins** can monitor platform activity, track pickup progress, review recycler utilization, and plan more efficient collection batches across the network.

The platform is designed for **partnership with recycling companies and collection networks**: each partner runs their own operations on ReCircle, while consumers get one place to match, request, and track pickups.

The full journey:

`Scan → Analyze → Weigh → Match → Request → Accept (funds locked) → Collect → Complete (wallet credited) → Withdraw to bank`

## Key features ✨

- AI-assisted waste classification with confidence scores and safety/preparation guidance
- Consumer confirmation when AI confidence is low
- Location-aware recycler matching (distance, pricing, materials, service area, capacity)
- Transparent estimated value in NGN
- Wallet-based settlement: recyclers prepay, accept locks funds, complete credits the consumer, withdraw sends money to bank
- Clear pickup statuses from pending through completed
- Role-based dashboards for consumers, recyclers, and admins
- Collection-batch suggestions for more efficient pickups across partner zones
- Analytics for materials, collections, payouts, and pickup activity
- A grounded AI assistant that answers from real platform data—without inventing prices or statuses
- Google sign-in or email OTP authentication
- Chat between consumers and recyclers during an active pickup
- Mobile-responsive experience across marketing, scan, and dashboards

## How we built it 🖥️

ReCircle is a full-stack web app built with **Nuxt**, **Vue**, **TypeScript**, and **Tailwind CSS**, backed by **MongoDB**. It uses **OpenRouter** for waste-image analysis, **Byteship** for secure uploads, **Google Maps** for pickup locations, **Google OAuth** and **Resend** for auth, and **Paystack** for recycler wallet top-ups and consumer withdrawals.

## Challenges we ran into 🏃

One of the biggest challenges was making AI useful without letting it become unreliable. Instead of trusting model output blindly, ReCircle validates responses, applies confidence thresholds, and lets users correct uncertain classifications.

Recycler matching was another hard problem. Nearby is not the same as best, so the platform weighs distance, materials, service area, pricing, and remaining capacity before recommending a partner.

We also had to keep three roles connected without blurring them: a simple path for consumers, operational clarity for recyclers, and network oversight for admins—while designing settlement so recyclers fund rewards and ReCircle only moves money on the ledger.

## Accomplishments we’re proud of 🚀

We built more than a recycling directory. ReCircle supports the real operational loop—from discovery and matching through pickup tracking and paid completion.

- Deterministic recycler ranking instead of AI-invented recommendations
- Capacity-aware matching and strict pickup workflows
- Wallet escrow so accept truly commits a job financially
- Dashboards and analytics grounded in real platform data
- An AI assistant that stays within verified facts

## What we learned 📖

Building ReCircle deepened our experience with full-stack product work: role-based access, location-aware matching, authentication, AI integration, and operational workflow design.

We also learned that responsible AI needs boundaries. Pairing model analysis with validation, user confirmation, and deterministic business logic builds more trust than generated answers alone.

Most importantly, ReCircle showed how technology can make sustainable actions feel simpler, more accessible, and more connected to real-world impact.

## Getting started

Use Node.js 24 LTS and npm.

1. Run `npm install`.
2. Copy `.env.example` to `.env` and set at least `MONGODB_URI` and `SESSION_SECRET`.
3. Run `npm run dev` and open http://localhost:3000.
4. Optionally run `npm run seed` for demo data.

Scanner, analysis, maps, and payments need their respective API keys in `.env` when you want those features live.

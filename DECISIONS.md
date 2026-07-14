# Architectural and Design Decisions (API)

This document tracks important architectural, design, and business logic decisions made during the development of the FlowFit backend API.

## 2026-07-15: Training Pricing and Payment Tracking
- **Decision:** Dropped `isPaid` boolean tracking on `SessionParticipant` and replaced `pricePerPerson` with `price` on `WorkoutSession`.
- **Rationale:** The business model shifted from tracking individual client payments for a session to tracking the total expected revenue for the session as a whole.
- **Implementation:** 
  - Prisma schema updated to reflect `price` (Float) on the session level.
  - Reports service modified to calculate income based strictly on `session.price` for `COMPLETED` sessions, rather than aggregating per-participant prices.

## 2026-07-15: Client Notes Editing
- **Decision:** Added backend support for editing client notes.
- **Rationale:** Trainers needed the ability to append or modify notes over time without deleting and recreating a client record.
- **Implementation:** Added `updateNote` endpoint and service method to `ClientsService` allowing partial updates to the `note` field.

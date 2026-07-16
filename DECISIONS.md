# Architectural and Design Decisions (API)

This document tracks important architectural, design, and business logic decisions made during the development of the FlowFit backend API.

## 2026-07-16: Background Scheduler vs BullMQ
- **Decision:** Implemented background tasks (session status updates) using `@nestjs/schedule` rather than introducing Redis and BullMQ.
- **Rationale:** For the MVP, the tasks are extremely lightweight (atomic database `updateMany` queries) and do not block the event loop. Avoiding Redis keeps local development simple and reduces production infrastructure costs. Since PostgreSQL handles the atomicity of the `updateMany` query, it is perfectly safe to run this cron job even if we horizontally scale the backend in the future.
- **Implementation:** Added `SchedulerModule` with a minute-by-minute `@Cron` job to transition session statuses (`UPCOMING` -> `ACTIVE` -> `COMPLETED`).

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

# Architectural and Design Decisions (API)

This document tracks important architectural, design, and business logic decisions made during the development of the FlowFit backend API.

## 2026-11-11: Vercel Serverless Compatibility (Prisma Binary Targets & CommonJS `web-push`)
- **Decision:** Pinned `web-push` to `^3.6.7` (CommonJS), added explicit `binaryTargets = ["native", "rhel-openssl-1.0.x", "rhel-openssl-3.0.x"]` in `prisma/schema.prisma`, and awaited Express response finish in `api/serverless.ts`.
- **Rationale:** `web-push@4.0.0` converted to pure ESM (`"type": "module"`), throwing `ERR_REQUIRE_ESM` when compiled to CommonJS or invoked in Node 18/20 serverless environments on Vercel. Furthermore, Prisma requires explicit RHEL binary targets when bundled by `@vercel/node` (`@vercel/ncc`), and async serverless handlers must await the HTTP `finish`/`close` lifecycle event before returning so Vercel does not freeze the execution context mid-request.
- **Implementation:**
  - `package.json`: `"web-push": "^3.6.7"`.
  - `prisma/schema.prisma`: added `binaryTargets`.
  - `api/serverless.ts`: wrapped `server(req, res)` in a `Promise` tied to `res.on('finish')` and `res.on('close')`.

## 2026-11-11: Web Push & Dual-Channel Critical Notifications Architecture
- **Decision:** Implemented Web Push notifications (via `web-push` and VAPID keys) combined with an optional `isCritical` flag that dual-dispatches urgent workout reminders to Telegram.
- **Rationale:** PWA applications running on mobile or desktop browsers cannot rely on native device timers (`@capacitor/local-notifications`). Background push delivery requires server-side orchestration via Service Workers. For standard workouts, trainers receive native Web Push; for critical workouts (`isCritical = true`), reminders are additionally pushed to Telegram for guaranteed delivery.
- **Implementation:**
  - `WorkoutSession`: Added `enable_notification`, `reminder_mode`, `is_critical`, and `reminder_sent_at` columns.
  - `PushSubscription`: Created table to manage browser push endpoints, auth, and p256dh keys tied to users with cascade deletion.
  - `NotificationsModule` & `WebPushService`: Provides `/notifications/vapid-key`, `/notifications/subscribe`, `/notifications/unsubscribe`, and `/notifications/test`.
  - `SchedulerService.sendWorkoutReminders()`: Checks upcoming sessions with reminders enabled, calculates target notification times, dispatches Web Push and optional Telegram alerts, and records `reminder_sent_at`.

## 2026-07-16: Telegram Bot Deep-Linking & Webhook Resilience
- **Decision:** Bot connection logic in `TelegramService.startCommand` handles both `ctx.startPayload` and text splitting, and proactively checks for existing `tgChatId` links before validating deep-link tokens.
- **Rationale:** Webhooks and polling often process the `/start` command twice due to latency or network retries. By checking if the user is already connected first, we prevent false-positive "Invalid Token" errors and improve UX for users clicking the bot link multiple times.

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

# FlowFit — Requirements Document

## 1. Project Overview

**Product Name:** FlowFit
**Type:** CRM system for fitness coaches (trainers)
**Target User:** Individual fitness trainer who manages clients, schedules workouts, and tracks progress
**Access Model:** Trainer-only (no client-facing interface in MVP). Multi-tenant — each trainer sees only their own data.

### Tech Stack

| Layer     | Technology                                      |
| --------- | ----------------------------------------------- |
| Backend   | NestJS 11, TypeScript, REST API, Swagger        |
| Database  | PostgreSQL 16, Prisma ORM                       |
| Frontend  | Ionic 8, Angular 20, Standalone Components      |
| State     | Angular Signals (no external state manager)     |
| Bot       | Telegram (nestjs-telegraf)                      |
| Infra     | Docker Compose (dev), npm                       |

### Design System

| Token              | Value     | Usage                           |
| ------------------- | --------- | ------------------------------- |
| Primary (Peach)     | `#FFB3A7` | Buttons, active states, accents |
| Secondary (Magenta) | `#B55C82` | Secondary actions, highlights   |
| Success (Olive)     | `#829368` | Success states, completed       |
| Dark Text           | `#4A3034` | Primary text color              |
| Background          | `#FDFBF9` | Page background (light/warm)    |
| Font                | Outfit    | Google Fonts                    |

**Theme:** Light (warm). Mobile-first. UI language: Українська.

---

## 2. Domain Model

### 2.1 Entities

#### User (Trainer)
The person who logs into the system. No client accounts.

| Field          | Type     | Notes                                  |
| -------------- | -------- | -------------------------------------- |
| id             | Int (PK) | Auto-increment                         |
| email          | String   | Unique, used for login                 |
| passwordHash   | String   | bcryptjs hash                          |
| firstName      | String   |                                        |
| lastName       | String   |                                        |
| role           | Enum     | TRAINER (expandable)                   |
| tgChatId       | String?  | Telegram chat ID for notifications     |
| createdAt      | DateTime |                                        |
| updatedAt      | DateTime |                                        |

#### Client
Trainer's client profile. Fully managed by the trainer.

| Field        | Type     | Notes                                    |
| ------------ | -------- | ---------------------------------------- |
| id           | Int (PK) |                                          |
| trainerId    | Int (FK) | → User. Tenant isolation key             |
| fullName     | String   | ПІБ                                     |
| phone        | String?  | Номер телефону                           |
| goal         | String?  | Ціль клієнта                             |
| personalInfo | String?  | Особиста інформація                      |
| currentWeight| Float?   | Поточна вага                             |
| comments     | String?  | Коментарі тренера                        |
| gDriveFolderUrl | String? | Посилання на Google Drive папку         |
| isActive     | Boolean  | Default: true. Soft-archive              |
| createdAt    | DateTime |                                          |
| updatedAt    | DateTime |                                          |

#### ClientNote
Trainer's notes about a specific client. Supports external links.

| Field     | Type       | Notes                                      |
| --------- | ---------- | ------------------------------------------ |
| id        | Int (PK)   |                                            |
| clientId  | Int (FK)   | → Client                                   |
| text      | String     | Note content                               |
| links     | String[]   | Array of URLs (Notion, YouTube, Drive)     |
| createdAt | DateTime   |                                            |

#### MetricsHistory
Historical tracking of client measurements.

| Field        | Type     | Notes                          |
| ------------ | -------- | ------------------------------ |
| id           | Int (PK) |                                |
| clientId     | Int (FK) | → Client                       |
| weight       | Float?   |                                |
| measurements | String?  | Free-text measurements         |
| note         | String?  | Trainer note about this record |
| createdAt    | DateTime |                                |

#### Location
Places where workouts happen.

| Field    | Type     | Notes                          |
| -------- | -------- | ------------------------------ |
| id       | Int (PK) |                                |
| trainerId| Int (FK) | → User. Tenant isolation key   |
| name     | String   | Назва студії/залу              |
| type     | Enum     | STUDIO, GYM, OUTDOOR           |
| address  | String?  | Адреса                         |
| createdAt| DateTime |                                |

#### WorkoutSession
A scheduled workout event in the trainer's calendar.

| Field          | Type     | Notes                                    |
| -------------- | -------- | ---------------------------------------- |
| id             | Int (PK) |                                          |
| trainerId      | Int (FK) | → User. Tenant isolation key             |
| locationId     | Int (FK) | → Location                               |
| type           | Enum     | INDIVIDUAL, GROUP                        |
| startTime      | DateTime |                                          |
| endTime        | DateTime |                                          |
| pricePerPerson | Float    | Ціна за одну людину                      |
| status         | Enum     | UPCOMING, ACTIVE, REQUIRED_ACTION, COMPLETED, MISSED |
| createdAt      | DateTime |                                          |
| updatedAt      | DateTime |                                          |

#### SessionParticipant
Links a client (or guest name) to a workout session.

| Field      | Type     | Notes                                          |
| ---------- | -------- | ---------------------------------------------- |
| id         | Int (PK) |                                                |
| sessionId  | Int (FK) | → WorkoutSession                               |
| clientId   | Int? (FK)| → Client (nullable for guest participants)     |
| customName | String?  | Text name for non-registered participants      |
| createdAt  | DateTime |                                                |

> **Constraint:** Either `clientId` OR `customName` must be provided, not both empty.

### 2.2 Enums

| Enum           | Values                                              |
| -------------- | --------------------------------------------------- |
| UserRole       | TRAINER                                             |
| LocationType   | STUDIO, GYM, OUTDOOR                                |
| SessionType    | INDIVIDUAL, GROUP                                   |
| SessionStatus  | UPCOMING, ACTIVE, REQUIRED_ACTION, COMPLETED, MISSED|

---

## 3. Workout Session Status Machine

```
[ UPCOMING ] ──(start time reached)──> [ ACTIVE ] ──(end time reached)──> [ REQUIRED_ACTION ]
     │                                                                          │
     └────────────(trainer marks)─────────────────────────────────────> [ MISSED ]
                                                                                │
                                                                    [ COMPLETED ] (trainer confirms)
```

| Status          | Trigger                        | Description                                  |
| --------------- | ------------------------------ | -------------------------------------------- |
| UPCOMING        | Auto on creation               | Scheduled in the future                      |
| ACTIVE          | Auto (cron: now ≥ startTime)   | Currently happening                          |
| REQUIRED_ACTION | Auto (cron: now ≥ endTime)     | Finished but trainer hasn't confirmed result |
| COMPLETED       | Manual (trainer action)        | Successfully completed. Counts in income     |
| MISSED          | Manual (trainer action)        | Skipped (illness, no-show, etc.)             |

---

## 4. Computed Business Logic

### Session Total Price
```
sessionTotal = workoutSession.pricePerPerson × count(sessionParticipants)
```
**Not stored in DB.** Computed at query time.

### Financial Reports
```
incomeForPeriod = SUM(sessionTotal) WHERE status = COMPLETED AND startTime BETWEEN dateFrom AND dateTo
```

---

## 5. Telegram Bot

### Scope
Notifications for the trainer only (no client-facing bot in MVP).

### Features
- **Automatic reminders:** Cron job checks upcoming sessions and sends Telegram message to trainer:
  - 3 hours before session
  - 1 hour before session
- **Commands:**
  - `/upcoming` or `/today` — list of today's remaining sessions
  - `/start` — link Telegram account to FlowFit user

### Cancellation Logic
If a session status changes to MISSED or is deleted before the notification time, scheduled notifications are cancelled (not sent).

---

## 6. Non-Functional Requirements

| Requirement    | Target                                               |
| -------------- | ---------------------------------------------------- |
| Auth           | JWT (access + refresh tokens), bcryptjs passwords    |
| Multi-tenancy  | trainerId FK on every entity, filtered in every query|
| API docs       | Swagger UI at `/api/docs`                            |
| Language (UI)  | Українська                                           |
| Language (code)| English                                              |
| Platform       | Mobile-first (Ionic PWA), works in browser           |
| DB             | PostgreSQL 16 via Docker Compose                     |
| Package mgr    | npm                                                  |
| CI/CD          | GitHub Actions (future)                              |

---

## 7. Explicitly Out of Scope (MVP)

- ❌ Client self-registration or login
- ❌ Payment processing / payment gateway integration
- ❌ File upload to server (only external links: Google Drive, Notion)
- ❌ Dark theme (light theme only for MVP)
- ❌ Multi-language i18n (Ukrainian only for MVP)
- ❌ Real-time WebSocket updates
- ❌ Mobile native builds (Capacitor/Cordova) — PWA only for MVP

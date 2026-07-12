# FlowFit — MVP Phases

## Phase 1: Foundation — Auth + Clients + Locations
**Goal:** Core CRUD operations. Trainer can register, login, and manage clients and locations.

### Backend
- [ ] NestJS 11 project scaffolding with Prisma + PostgreSQL
- [ ] Auth module: register, login, refresh, JWT guards
- [ ] User module: get profile, update profile
- [ ] Client module: full CRUD (create, read, update, soft-delete)
- [ ] Location module: full CRUD
- [ ] Swagger documentation for all endpoints
- [ ] Global exception filter + validation pipe

### Frontend
- [ ] Ionic 8 + Angular 20 project scaffolding
- [ ] Auth pages: login, register
- [ ] Auth service: JWT storage, interceptor, guards
- [ ] Clients page: list with search + filters
- [ ] Client detail page: profile info
- [ ] Client create/edit modal
- [ ] Locations page: list + create/edit modal

### Acceptance Criteria
- ✅ Trainer can register and login
- ✅ Trainer can CRUD clients and locations
- ✅ Each trainer sees only their own data (multi-tenant)
- ✅ API documented in Swagger

---

## Phase 2: Scheduler — Sessions + Calendar + Participants
**Goal:** Workout scheduling. Trainer can create sessions, add participants, and view schedule.

### Backend
- [ ] WorkoutSession module: CRUD + date-range query (scheduler endpoint)
- [ ] SessionParticipant module: add/remove participants (clientId or customName)
- [ ] Computed totalPrice in session responses
- [ ] Duplicate week endpoint
- [ ] Filters: by date range, location, type, status, client

### Frontend
- [ ] Scheduler dashboard: List view (chronological)
- [ ] Scheduler dashboard: Calendar view (week/month)
- [ ] Session create/edit page: type, location, time, price
- [ ] Participant management: add existing client or custom name
- [ ] Session status badges (UPCOMING, ACTIVE, etc.)
- [ ] Quick status change actions
- [ ] Filters panel: type, status, location

### Acceptance Criteria
- ✅ Trainer can create individual and group sessions
- ✅ Sessions appear on calendar and list views
- ✅ Participants can be added (registered clients or text names)
- ✅ Total price is computed correctly
- ✅ Previous week can be duplicated

---

## Phase 3: Client Profile — Notes + Metrics + History
**Goal:** Rich client profiles with notes, progress tracking, and session history.

### Backend
- [ ] ClientNote module: CRUD with links array
- [ ] MetricsHistory module: CRUD
- [ ] Client session history endpoint (past + upcoming sessions for a client)
- [ ] Client enrichment: include notes count, latest metrics in client detail

### Frontend
- [ ] Client profile tabs: Інфо | Прогрес | Історія
- [ ] Прогрес tab: metrics history list, weight chart
- [ ] Нотатки section: notes list with clickable links
- [ ] Add note modal (text + links)
- [ ] Add metrics modal (weight, measurements, note)
- [ ] Історія tab: past + upcoming sessions for this client

### Acceptance Criteria
- ✅ Trainer can add/view notes with external links
- ✅ Trainer can track client weight/metrics over time
- ✅ Client profile shows session history
- ✅ Links render as clickable cards/buttons

---

## Phase 4: Reports & Analytics
**Goal:** Financial and operational analytics for the trainer.

### Backend
- [ ] Reports module: income endpoint (period-based)
- [ ] Reports module: statistics endpoint
- [ ] Aggregation queries for completed sessions, hours, missed rate

### Frontend
- [ ] Reports page: income summary (week/month selector)
- [ ] Income breakdown: individual vs group
- [ ] Statistics cards: total clients, sessions/week, missed rate
- [ ] Period selector (date range picker)

### Acceptance Criteria
- ✅ Trainer sees income for selected period
- ✅ Trainer sees session statistics and missed rate
- ✅ No payment processing — just price × participants calculation

---

## Phase 5: Telegram Bot
**Goal:** Trainer receives reminders before sessions via Telegram.

### Backend
- [ ] Telegram module: bot setup with nestjs-telegraf
- [ ] `/start` command: link Telegram chat ID to user account
- [ ] `/upcoming` command: list today's remaining sessions
- [ ] Reminder service: send message at N hours before session

### Frontend
- [ ] Settings page: Telegram linking instructions
- [ ] Notification preferences: toggle 3h / 1h reminders

### Acceptance Criteria
- ✅ Trainer can link Telegram account
- ✅ Trainer receives reminders 3h and 1h before sessions
- ✅ `/upcoming` returns today's sessions
- ✅ Cancelled sessions don't trigger reminders

---

## Phase 6: Cron Jobs & Automation
**Goal:** Automatic session status transitions and scheduled reminders.

### Backend
- [ ] Scheduler service (@nestjs/schedule):
  - [ ] UPCOMING → ACTIVE (when now ≥ startTime)
  - [ ] ACTIVE → REQUIRED_ACTION (when now ≥ endTime)
- [ ] Telegram reminder cron: check sessions and send reminders
- [ ] Cancellation logic: remove scheduled notifications for MISSED/deleted sessions

### Frontend
- [ ] Real-time status badges update on scheduler page
- [ ] Visual indicator for REQUIRED_ACTION sessions

### Acceptance Criteria
- ✅ Session statuses transition automatically
- ✅ REQUIRED_ACTION prompts trainer to confirm/miss
- ✅ Telegram reminders fire at correct times
- ✅ No phantom reminders for cancelled sessions

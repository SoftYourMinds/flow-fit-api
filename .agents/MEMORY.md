# MEMORY.md — flow-fit-api

> **Protocol:** Read this file at the start of every session before taking any action.
> **Update trigger:** Run the `memory-manager` skill after any major feature, refactor, or debugging session.

---

## 📊 PROJECT LEVEL

- **Active Level:** **Level 1 (MVP: 0-10k DAU)**
- **Architectural Philosophy:** Speed, high agility, and validated learning over perfect decoupling. Simple inline services, documented "acceptable hacks" that are easy to replace.
- **Decision-Making:** The agent must present a trade-off question with a `(Recommended)` label before writing code for new features.

---

## 🪵 ACTIVE TECH DEBT & ACCEPTABLE HACKS

_(empty — fresh project, no tech debt yet)_

---

## WHAT — Project Context

**Project:** `flow-fit-api` — REST API backend for a multi-tenant fitness coach CRM.
**Author:** Maxim
**Stack:** NestJS 11 · PostgreSQL · Prisma ORM · REST API · Swagger · @nestjs/schedule · nestjs-telegraf

### Domain Entities (Prisma Schema)

| Entity               | Key Fields                                                                          | Relations                                  |
| -------------------- | ----------------------------------------------------------------------------------- | ------------------------------------------ |
| `User`               | `id`, `email`, `passwordHash`, `firstName`, `lastName`, `role` (TRAINER), `tgChatId` | One-to-Many: Clients, Locations, Sessions  |
| `Client`             | `id`, `trainerId`, `fullName`, `phone`, `goal`, `personalInfo`, `currentWeight`, `comments` | Belongs to User. Has many: Notes, Metrics, Participations |
| `ClientNote`         | `id`, `clientId`, `text`, `links` (String[]), `createdAt`                           | Belongs to Client                          |
| `MetricsHistory`     | `id`, `clientId`, `weight`, `measurements`, `note`, `createdAt`                     | Belongs to Client                          |
| `Location`           | `id`, `trainerId`, `name`, `type` (STUDIO/GYM/OUTDOOR), `address`                  | Belongs to User. Has many: Sessions        |
| `WorkoutSession`     | `id`, `trainerId`, `locationId`, `type`, `startTime`, `endTime`, `pricePerPerson`, `status` | Belongs to User, Location. Has many: Participants |
| `SessionParticipant` | `id`, `sessionId`, `clientId` (nullable), `customName` (nullable)                   | Belongs to Session, optionally to Client   |

### Enums

- `UserRole`: TRAINER (expandable to ADMIN later)
- `LocationType`: STUDIO, GYM, OUTDOOR
- `SessionType`: INDIVIDUAL, GROUP
- `SessionStatus`: UPCOMING, ACTIVE, REQUIRED_ACTION, COMPLETED, MISSED

### Module Map (`src/modules/`)

auth · user · client · client-note · metrics · location · workout-session · participant · scheduler · telegram · shared

---

## WHY — Architectural Decisions

### Multi-Tenancy via `trainerId`

Every business entity has a `trainerId` foreign key pointing to `User`. Services always filter by the authenticated user's ID extracted from the JWT. **Never write a raw Prisma query without the trainerId filter — it leaks cross-tenant data.**

### Auth Flow

- JWT-based authentication (access token + refresh token)
- `AuthGuard` (global): validates JWT → attaches `user` to request
- Passwords hashed with `bcryptjs`
- Open registration (any trainer can sign up)

### REST API + Swagger

All endpoints documented with `@nestjs/swagger` decorators (`@ApiTags`, `@ApiOperation`, `@ApiResponse`). No GraphQL. Swagger UI available at `/api/docs`.

### Prisma ORM

Type-safe database access with auto-generated client. Migrations via `prisma migrate dev`. No raw SQL unless strictly necessary.

### Computed Fields (Not Stored)

- **Session total price:** `pricePerPerson × participants.length` — computed at query time, not stored
- **Session status transitions:** UPCOMING → ACTIVE → REQUIRED_ACTION are automatic (cron), COMPLETED/MISSED are manual (trainer action)

---

## HOW — Workflow & Commands

### Dev & Production Servers

```bash
npm run start:dev     # NestJS watch mode
npm run start:debug   # NestJS debug mode
npm run build         # Production build
npm run start:prod    # Run production build
```

### Database (Prisma)

```bash
npx prisma migrate dev --name describe-what-changed   # Create + apply migration
npx prisma generate                                     # Regenerate Prisma client
npx prisma studio                                       # DB GUI
npx prisma db push                                      # Push schema without migration (dev only)
```

> ⚠️ Always use Prisma CLI commands. Never write raw SQL migrations.

### Docker

```bash
docker-compose up -d   # Start PostgreSQL
docker-compose down    # Stop PostgreSQL
```

### Git Commits

Use `/git-commit` workflow. Format: `type(scope): description` (Conventional Commits).
Types: feat · fix · chore · refactor · docs · style

### Code Style Rules

- `strict: true` in tsconfig. No `any` types.
- Import order: NestJS → third-party → local (blank line between groups)
- Enums over magic strings
- `async/await` only — no `.then()` chains
- Thin controllers — all logic in services
- Every input validated with DTO + `class-validator`

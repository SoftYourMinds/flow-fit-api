# FlowFit API

REST API backend for the FlowFit fitness coach CRM.

## Tech Stack

- **NestJS 11** — Node.js framework
- **PostgreSQL 16** — Relational database
- **Prisma** — Type-safe ORM
- **Swagger** — API documentation
- **JWT** — Authentication
- **Telegram Bot** — Notifications (nestjs-telegraf)

## Quick Start

### Prerequisites

- Node.js 25+
- Docker & Docker Compose (for PostgreSQL)
- npm

### Setup

```bash
# 1. Clone the repository
git clone https://github.com/<your-username>/flow-fit-api.git
cd flow-fit-api

# 2. Install dependencies
npm install

# 3. Start PostgreSQL
docker-compose up -d

# 4. Copy environment variables
cp .env.example .env

# 5. Run database migrations
npx prisma migrate dev

# 6. Start development server
npm run start:dev
```

### Available Scripts

| Command                | Description                              |
| ---------------------- | ---------------------------------------- |
| `npm run start:dev`    | Start in watch mode                      |
| `npm run start:debug`  | Start in debug mode                      |
| `npm run build`        | Build for production                     |
| `npm run start:prod`   | Run production build                     |
| `npm run lint`         | Run ESLint                               |
| `npm run test`         | Run unit tests                           |

### Database

| Command                                         | Description                    |
| ------------------------------------------------ | ------------------------------ |
| `npx prisma migrate dev --name <name>`          | Create & apply migration       |
| `npx prisma generate`                            | Regenerate Prisma client       |
| `npx prisma studio`                              | Open database GUI              |

### API Documentation

After starting the server, visit: **http://localhost:3000/api/docs**

## Project Structure

```
src/
├── modules/
│   ├── auth/          # JWT authentication
│   ├── user/          # User profile management
│   ├── client/        # Client CRUD
│   ├── client-note/   # Client notes with links
│   ├── metrics/       # Client metrics history
│   ├── location/      # Workout locations
│   ├── workout-session/ # Session scheduling
│   ├── participant/   # Session participants
│   ├── scheduler/     # Cron jobs
│   ├── telegram/      # Telegram bot
│   └── shared/        # Guards, decorators, filters
├── prisma/
│   └── schema.prisma
├── app.module.ts
└── main.ts
```

## Documentation

- [Requirements](docs/REQUIREMENTS.md)
- [API Specification](docs/API-SPEC.md)
- [Database Schema](docs/DATABASE.md)
- [MVP Phases](docs/PHASES.md)

## License

Private — All rights reserved.

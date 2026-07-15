# FlowFit Memory

## Current State
- UI/UX modernization is fully implemented on the client-side with Nude & Terracotta theme (#C88A72).
- API includes `updateNote` method in `ClientsService` for client note edits.
- Scheduler supports Day, Week, and Month views.
- Payment tracking (`isPaid`) has been removed entirely; `price` represents the total session cost.
- API is prepared for remote access via devtunnels endpoint (`https://2p7hpg02-4000.euw.devtunnels.ms`).
- API is configured for serverless deployment on Vercel (`api/serverless.ts`), with file logging disabled in production environments.

## Recent Changes
- Configured NestJS backend for Vercel Serverless Functions (`api/serverless.ts`).
- Updated `logger.config.ts` to disable file logging in production to prevent `EROFS` errors on Vercel's read-only file system.
- Added `prisma generate` to `postinstall` script in `package.json` to ensure Prisma Client is generated during Vercel builds.
- Removed `isPaid` field from `SessionParticipant` schema.
- Renamed `pricePerPerson` to `price` in `WorkoutSession` schema.
- Updated `reports.service.ts` to calculate total income based on `session.price`.
- Added `updateNote` method in `ClientsService` (API).
- Updated `environment.ts` to use devtunnel URL.
- Class-based `.dark` theme configured in `variables.scss` and `global.scss`.

## Known Issues
- None. Build completes successfully.

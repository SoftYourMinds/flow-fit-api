---
trigger: always_on
---

# NestJS Project Standards — FlowFit API

## Architecture

- Think in features, not layers. Every domain is a NestJS module under `src/modules/`.
- Use Dependency Injection for everything; do not `new` up services or repositories by hand.
- Follow NestJS defaults unless there is a strong reason not to.
- Enable `"strict": true` in `tsconfig.json`. Never use `any`. If a type cannot be inferred, define an explicit type.
- Prefer decorators over imperative plumbing.

## Project Structure

Keep the structure flat and predictable. All modules live in a single `src/modules/` folder, including shared ones.

```
src/
├── modules/
│   ├── auth/
│   ├── user/
│   ├── client/
│   ├── client-note/
│   ├── metrics/
│   ├── location/
│   ├── workout-session/
│   ├── participant/
│   ├── scheduler/
│   ├── telegram/
│   ├── shared/
│   │   ├── decorators/
│   │   ├── guards/
│   │   ├── interceptors/
│   │   ├── filters/
│   │   └── shared.module.ts
├── prisma/
│   └── schema.prisma
├── app.module.ts
└── main.ts
```

Each feature module contains its controllers, services, DTOs, and Prisma-related types. `SharedModule` is the central hub for cross-cutting logic (guards, interceptors, common services). Export from a module only what other modules need.

## Module and Service Design

- Modules are self-contained. Reach across modules only through public exports.
- Keep controllers thin. Business logic lives in services.

Bad (logic in the controller):

```typescript
@Get()
async getClients() {
  const clients = await this.prisma.client.findMany();
  return clients.filter(c => c.isActive);
}
```

Good:

```typescript
@Get()
getClients() {
  return this.clientService.getActiveClients();
}
```

## Coding Standards

- Validate every input with a DTO using `class-validator` and `class-transformer`.
- Use enums instead of magic strings.
- Use `async`/`await`. Do not chain `.then()`.
- Import order: NestJS modules first, third-party packages second, local imports third. Separate the three groups with a blank line.
- Use Swagger decorators (`@ApiTags`, `@ApiOperation`, `@ApiResponse`) on every controller and endpoint.

## Prisma Usage

- Always use Prisma Client for database operations. No raw SQL unless strictly necessary.
- Every query for tenant-scoped entities MUST include `where: { trainerId }`.
- Use `prisma.$transaction()` for multi-table writes.
- Keep Prisma schema as the single source of truth for the database structure.
- After schema changes: `npx prisma migrate dev --name describe-change`

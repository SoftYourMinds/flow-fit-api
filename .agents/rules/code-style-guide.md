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
│   ├── reports/
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

## Service Layer & Clean Code Rules

**CRITICAL TRIGGER:** You MUST review your generated code against these rules as a final step before presenting it to the user.

1. **Guard Clauses over Nested `if`s**
   Exit early, do not nest logic. If an `if` block ends with a `return`, it is a guard clause. Guard clauses must go first and should not be nested.
   _Bad:_ `if (a) { if (b) { do() } }`
   _Good:_ `if (!a) return; if (b) do();`

2. **Combine Conditions**
   Combine conditions instead of nesting them (e.g., `if (a && b) { ... }`).
   _Exception:_ Only separate them if each condition requires a different side-effect or error message.

3. **`return promise` instead of `await` in void methods**
   In `async` functions returning `Promise<void>`, forwarding the promise is cleaner than `await`ing it.
   _Bad:_ `await this.foo(); return;`
   _Good:_ `return this.foo();`
   _Exception:_ Use `return await` if inside a `try/catch` block for better stack traces.

4. **Extract Private Methods with Expressive Names**
   Each distinct operation is a separate private method. The name must describe the intent, not the mechanism.
   _Rule:_ If you need a comment to explain a block of code, extract it into a method with a descriptive name.

5. **One Method — One Responsibility**
   Public methods describe _what_ happens (orchestration). Private methods describe _how_ it happens (implementation details).

6. **Explicit Return Types on All Methods**
   Always declare return types. Even if TypeScript can infer the type, explicit return types document intent and catch errors earlier (e.g. `async method(): Promise<void> {`).

7. **File Structure — Sections via Comments**
   Maintain strict ordering in service files separated by comments:
   `// ─── Public Methods ─────────────────────────────────────────────`
   `// ─── Business Logic ─────────────────────────────────────────────`
   `// ─── Private Helpers ────────────────────────────────────────────`

8. **Boolean Checks in Descriptive Variables**
   If a boolean expression requires mental parsing, extract it into a descriptively named variable.
   _Bad:_ `if (!prev && current) { ... }`
   _Good:_ `const toggledOn = !prev && current; if (toggledOn) { ... }`

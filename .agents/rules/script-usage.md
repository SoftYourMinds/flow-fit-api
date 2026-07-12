---
trigger: always_on
---

# Project Scripts & CLI Rules

## 1. Prioritize Existing Scripts

Before executing any CLI commands, you MUST check the `package.json` scripts.

- **Rule:** Always use the predefined scripts (e.g., `npm run start:dev`, `npm run lint`, `npm run build`) instead of raw tool commands.
- **Exception:** You are only allowed to invent or construct a new command if a suitable script for the task does NOT exist in `package.json`.

## 2. Database Migrations (Prisma)

When modifying the database schema, strictly use Prisma CLI commands.

### Creating Migrations

After modifying `prisma/schema.prisma`, create and apply a migration:

**Syntax:**
`npx prisma migrate dev --name <migration-name>`

**Naming Rules for `<migration-name>`:**

- **Format:** Use `kebab-case` or `snake_case` only.
- **Descriptive:** The name must clearly describe the change (e.g., `create-users-table`, `add-status-to-sessions`).
- **No Timestamps:** Do not add timestamps to the name manually; Prisma handles this automatically.

**✅ Correct Examples:**
`npx prisma migrate dev --name create-client-table`
`npx prisma migrate dev --name add-weight-to-client`

**❌ Incorrect Examples:**
`npx prisma migrate dev --name CreateClient` (not kebab-case)
`npx prisma db push` in production (use only for prototyping)

### Other Prisma Commands

```bash
npx prisma generate          # Regenerate Prisma client after schema changes
npx prisma studio            # Launch Prisma Studio (DB GUI)
npx prisma migrate deploy    # Apply pending migrations in production
npx prisma db seed            # Run seed script
```

## 3. Package Manager

This project uses **npm**. Never use `yarn` or `pnpm`.

---
description: Analyzes current code changes and creates atomic, goal-oriented commits using the Conventional Commits format.
---

# Git Commit Workflow

## Philosophy

Every commit message must answer the question: **"What did we achieve?"** — not "What did we touch?".

A good commit message reads like a changelog entry a teammate would understand without reading the diff.

**Bad (mechanical/literal):** `refactor(session): update controller and service files for status check`
**Good (goal-oriented):** `feat(session): add automated status transition on trigger endpoint`

**Bad:** `refactor(telegram): extract methods and apply clean code`
**Good:** `refactor(telegram): decompose webhook handler into dedicated command parsers`

---

## Execution Steps

### Step 1: Analyze the Full Changeset

Run `git status` and `git diff` (or `git diff --cached` for staged files) to understand ALL changes in the working tree.

Read the diffs carefully. Identify:

- **What was the developer's goal?** (not what files changed)
- **Are there logically independent changes?** (infra vs domain, feature vs tooling, etc.)

### Step 2: Plan Atomic Commits

Split changes into **logical units**, each representing a single completed goal. Apply these grouping rules:

| Layer                | What belongs together                                   | Example scope                 |
| -------------------- | ------------------------------------------------------- | ----------------------------- |
| **Infrastructure**   | New packages, module configuration, database schema     | `deps`, `prisma`, `config`    |
| **Core/Shared**      | Base services, shared utilities, guards, interceptors   | `shared`, `auth`              |
| **Domain consumers** | Feature services/controllers adopting changes           | `session`, `client`, `reports`|
| **Tooling/Meta**     | Agent rules, workflows, configs, docs                   | `agents`, `docs`, `ci`        |

**Rules:**

- Infrastructure setup BEFORE consumers that use it.
- A commit must compile and pass lint on its own (no broken intermediate states).
- If 10+ files have the same 2-line mechanical change (e.g., removing an import), that's ONE commit — not 10.
- Never mix functional changes with tooling/docs in the same commit.

### Step 3: Present the Commit Plan

Show the user a table:

```
| # | Files to stage | Commit message |
|---|----------------|---------------|
| 1 | package.json, prisma/schema.prisma | feat(prisma): add payment status field to session |
| 2 | src/modules/shared/* | refactor(shared): introduce tenant isolation helper |
| 3 | src/modules/session/* | feat(session): enforce tenant filter across session queries |
| 4 | .agents/rules/*.md | chore(agents): update code style rules |
```

### Step 4: Execute Commits One by One

For each commit in the plan:

1. Stage only the relevant files: `git add <file1> <file2> ...`
2. Verify staged content: `git diff --cached --stat`
3. Show the commit message and **wait for user confirmation**
4. Run `git commit -m "message"`
5. Proceed to the next commit

---

## Commit Message Rules

### Format

```
<type>(<scope>): <goal-oriented description>

<optional body: context, rationale, or impact>
```

### Types

| Type       | When to use                                    |
| ---------- | ---------------------------------------------- |
| `feat`     | New capability, new behavior, new API endpoint |
| `fix`      | Bug fix, correction of wrong behavior          |
| `refactor` | Code restructuring without changing behavior   |
| `chore`    | Dependencies, configs, build, CI, tooling      |
| `docs`     | Documentation only                             |
| `perf`     | Performance improvement                        |
| `test`     | Adding or fixing tests                         |

### Scope

- Use the **primary domain** affected: `auth`, `user`, `client`, `session`, `location`, `reports`, `scheduler`, `telegram`, `prisma`, `agents`
- **Omit scope** when the change spans 3+ unrelated modules (e.g., global rename or cross-cutting cleanup)
- Never use generic scopes like `code`, `files`, `update`

### Description Quality Checklist

Before finalizing, verify the description against these anti-patterns:

| ❌ Anti-pattern                            | ✅ Better alternative                                       | Why                                   |
| ------------------------------------------ | ----------------------------------------------------------- | ------------------------------------- |
| `update controller and service`            | `add automated status transition for active workouts`      | Describes the goal, not the mechanism |
| `fix bugs in queries`                      | `enforce trainerId filtering on tenant-scoped queries`      | Explains WHY and WHAT                 |
| `apply clean code`                         | `decompose webhook handler into dedicated command parsers`  | Concrete, not abstract                |
| `update files`                             | `migrate legacy constructor injections to inject()`         | Specific and meaningful               |

### The "Changelog Test"

Read the commit message as if it were a line in a CHANGELOG.md. Would a teammate understand the impact? If not — rewrite it.

---

## Body (Optional but Recommended for Non-Trivial Changes)

Add a body when the commit:

- Removes a dependency or pattern used across many files
- Introduces a new architectural pattern
- Has non-obvious rationale

---
name: git-commit
description: >-
  Creates clean, atomic, goal-oriented Conventional Commits, handles SemVer version
  bumping, updates Ukrainian release notes, and creates/pushes annotated git tags.
  Use whenever the user asks to commit changes, prepare a release, bump the app
  version, tag a release, or deploy updates.
---

# Git Commit & Release Skill

## Philosophy

Every commit message must answer **"What did we achieve?"** — not "What files did we touch?".
Read the message as if it were a line in `CHANGELOG.md`. If a teammate cannot understand the impact without reading the diff, rewrite it.

- **Bad:** `fix(sessions): update service and dto`
- **Good:** `fix(sessions): prevent duplicate session creation under concurrent requests`

---

## Step-by-Step Procedure

### Step 1: Inspect the Changeset
1. Run `git status` and `git diff` (and `git diff --cached` if anything is staged).
2. Identify:
   - What user-facing or technical goals were accomplished.
   - Which changes are logically independent (feature vs fix vs tooling/agents vs release).
   - Untracked files that do NOT belong in the commit — never blindly run `git add .`.

### Step 2: Version Bump & Release Notes (When Releasing)
If releasing user-facing changes (`feat` or `fix`):

1. **Determine SemVer bump based on impact:**
   - **PATCH** (`0.4.4` → `0.4.5`): bug fixes, small UX improvements, static option updates, minor tweaks.
   - **MINOR** (`0.4.4` → `0.5.0`): substantial new features, new pages/modules, backwards-compatible capability additions.
   - **MAJOR** (`0.4.4` → `1.0.0`): breaking changes or milestone overhaul.
2. **Update Ukrainian Release Notes (`flow-fit-api`):**
   - Prepend the new release object to `APP_UPDATES_DATA` in `src/modules/app-updates/data/app-updates.data.ts` with `badge: 'Новинка'`.
   - Change the previous latest entry's `badge` from `'Новинка'` to `'Попереднє'`.
   - Update `src/modules/app-updates/app-updates.service.spec.ts` to expect the new version.
3. **Sync Version Files:**
   - `flow-fit-api/package.json` → `"version": "<new-version>"`
   - `flow-fit-client/package.json` → `"version": "<new-version>"`
   - `flow-fit-client/src/environments/environment.ts` → `appVersion: '<new-version>'`
   - `flow-fit-client/src/environments/environment.prod.ts` → `appVersion: '<new-version>'`
4. **Verify:**
   - Run `npm run build` and relevant unit tests before committing.

### Step 3: Plan Atomic Commits

Group changes into logical units:

| Layer | What belongs together | Example scope |
| --- | --- | --- |
| **Database / Infra** | Prisma schema, migrations, env config, deps | `prisma`, `deps`, `config` |
| **Domain modules** | Controllers, services, DTOs per module | `sessions`, `clients`, `subscriptions`, `reports`, `notifications`, `telegram` |
| **Release** | Version bumps and `APP_UPDATES_DATA` release notes | `release` |
| **Tooling / Meta** | `.agents/` rules, skills, docs, CI | `agents`, `docs`, `ci` |

**Rules:**
- Never mix functional code changes with `.agents/` tooling or release bumps in the same commit.
- Every commit must compile cleanly on its own.

### Step 4: Execute Commits & Create Git Tag

1. Stage explicit files: `git add <file1> <file2> ...`
2. Verify staged diff: `git diff --cached --stat`
3. Commit with Conventional Commits format:
   ```bash
   git commit -m "<type>(<scope>): <goal-oriented description>"
   ```
4. If this is a release commit, **create an annotated git tag**:
   ```bash
   git tag -a v<new-version> -m "Release v<new-version>"
   ```
5. Push commits and tags when requested/approved:
   ```bash
   git push && git push --tags
   ```

### Step 5: Post-Release Telegram Broadcast Prompt

If a new version was released and pushed, ask the user:
> *"Бажаєте надіслати сповіщення про реліз `v<new-version>` усім тренерам через Telegram-бота (`POST /app-updates/broadcast-telegram`)?"*

---

## Conventional Commits Reference

### Format
```text
<type>(<scope>): <imperative, lowercase, goal-oriented description>

<optional body explaining why/impact>
```

### Allowed Types
- `feat`: new capability or user-facing behavior
- `fix`: bug fix or correction of wrong behavior
- `refactor`: code restructuring without changing behavior
- `chore`: dependencies, configs, release bumps, agent tooling
- `docs`: documentation only
- `perf`: performance improvement
- `test`: adding or updating tests

### Scope Rules
- Use the primary module: `auth`, `sessions`, `clients`, `locations`, `subscriptions`, `reports`, `notifications`, `telegram`, `app-updates`, `release`, `agents`.
- Omit scope when spanning 3+ unrelated areas.
- Never use vague scopes like `code`, `files`, `update`.

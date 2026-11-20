---
trigger: always_on
---

# Release Notes, Versioning & Post-Task Deployment Rule

## 1. Mandatory Post-Task Prompt

After completing any code task (feature, fix, UX improvement) and verifying that build/tests pass, you **MUST** analyze the scope of the changes, determine the appropriate SemVer bump, and ask the user:

> *"Хочете підняти версію додатку (рекомендовано **<patch / minor / major>**: `v<current>` → `v<next>`) і задеплоїти, чи є ще щось перед деплоєм нової версії?"*

Do **not** bump versions, commit, tag, or push automatically without user confirmation.

## 2. How to Determine the Update Type (SemVer)

Evaluate the actual impact of the changes:

- **PATCH** (`0.4.4` → `0.4.5`): bug fixes, small UX improvements/tweaks, updating static lists/constants, minor behavior adjustments without major new capabilities.
- **MINOR** (`0.4.4` → `0.5.0`): noticeable new user-facing features, new screens/modules, or backwards-compatible functionality additions.
- **MAJOR** (`0.4.4` → `1.0.0`): breaking changes, major architecture shifts, or milestone releases.

## 3. Release Execution Steps (After User Confirms)

When the user approves releasing and deploying a new version:

1. **Sync Version Across Both Repositories:**
   - `flow-fit-api/package.json` → `"version": "<new-version>"`
   - `flow-fit-client/package.json` → `"version": "<new-version>"`
   - `flow-fit-client/src/environments/environment.ts` → `appVersion: '<new-version>'`
   - `flow-fit-client/src/environments/environment.prod.ts` → `appVersion: '<new-version>'`
2. **Update "What's New" Changelog (`flow-fit-api`):**
   - Prepend the new release entry in Ukrainian to `APP_UPDATES_DATA` in `src/modules/app-updates/data/app-updates.data.ts` with `badge: 'Новинка'`.
   - Change the previous latest entry's `badge` from `'Новинка'` to `'Попереднє'`.
   - Update the expected latest version in `src/modules/app-updates/app-updates.service.spec.ts`.
3. **Verify Before Commit & Push:**
   - Re-run `npm run build` and relevant tests in affected repositories.
4. **Commit Using the `git-commit` Skill:**
   - Create clean, atomic Conventional Commits (`feat`, `fix`, `chore`, etc.).
5. **Create & Push Git Tag:**
   - Always tag the release commit with an annotated tag:
     `git tag -a v<new-version> -m "Release v<new-version>"`
   - Push commits and tags (`git push && git push --tags`) in every repository updated for the release.
6. **Optional Broadcast Prompt:**
   - Ask if the user wants to notify trainers via Telegram (`POST /app-updates/broadcast-telegram`).

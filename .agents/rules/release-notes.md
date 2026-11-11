# Release Notes & Versioning Rule

Whenever committing or pushing user-facing changes (`feat` or `fix`) to `flow-fit-api` or `flow-fit-client`:

1. **Bump SemVer Version:**
   - `feat`: increment **MINOR** (e.g. `0.4.0` -> `0.5.0`)
   - `fix`: increment **PATCH** (e.g. `0.4.1` -> `0.4.2`)
   - Breaking change: increment **MAJOR**
2. **Update "What's New" Changelog (`flow-fit-api`):**
   - Prepend the new release entry in Ukrainian to `APP_UPDATES_DATA` in `src/modules/app-updates/data/app-updates.data.ts`, and change the previous latest item's `badge` from `'Новинка'` to `'Попереднє'`.
   - Update the expected latest version in `src/modules/app-updates/app-updates.service.spec.ts`.
3. **Sync Version Across Both Repositories:**
   - `flow-fit-api/package.json` -> `"version": "<new-version>"`
   - `flow-fit-client/package.json` -> `"version": "<new-version>"`
   - `flow-fit-client/src/environments/environment.ts` -> `appVersion: '<new-version>'`
   - `flow-fit-client/src/environments/environment.prod.ts` -> `appVersion: '<new-version>'`
4. **Verify Before Push:**
   - Re-run tests/build after updating the release notes and version files so the release commit is clean.

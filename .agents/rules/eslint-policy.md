---
trigger: always_on
---

# ESLint Agent Rule

npm run lint

## Core Principle

Lint exists to prevent runtime bugs — not to enforce stylistic perfection.

---

## Severity Levels

### ERROR — must fix before completing a task

Errors indicate code that may cause:

- Runtime crashes
- Unhandled promise rejections
- Broken dependency injection
- Invalid imports
- Async logic bugs

### WARNING — advisory only

- Warnings should be improved when convenient.
- Warnings must **never** block feature delivery.
- Do not spend significant time eliminating warnings unless the task explicitly requires code cleanup.

---

## Decision Rules

**Errors:**

> When choosing between ignoring an ESLint error vs. fixing it → **fix the error.**

**Warnings:**

> When choosing between spending 30 minutes satisfying a warning vs. delivering a working feature → **deliver the feature.**

---

## Type Safety

`any` is **allowed** when:

- Integrating third-party APIs
- Building prototypes
- Working around temporary typing limitations

When using `any`, always add a TODO comment:

```ts
// TODO: replace `any` with a proper type once X is resolved
const data: any = externalApiResponse;
```

Type safety is important, but **delivery speed is prioritized during MVP development**.

---

## Summary

| Situation              | Action                         |
| ---------------------- | ------------------------------ |
| ESLint ERROR present   | Fix before completing the task |
| ESLint WARNING present | Note it, ship the feature      |
| Need `any` temporarily | Allowed — add a TODO comment   |
| Explicit cleanup task  | Warnings may be addressed      |

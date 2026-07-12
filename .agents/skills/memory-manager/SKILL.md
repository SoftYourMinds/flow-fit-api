---
name: memory-manager
description: Automatically updates the persistent project memory and session state. Use this skill when the user says "I'm done", "wrap up", "end session", or when finalizing a major feature, commit, or debugging session. Also trigger after completing any multi-step implementation task.
---

# Memory & Session Manager Skill

## Goal

Update the project's handoff state so the next session has a direct starting point without burning tokens to reconstruct context.

## Steps

1. **Review session changes**
   - Run `git status` and `git diff --stat` to see what files changed.
   - Identify which modules, entities, or services were touched.

2. **Update MEMORY.md if needed**
   Update `.agents/MEMORY.md` only when any of the following changed:
   - The project's active complexity level or maturity level scales (e.g., MVP to Monolith)
   - A new "acceptable hack" or technical debt is added, or an existing one is resolved
   - A new entity, module, or service was added
   - A new architectural pattern or convention was introduced
   - An enum was added or a domain concept was renamed

   Use the WHAT-WHY-HOW framework, and preserve the `## 📊 PROJECT LEVEL` and `## 🪵 ACTIVE TECH DEBT & ACCEPTABLE HACKS` sections at the very top. Keep the file under 220 lines total.

3. **Update HANDOFF.md**
   Always update `.agents/HANDOFF.md` at session end. Record:

   ```markdown
   ## Last Session Summary

   **Date:** YYYY-MM-DD
   **Session focus:** <short description>

   ### ✅ Accomplished

   - <item 1>
   - <item 2>

   ### ⚠️ Pending / Known Issues

   - <broken thing or tech debt>

   ### 🚀 Immediate Next Steps

   1. <most important next action>
   2. <second action>
   ```

## Constraints

- Keep `MEMORY.md` under **200 lines** — summarize, do not paste code
- **NEVER** embed API keys, DB connection strings, passwords, or tokens
- Do not duplicate information already captured in `.agents/rules/` system rules
- If a new pattern is added that contradicts an existing rule, flag it as an open question rather than silently overwriting

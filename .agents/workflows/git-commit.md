---
description: Analyzes current code changes and creates a commit using the Conventional Commits format.
---

# Git Commit Workflow

When the user asks to create a commit or invokes this workflow:

1. **Analyze changes:** Use the terminal to run `git status` and `git diff` commands (or `git diff --staged` if the files are already staged). Understand the context of the changes.
2. **Determine type and scope:**
   - **type**: `feat` (new features), `fix` (bug fixes), `chore` (maintenance, dependencies), `refactor` (code refactoring), `docs` (documentation), `style` (formatting).
   - **scope**: The name of the module, component, or entity where the changes occurred (e.g., `auth`, `client`, `session`, `db`, `docs`).
3. **Format the message:** It must be in English, short, and meaningful.
   - _Format:_ `type(scope): description`
   - _Examples:_
     - `feat(auth): add JWT token validation`
     - `fix(session): resolve status transition bug`
     - `chore(deps): update nestjs to v11`
     - `docs(api): update swagger endpoint descriptions`
4. **Execute commits one by one:** Show the generated message to the user for confirmation. If the user agrees, run the `git commit -m "message"` command in the terminal.

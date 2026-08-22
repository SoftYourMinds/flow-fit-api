---
description: Manually trigger the Code Style Guide verification and refactoring pass on a specific file.
---

# Clean Up Code Workflow

This workflow is triggered when the user runs the `/clean-up` slash command. It instructs you to review the active file (or a specified file) and refactor it strictly according to the Service Layer & Clean Code Rules defined in `.agents/rules/code-style-guide.md`.

## Execution Steps:

1. **Identify Target:**
   Determine which file the user wants to clean up. If unspecified, use the user's currently active document.

2. **Review against Rules:**
   Read the file thoroughly and evaluate it against the clean code rules:
   - **Guard Clauses:** Flatten nested logic.
   - **Combine Conditions:** Reduce unnecessary nested ifs.
   - **Promise Forwarding:** Return promises directly instead of `await`ing in void methods (unless catching).
   - **Extract Private Methods:** Ensure complex blocks are extracted into well-named private methods.
   - **Single Responsibility:** Separate orchestration (public) from implementation (private).
   - **Explicit Return Types:** Ensure all methods have explicit return types.
   - **Descriptive Booleans:** Extract complex inline logic into descriptive variables.
   - **File Structure Comments:** Ensure proper separation (Public Methods, Business Logic, Private Helpers).

3. **Refactor:**
   Apply the necessary transformations using your file editing tools.
   - **CRITICAL:** Do not change the core business logic or introduce bugs, only refactor the structure and style.
   - Use `replace_file_content` if making contiguous changes.

4. **Lint & Verify:**
   Run `npm run lint` to ensure no syntax or formatting errors were introduced during the refactor.

5. **Report:**
   Provide a brief summary to the user outlining what was refactored and why.

---
name: clean-code-refactor
description: Remove dead code, fix typing, standardize patterns, and improve error handling without breaking existing behavior
---

# Clean Code Refactor Skill

## Goal
Leave the codebase cleaner than you found it, safely.

## Procedure
1. Grep for `as any` — eliminate by extending interfaces
2. Grep for `console.log` in production code — replace or remove
3. Grep for legacy naming (e.g., `hankinsonBasis` → `benchmarkBasis`)
4. Look for unused imports and dead code
5. Run tests after EVERY change
6. Create `docs/antigravity/code-cleanup-report.md`

## Constraints
- Never refactor without passing tests first
- Keep interfaces stable
- Document any behavior change
- Defer risky refactors — document them instead

## Artifacts
- `docs/antigravity/code-cleanup-report.md`

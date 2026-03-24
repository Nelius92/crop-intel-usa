---
name: functional-validation
description: Run all tests, lints, builds, and verify the app works end-to-end with reproducible steps and evidence
---

# Functional Validation Skill

## Goal
Prove the app works (or document exactly what's broken) with reproducible evidence.

## Procedure
1. Run: `npm test`, `npm run build`, `npm run lint`
2. Run: `npm run typecheck:api`, `npm run build:api` (if API exists)
3. Fix any failing tests — document root cause and fix
4. Start dev server and verify UI loads
5. For each broken item: title, severity, impact, repro steps, root cause, files, fix status
6. Create `docs/antigravity/functional-validation-report.md`

## Commands
```bash
npm test
npm run build
npm run lint
npm run typecheck:api
npm run build:api
npm run verify:release  # combined
```

## Artifacts
- `docs/antigravity/functional-validation-report.md`

## Definition of Done
- All tests pass (or failures documented with root cause)
- Build succeeds
- Lint clean
- Report includes exact commands and output

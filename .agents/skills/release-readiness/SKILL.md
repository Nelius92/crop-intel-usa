---
name: release-readiness
description: Final pre-release checklist — re-run all verification, confirm docs, confirm tests cover fixes
---

# Release Readiness Skill

## Procedure
1. Run `npm run verify:release` (test + build + typecheck:api + build:api)
2. Verify all docs in `docs/antigravity/` are coherent
3. Verify all fixes are covered by tests
4. Re-test top user journeys (map loads, buyers table, settings)
5. Check for regressions from code changes
6. Create final master summary

## Commands
```bash
npm run verify:release
```

## Artifacts
- `docs/antigravity/final-master-summary.md`

## Definition of Done
- All tests pass
- Build succeeds
- No regressions
- Summary documents everything

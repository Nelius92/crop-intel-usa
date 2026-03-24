---
name: github-readiness
description: Prepare repo for public GitHub — README, .env.example, .gitignore, secrets check, and CI setup
---

# GitHub Readiness Skill

## Procedure
1. Check for committed secrets: `git ls-files .env *.pem *.key`
2. Review `.gitignore` completeness
3. Create `.env.example` if missing
4. Review README for setup/run/test/deploy instructions
5. Check for stale files in repo root
6. Verify LICENSE exists
7. Create `docs/antigravity/github-readiness-report.md`

## Artifacts
- `.env.example`
- `docs/antigravity/github-readiness-report.md`

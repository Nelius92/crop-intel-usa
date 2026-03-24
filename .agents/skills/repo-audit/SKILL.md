---
name: repo-audit
description: Discover and document how a codebase is built — stack, structure, entry points, services, data flow, and deployment
---

# Repo Audit Skill

## Goal
Produce a complete architecture audit of an unfamiliar codebase so future agents can work effectively.

## When to Use
- First time working on a repo
- Onboarding a new developer
- Before any major refactor

## Prerequisites
- Access to the repo root

## Procedure
1. Read `package.json` / `requirements.txt` / `pubspec.yaml` to identify stack
2. `list_dir` on root and `src/` to map structure
3. Read entry points (`main.tsx`, `server.ts`, `app.py`)
4. Identify: routing, state management, services, API layer, DB, cache, auth, logging
5. Identify all environment variables (grep for `process.env`, `import.meta.env`)
6. Record OS, runtime versions, package manager
7. Create `docs/antigravity/app-architecture-audit.md`
8. Create `docs/antigravity/mermaid-dataflow.md` with at least 2 mermaid diagrams

## Artifacts
- `docs/antigravity/app-architecture-audit.md`
- `docs/antigravity/mermaid-dataflow.md`
- `docs/antigravity/project-context.md`

## Definition of Done
- All entry points documented
- All services listed with purpose
- At least 2 mermaid diagrams
- Environment variables inventoried

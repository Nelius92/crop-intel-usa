---
name: assumption-challenge
description: Challenge product assumptions by asking hard questions about purpose, users, success metrics, and edge cases — with evidence
---

# Assumption Challenge Skill

## Goal
Force clarity on what the product should accomplish before writing code.

## When to Use
- Before starting a new feature
- Before a major audit or refactor
- When product direction is unclear

## Procedure
1. Review existing docs (README, alignment workflows, past KIs)
2. Ask 12 questions across categories: Purpose, Users, Core Problem, Success Metrics, Journeys, Edge Cases, Privacy, Licensing, Monetization, Latency, Accuracy
3. For each, provide: answer, evidence source, why it matters
4. Mark unknowns explicitly with discovery actions
5. Create `docs/antigravity/assumption-challenge-matrix.md`

## Key Questions
- A) What is the app's primary purpose?
- B) Who are the target users?
- C) What decision does it help make?
- D) What are the top 3 user journeys?
- E) What failure modes must be handled?
- F) What data is collected?
- G) What licensing constraints exist?
- H) What staleness is acceptable?

## Artifacts
- `docs/antigravity/assumption-challenge-matrix.md`

## Definition of Done
- All 12 questions answered with evidence
- Unknowns marked with discovery actions

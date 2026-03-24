---
name: security-privacy-audit
description: Audit personal data, auth, input validation, API security, and dependency vulnerabilities
---

# Security & Privacy Audit Skill

## Procedure
1. Inventory all personal data collected/stored/transmitted
2. Check auth/session handling
3. Review API security (CORS, rate limiting, headers, input validation)
4. Check for SQL injection (parameterized queries?)
5. Check for committed secrets
6. Run `npm audit` for dependency vulnerabilities
7. Create `docs/antigravity/security-privacy-audit.md`

## Artifacts
- `docs/antigravity/security-privacy-audit.md`

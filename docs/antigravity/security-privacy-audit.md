# Corn Intel — Security & Privacy Audit

## Executive Summary
- **No authentication** — app is fully open ⚠️
- **No personal data collected** currently ✅
- **No secrets in git** ✅
- **API has rate limiting and Helmet** ✅
- **CORS configured** ✅
- **Input validation via Zod** on API side ✅

## Personal Data Inventory

| Data Type | Collected? | Stored? | Notes |
|-----------|-----------|---------|-------|
| User identity | No | No | No auth system |
| Location | No | No | Farm origin is config, not collected |
| Watchlists/favorites | No | No | Not implemented |
| Usage analytics | No | No | No analytics SDK |
| Buyer contact info | Yes (DB) | Postgres | Business data, not user PII |

**When order submission is built**, farmer contact info will be collected — privacy policy needed at that point.

## Authentication & Access Control

- **Frontend**: No authentication. Anyone with the URL can access.
- **API**: No authentication. All endpoints are public.
- **Dev mode**: `?dev=true` URL param bypasses under-construction page (stored in localStorage).

> [!WARNING]
> Before adding order submission, authentication MUST be implemented. Farmers' order data and contact info require protection.

## API Security Review

| Control | Status | File |
|---------|--------|------|
| Helmet (security headers) | ✅ Enabled | `server.ts:25` |
| CORS | ✅ Configured | `middleware/cors.ts` |
| Rate limiting | ✅ Enabled | `middleware/rate-limit.ts` |
| Error handler | ✅ Sanitized errors | `middleware/error-handler.ts` |
| Body parsing limits | ⚠️ Express defaults (100KB) | `server.ts:31` |
| SQL injection | ✅ Parameterized queries | `repositories/*.ts` |
| Input validation | ✅ Zod schemas on API | `apps/api/package.json` |

## Dependency Audit

| Check | Status |
|-------|--------|
| Express v4 | ✅ Current LTS |
| React 18 | ✅ Current |
| `npm audit` | Not run — recommended for CI |

## Recommendations (Ranked)

1. **Add auth before order submission** — required for farmer data protection
2. **Add `npm audit` to CI** — automated vulnerability scanning
3. **Set explicit body size limit** — prevent large payload attacks
4. **Add CSP headers** — Content Security Policy for frontend
5. **Rotate exposed API keys** — keys in local `.env` should be rotated if they were ever shared

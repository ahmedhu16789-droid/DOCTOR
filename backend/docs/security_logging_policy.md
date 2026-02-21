# Security Logging Policy (Backend)

## Scope
This policy applies to all backend application logs (API, jobs, auth, and integrations).

## 1) Log Levels
- `error`: Security-impacting failures, access denial anomalies, auth/token validation failures that block flows.
- `warning`: Suspicious behavior or policy deviations that require investigation.
- `info`: Business-safe operational milestones only, without sensitive payloads.
- `debug`: Diagnostic details allowed **only** when `config('app.debug') === true`.

## 2) Sensitive Data Handling
Never log raw secrets or direct identifiers that can expose user/clinic data.

### Must NOT be logged (raw)
- Passwords, tokens, session IDs, API keys, cookies.
- Full personal data (emails, names, phone numbers, addresses).
- Full internal identifiers (user/clinic/branch IDs) in security-sensitive contexts.
- Full schedules or full structured payloads that can reveal operating patterns.

### Required masking/redaction
- IDs: mask or hash (e.g., keep first 2 + last 2 chars only).
- Emails: mask local part (e.g., `j***@domain.com`).
- Structured arrays: log counts/flags/summary instead of full content.

## 3) Debug Logging Guardrails
- Detailed diagnostics must be wrapped behind `config('app.debug')` checks.
- In debug logs, keep masked identifiers and minimal context needed to diagnose.
- Do not dump full request/response bodies unless fields are explicitly redacted.

## 4) Retention & Access
- Recommended retention for application logs: **30 days** in production.
- Security/incident logs may be retained up to **90 days** if required by compliance/incident response.
- Access to logs must follow least-privilege and be restricted to authorized operators.

## 5) Implementation Checklist
Before adding/changing a log line:
1. Choose the minimal level (`debug` by default for diagnostics).
2. Verify no raw sensitive fields are included.
3. Replace full payloads with summaries (counts/status booleans).
4. Gate diagnostic detail with `config('app.debug')`.
5. Ensure retention/access settings remain aligned with this policy.

# Access matrix (clinic + branch authorization)

This backend now centralizes resource authorization using `App\Support\Authorization\ClinicBranchAuthorization` and branch middleware privilege gates.

## Core policies

1. **Tenant ownership (`clinic_id`)**
   - Controllers must call `assertTenantOwnership($user, $resource)` before mutating/reading clinic-scoped resources.
   - Cross-clinic access resolves as `404` to avoid leaking resource existence.

2. **Branch membership + privilege checks**
   - Branch-scoped routes use `branch.access` middleware.
   - Middleware now evaluates both:
     - user membership in requested `branch_id` / `branchId`
     - role privilege for the requested action (`READ`, `SCHEDULE_MANAGEMENT`, `FINANCE`, `CASH_SESSION`)

3. **Centralized controller checks**
   - Replaced inline `abort_*` clinic/role checks with centralized authorization methods.

## Role matrix

| Role | READ | SCHEDULE_MANAGEMENT | FINANCE | CASH_SESSION |
|---|---|---|---|---|
| ADMIN | ✅ (bypass membership) | ✅ | ✅ | ✅ |
| HQ | ✅ (bypass membership) | ✅ | ✅ | ✅ |
| BRANCH_MANAGER | ✅ (membership required) | ✅ | ✅ | ✅ |
| DOCTOR | ✅ (membership required) | ❌ | ❌ | ❌ |
| RECEPTIONIST | ✅ (membership required) | ✅ | ✅ | ✅ |
| NURSE | ✅ (membership required) | ❌ | ❌ | ❌ |
| PHARMACY_MANAGER | ✅ (membership required) | ❌ | ❌ | ❌ |
| FINANCE_ADMIN | ✅ (membership required) | ❌ | ✅ | ✅ |

## Route-level examples

- `GET /api/v1/appointments?branchId=...` → `READ`
- `POST /api/v1/cash-sessions/open` and `GET /api/v1/reports/reconciliation` → `CASH_SESSION`
- `GET /api/v1/reports/financial` and `GET /api/v1/reports/doctor-payroll` (with `branch_id`) → `FINANCE`

## Source of truth

- Privilege mapping: `config/authorization.php`
- Branch gate middleware: `app/Http/Middleware/EnsureUserCanAccessBranch.php`
- Shared authorization methods: `app/Support/Authorization/ClinicBranchAuthorization.php`

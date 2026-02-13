# Al-Fath Clinic Manager - High-Level Backend Schema

## Core Tenant Table
- `clinics`: `id`, `name`, `subscription_status`, `settings` (JSON), timestamps.

## Operational Tables (all tenant-scoped by `clinic_id`)
- `users`: `clinic_id`, `name`, `email`, `password`, `role`, `specialty`, `consultation_fee`, `schedule` (JSON), `payroll` (JSON).
- `branches`: `clinic_id`, `name`, `location`, `contact_phone`, `is_active`.
- `branch_user`: `clinic_id`, `branch_id`, `user_id` (many-to-many assignment for users/doctors to branches).
- `patients`: `clinic_id`, `name`, `phone`, `gender`, `age`, `medical_history_summary`.
- `appointments`: `clinic_id`, `branch_id`, `patient_id`, `doctor_id`, `date`, `time_slot`, `status`.
- `invoices`: `clinic_id`, `appointment_id`, `total`, `paid_amount`, `status`.
- `transactions`: `clinic_id`, `invoice_id`, `amount`, `method`, `paid_at`.

## RBAC (Spatie Permission)
- `roles`: extended with `clinic_id` for custom clinic-scoped roles while preserving fixed system roles.
- `permissions`: static system-wide permission catalog.
- pivot tables: `model_has_roles`, `model_has_permissions`, `role_has_permissions`.

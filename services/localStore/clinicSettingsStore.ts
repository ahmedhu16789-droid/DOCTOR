import type { ClinicSettingsPayload } from '../api';

const LEGACY_CLINIC_SETTINGS_KEY = 'doctor:mock:clinic-settings:v1';
const CLINIC_DATA_KEY = 'doctor:clinic:data';

export const DEFAULT_CLINIC_SETTINGS: ClinicSettingsPayload = {
  name: 'Clinic',
  email: '',
  phone: '',
  website: '',
  timezone: 'Africa/Cairo',
  currency: 'EGP',
  logoUrl: '',
  commission_basis: 'PAID_AMOUNT',
  apply_on_discounted_amount: true,
  include_tax: false,
  clawback_on_refund: true,
  accrual_day_of_month: 1,
  tv_queue_display_mode: 'MASKED_NAME',
  doctor_advanced_mode_enabled: false,
};

const safeRead = <T,>(key: string): T | null => {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
};

const normalizeClinicSettings = (settings?: Partial<ClinicSettingsPayload> | null): ClinicSettingsPayload => {
  return {
    ...DEFAULT_CLINIC_SETTINGS,
    ...(settings ?? {}),
    tv_queue_display_mode: settings?.tv_queue_display_mode ?? DEFAULT_CLINIC_SETTINGS.tv_queue_display_mode,
    commission_basis: settings?.commission_basis ?? DEFAULT_CLINIC_SETTINGS.commission_basis,
  };
};

export const readLocalClinicSettings = (): ClinicSettingsPayload => {
  const clinicStore = safeRead<{ data?: { clinicSettings?: Partial<ClinicSettingsPayload> } }>(CLINIC_DATA_KEY);
  if (clinicStore?.data?.clinicSettings) {
    return normalizeClinicSettings(clinicStore.data.clinicSettings);
  }

  const legacy = safeRead<Partial<ClinicSettingsPayload>>(LEGACY_CLINIC_SETTINGS_KEY);
  if (legacy) {
    return normalizeClinicSettings(legacy);
  }

  return { ...DEFAULT_CLINIC_SETTINGS };
};

export const writeLocalClinicSettings = (settings: ClinicSettingsPayload): ClinicSettingsPayload => {
  const normalized = normalizeClinicSettings(settings);

  const clinicStore = safeRead<{ version?: number; updatedAt?: string; data?: Record<string, unknown> }>(CLINIC_DATA_KEY);
  if (clinicStore?.data) {
    localStorage.setItem(
      CLINIC_DATA_KEY,
      JSON.stringify({
        ...clinicStore,
        updatedAt: new Date().toISOString(),
        data: {
          ...clinicStore.data,
          clinicSettings: normalized,
        },
      }),
    );
  } else {
    localStorage.setItem(LEGACY_CLINIC_SETTINGS_KEY, JSON.stringify(normalized));
  }

  return normalized;
};

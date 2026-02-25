import { getClinicSettingsFromApi, updateClinicSettingsViaApi } from '../api';
import type { ClinicSettingsPayload } from '../api';
import { readLocalClinicSettings, writeLocalClinicSettings } from '../localStore/clinicSettingsStore';

export interface ClinicSettingsRepository {
  getClinicSettings(): Promise<ClinicSettingsPayload>;
  updateClinicSettings(settings: ClinicSettingsPayload): Promise<ClinicSettingsPayload>;
}

export const clinicSettingsRepository: ClinicSettingsRepository = {
  getClinicSettings: async () => {
    try {
      const remote = await getClinicSettingsFromApi();
      return writeLocalClinicSettings(remote);
    } catch {
      return readLocalClinicSettings();
    }
  },
  updateClinicSettings: async (settings) => {
    const optimistic = writeLocalClinicSettings(settings);

    try {
      const remote = await updateClinicSettingsViaApi(settings);
      return writeLocalClinicSettings(remote);
    } catch {
      return optimistic;
    }
  },
};

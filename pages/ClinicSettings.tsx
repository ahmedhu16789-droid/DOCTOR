import React from 'react';
import { ClinicSettingsForm } from '../components/forms/ClinicSettingsForm';
import { useTranslation } from 'react-i18next';

export const ClinicSettings: React.FC = () => {
  const { t } = useTranslation();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{t('clinic_settings')}</h1>
        <p className="text-sm text-gray-500">{t('clinic_settings_desc')}</p>
      </div>
      <ClinicSettingsForm />
    </div>
  );
};
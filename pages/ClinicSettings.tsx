import React from 'react';
import { ClinicSettingsForm } from '../components/forms/ClinicSettingsForm';

export const ClinicSettings: React.FC = () => {
  return (
    <div className="space-y-6">
       <div>
            <h1 className="text-2xl font-bold text-gray-900">Clinic Settings</h1>
            <p className="text-sm text-gray-500">Configure global application settings and preferences.</p>
       </div>
       <ClinicSettingsForm />
    </div>
  );
};
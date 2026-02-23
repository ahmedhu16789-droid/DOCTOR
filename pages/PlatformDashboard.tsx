import React, { useEffect, useState } from 'react';
import { getPlatformClinicsFromApi, updatePlatformClinicStatusViaApi, PlatformClinic } from '../services/api';

export const PlatformDashboard: React.FC = () => {
  const [clinics, setClinics] = useState<PlatformClinic[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingClinicId, setSavingClinicId] = useState<string | null>(null);

  const loadClinics = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getPlatformClinicsFromApi();
      setClinics(data);
    } catch (err) {
      console.error(err);
      setError('Failed to load clinics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadClinics();
  }, []);

  const onStatusChange = async (clinicId: string, status: string) => {
    try {
      setSavingClinicId(clinicId);
      const updated = await updatePlatformClinicStatusViaApi(clinicId, status);
      setClinics((prev) => prev.map((clinic) => (clinic.id === clinicId ? updated : clinic)));
    } catch (err) {
      console.error(err);
      setError('Failed to update clinic status');
    } finally {
      setSavingClinicId(null);
    }
  };

  if (loading) {
    return <div className="p-6">Loading platform clinics...</div>;
  }

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-bold">Platform Dashboard</h1>
      {error && <p className="text-red-600 text-sm">{error}</p>}

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left">
            <tr>
              <th className="px-4 py-3">Clinic</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Created</th>
            </tr>
          </thead>
          <tbody>
            {clinics.map((clinic) => (
              <tr key={clinic.id} className="border-t border-gray-100">
                <td className="px-4 py-3">{clinic.name}</td>
                <td className="px-4 py-3">
                  <select
                    className="border border-gray-300 rounded-md px-2 py-1"
                    value={clinic.subscriptionStatus}
                    disabled={savingClinicId === clinic.id}
                    onChange={(event) => onStatusChange(clinic.id, event.target.value)}
                  >
                    <option value="trial">trial</option>
                    <option value="active">active</option>
                    <option value="suspended">suspended</option>
                    <option value="cancelled">cancelled</option>
                  </select>
                </td>
                <td className="px-4 py-3">{clinic.createdAt ? new Date(clinic.createdAt).toLocaleDateString() : '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

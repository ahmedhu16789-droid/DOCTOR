import React, { useMemo, useState } from 'react';
import { Activity, CalendarDays, Clock3, Search, Stethoscope, UserRoundSearch, Users } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Appointment, AppointmentStatus, Patient } from '../types';

interface PatientsRecordsProps {
  patients: Patient[];
  appointments: Appointment[];
  selectedPatientId: string | null;
  onSelectPatient: (patientId: string) => void;
}

export function PatientsRecords({
  patients,
  appointments,
  selectedPatientId,
  onSelectPatient,
}: PatientsRecordsProps) {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');

  const filteredPatients = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    if (!normalizedQuery) {
      return patients;
    }

    return patients.filter((patient) =>
      patient.name.toLowerCase().includes(normalizedQuery)
      || patient.phone.toLowerCase().includes(normalizedQuery),
    );
  }, [patients, query]);

  const selectedPatient = useMemo(
    () => patients.find((patient) => patient.id === selectedPatientId) ?? null,
    [patients, selectedPatientId],
  );

  const selectedPatientVisits = useMemo(
    () => appointments
      .filter((appointment) => appointment.patientId === selectedPatientId)
      .sort((a, b) => new Date(`${b.date}T${b.timeSlot}`).getTime() - new Date(`${a.date}T${a.timeSlot}`).getTime()),
    [appointments, selectedPatientId],
  );

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex flex-wrap justify-between items-center gap-3">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-primary-600" />
            <h2 className="text-lg font-bold">{t('patient_records')}</h2>
          </div>
          <div className="relative w-full md:w-72">
            <Search className="w-4 h-4 text-gray-400 absolute top-1/2 -translate-y-1/2 start-3" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="w-full rounded-lg border border-gray-200 px-9 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-200"
              placeholder={t('search_placeholder') || 'ابحث بالاسم أو رقم الهاتف'}
            />
          </div>
        </div>

        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-start text-xs font-medium text-gray-500 uppercase tracking-wider">{t('name')}</th>
              <th className="px-6 py-3 text-start text-xs font-medium text-gray-500 uppercase tracking-wider">{t('contact')}</th>
              <th className="px-6 py-3 text-start text-xs font-medium text-gray-500 uppercase tracking-wider">{t('last_visit')}</th>
              <th className="px-6 py-3 text-start text-xs font-medium text-gray-500 uppercase tracking-wider">{t('history')}</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredPatients.map((patient) => (
              <tr
                key={patient.id}
                onClick={() => onSelectPatient(patient.id)}
                className={`cursor-pointer transition-colors ${selectedPatientId === patient.id ? 'bg-primary-50' : 'hover:bg-gray-50'}`}
              >
                <td className="px-6 py-4 text-sm font-medium text-gray-900">{patient.name}</td>
                <td className="px-6 py-4 text-sm text-gray-700">{patient.phone}</td>
                <td className="px-6 py-4 text-sm text-gray-700">{patient.lastVisit || '-'}</td>
                <td className="px-6 py-4 text-sm text-gray-500 truncate max-w-xs">{patient.medicalHistorySummary}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selectedPatient ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
            <div>
              <h3 className="text-xl font-bold text-gray-900">{selectedPatient.name}</h3>
              <p className="text-sm text-gray-500 mt-1">{selectedPatient.phone}</p>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 w-full md:w-auto">
              <div className="rounded-lg border border-gray-200 px-4 py-3">
                <p className="text-xs text-gray-500 mb-1">{t('total_visits')}</p>
                <p className="text-lg font-bold text-gray-900">{selectedPatientVisits.length}</p>
              </div>
              <div className="rounded-lg border border-gray-200 px-4 py-3">
                <p className="text-xs text-gray-500 mb-1">{t('completed_visits')}</p>
                <p className="text-lg font-bold text-emerald-600">{selectedPatientVisits.filter((visit) => visit.status === AppointmentStatus.COMPLETED).length}</p>
              </div>
              <div className="rounded-lg border border-gray-200 px-4 py-3">
                <p className="text-xs text-gray-500 mb-1">{t('upcoming_visits')}</p>
                <p className="text-lg font-bold text-blue-600">{selectedPatientVisits.filter((visit) => [AppointmentStatus.SCHEDULED, AppointmentStatus.WAITING, AppointmentStatus.CALLED, AppointmentStatus.IN_PROGRESS].includes(visit.status)).length}</p>
              </div>
              <div className="rounded-lg border border-gray-200 px-4 py-3">
                <p className="text-xs text-gray-500 mb-1">{t('last_visit')}</p>
                <p className="text-lg font-bold text-gray-900">{selectedPatient.lastVisit || '-'}</p>
              </div>
            </div>
          </div>

          {selectedPatientVisits.length > 0 ? (
            <div className="space-y-3">
              {selectedPatientVisits.map((visit) => (
                <div key={visit.id} className="rounded-xl border border-gray-200 p-4">
                  <div className="flex flex-wrap justify-between gap-3">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-gray-900 font-semibold">
                        <Stethoscope className="w-4 h-4 text-primary-600" />
                        <span>{visit.doctorName}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <CalendarDays className="w-4 h-4" />
                        <span>{visit.date}</span>
                        <Clock3 className="w-4 h-4 ms-2" />
                        <span>{visit.timeSlot}</span>
                      </div>
                    </div>
                    <div className="text-sm">
                      <div className="inline-flex items-center gap-2 rounded-full bg-gray-100 px-3 py-1 font-medium text-gray-700">
                        <Activity className="w-4 h-4" />
                        {visit.status}
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-2 text-sm">
                    <div className="rounded-md bg-gray-50 px-3 py-2">
                      <span className="text-gray-500">{t('department')}:</span>
                      <span className="font-medium text-gray-900 ms-2">{visit.department}</span>
                    </div>
                    <div className="rounded-md bg-gray-50 px-3 py-2">
                      <span className="text-gray-500">{t('appointment_type')}:</span>
                      <span className="font-medium text-gray-900 ms-2">{visit.type}</span>
                    </div>
                    <div className="rounded-md bg-gray-50 px-3 py-2">
                      <span className="text-gray-500">{t('payment_status')}:</span>
                      <span className="font-medium text-gray-900 ms-2">{visit.billing.status}</span>
                    </div>
                  </div>
                  {visit.notes && (
                    <p className="mt-3 text-sm text-gray-600">
                      <span className="font-semibold text-gray-800">{t('clinical_notes')}:</span> {visit.notes}
                    </p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-gray-300 p-8 text-center text-gray-500">
              <UserRoundSearch className="w-8 h-8 mx-auto mb-3 text-gray-400" />
              {t('no_visits_for_patient')}
            </div>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center text-gray-500">
          <UserRoundSearch className="w-8 h-8 mx-auto mb-3 text-gray-400" />
          {t('select_patient_to_view_visits')}
        </div>
      )}
    </div>
  );
}

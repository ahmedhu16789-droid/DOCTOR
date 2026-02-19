import React, { useEffect, useMemo, useState, useRef } from 'react';
import { Activity, CalendarDays, CheckCircle2, CircleDot, Clock3, Search, Stethoscope, UserRoundSearch, Users, X, XCircle, ChevronLeft } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { getMedicalEncounterFromApi, MedicalEncounterWithHistory } from '../services/api';
import { Appointment, AppointmentStatus, Patient, PaymentStatus } from '../types';
import { formatTimeTo12Hour } from '../utils/time';

interface PatientsRecordsProps {
  patients: Patient[];
  appointments: Appointment[];
  selectedPatientId: string | null;
  onSelectPatient: (patientId: string | null) => void;
}

const dateTimeValue = (appointment: Appointment) => new Date(`${appointment.date}T${appointment.timeSlot}`).getTime();

const VISIT_PROGRESS_STEPS: AppointmentStatus[] = [
  AppointmentStatus.SCHEDULED,
  AppointmentStatus.WAITING,
  AppointmentStatus.CALLED,
  AppointmentStatus.IN_PROGRESS,
  AppointmentStatus.COMPLETED,
];

function getStatusColor(status: AppointmentStatus) {
  switch (status) {
    case AppointmentStatus.COMPLETED:
      return 'text-emerald-700 bg-emerald-50 border-emerald-200';
    case AppointmentStatus.IN_PROGRESS:
      return 'text-indigo-700 bg-indigo-50 border-indigo-200';
    case AppointmentStatus.CALLED:
      return 'text-violet-700 bg-violet-50 border-violet-200';
    case AppointmentStatus.WAITING:
      return 'text-amber-700 bg-amber-50 border-amber-200';
    case AppointmentStatus.CANCELLED:
    case AppointmentStatus.NO_SHOW:
      return 'text-rose-700 bg-rose-50 border-rose-200';
    default:
      return 'text-slate-700 bg-slate-50 border-slate-200';
  }
}

function getPaymentStatusColor(status: PaymentStatus) {
  switch (status) {
    case PaymentStatus.PAID:
      return 'text-emerald-700 bg-emerald-50 border-emerald-200';
    case PaymentStatus.PARTIAL:
      return 'text-amber-700 bg-amber-50 border-amber-200';
    case PaymentStatus.REFUNDED:
      return 'text-rose-700 bg-rose-50 border-rose-200';
    default:
      return 'text-slate-700 bg-slate-50 border-slate-200';
  }
}

export function PatientsRecords({
  patients,
  appointments,
  selectedPatientId,
  onSelectPatient,
}: PatientsRecordsProps) {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const [visitEncounters, setVisitEncounters] = useState<Record<string, MedicalEncounterWithHistory['data']>>({});
  const detailsRef = useRef<HTMLDivElement | null>(null);

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
      .sort((a, b) => dateTimeValue(b) - dateTimeValue(a)),
    [appointments, selectedPatientId],
  );

  const paidAmountTotal = useMemo(
    () => selectedPatientVisits.reduce((sum, visit) => sum + visit.billing.paidAmount, 0),
    [selectedPatientVisits],
  );

  const dueAmountTotal = useMemo(
    () => selectedPatientVisits.reduce((sum, visit) => sum + Math.max(visit.billing.total - visit.billing.paidAmount, 0), 0),
    [selectedPatientVisits],
  );

  useEffect(() => {
    let active = true;

    if (selectedPatientVisits.length === 0) {
      setVisitEncounters({});
      return () => {
        active = false;
      };
    }

    const loadVisitsEncounters = async () => {
      const loaded = await Promise.allSettled(
        selectedPatientVisits.map(async (visit) => {
          const encounterPayload = await getMedicalEncounterFromApi(visit.id);
          return [visit.id, encounterPayload.data] as const;
        }),
      );

      if (!active) {
        return;
      }

      const nextMap: Record<string, MedicalEncounterWithHistory['data']> = {};
      loaded.forEach((result) => {
        if (result.status === 'fulfilled') {
          const [appointmentId, encounter] = result.value;
          nextMap[appointmentId] = encounter;
        }
      });

      setVisitEncounters(nextMap);
    };

    void loadVisitsEncounters();

    return () => {
      active = false;
    };
  }, [selectedPatientVisits]);

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
              placeholder={t('search_placeholder')}
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
              <th className="px-6 py-3 text-end text-xs font-medium text-gray-500 uppercase tracking-wider">{t('actions')}</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredPatients.map((patient) => (
              <tr
                key={patient.id}
                onClick={() => onSelectPatient(patient.id)}
                className={`cursor-pointer transition-colors ${selectedPatientId === patient.id ? 'bg-primary-50 ring-1 ring-primary-100' : 'hover:bg-gray-50'}`}
              >
                <td className="px-6 py-4 text-sm font-medium text-gray-900">{patient.name}</td>
                <td className="px-6 py-4 text-sm text-gray-700">{patient.phone}</td>
                <td className="px-6 py-4 text-sm text-gray-700">{patient.lastVisit || '-'}</td>
                <td className="px-6 py-4 text-sm text-gray-500 truncate max-w-xs">{patient.medicalHistorySummary}</td>
                <td className="px-6 py-4 text-sm text-end">
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      onSelectPatient(patient.id);
                    }}
                    className="inline-flex items-center gap-1 rounded-md border border-primary-200 bg-primary-50 px-3 py-1.5 text-xs font-semibold text-primary-700 hover:bg-primary-100"
                  >
                    {t('view_all')}
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center text-gray-500">
        <UserRoundSearch className="w-8 h-8 mx-auto mb-3 text-gray-400" />
        {t('select_patient_to_view_visits')}
      </div>

      {selectedPatient && (
        <div
          className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[1px] flex items-center justify-center p-4"
          onClick={() => onSelectPatient(null)}
          role="presentation"
        >
          <div
            className="bg-white rounded-xl shadow-xl border border-gray-200 w-full max-w-5xl max-h-[90vh] overflow-y-auto p-6"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label={t('patient_records')}
          >
            <div className="flex items-start justify-between gap-4 mb-6">
              <div>
                <h3 className="text-xl font-bold text-gray-900">{selectedPatient.name}</h3>
                <p className="text-sm text-gray-500 mt-1">{selectedPatient.phone}</p>
              </div>
              <button
                type="button"
                onClick={() => onSelectPatient(null)}
                className="inline-flex items-center justify-center rounded-md border border-gray-200 p-2 text-gray-500 hover:bg-gray-50"
                aria-label={t('close')}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-6 gap-3 w-full mb-6">
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
              <div className="rounded-lg border border-gray-200 px-4 py-3">
                <p className="text-xs text-gray-500 mb-1">{t('paid_total')}</p>
                <p className="text-lg font-bold text-emerald-700">{paidAmountTotal.toFixed(2)}</p>
              </div>
              <div className="rounded-lg border border-gray-200 px-4 py-3">
                <p className="text-xs text-gray-500 mb-1">{t('due_total')}</p>
                <p className="text-lg font-bold text-rose-700">{dueAmountTotal.toFixed(2)}</p>
              </div>
            </div>

            {selectedPatientVisits.length > 0 ? (
              <div className="space-y-3">
                {selectedPatientVisits.map((visit) => {
                  const stepIndex = VISIT_PROGRESS_STEPS.indexOf(visit.status);
                  const encounter = visitEncounters[visit.id];
                  const bloodPressure = encounter?.vitals?.bpSystolic && encounter?.vitals?.bpDiastolic
                    ? `${encounter.vitals.bpSystolic}/${encounter.vitals.bpDiastolic}`
                    : '-';

                  return (
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
                            <span>{formatTimeTo12Hour(visit.timeSlot)}</span>
                          </div>
                        </div>
                        <div className="text-sm flex items-center gap-2">
                          <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 font-medium ${getStatusColor(visit.status)}`}>
                            <Activity className="w-4 h-4" />
                            {t(visit.status)}
                          </div>
                          <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 font-medium ${getPaymentStatusColor(visit.billing.status)}`}>
                            <CircleDot className="w-4 h-4" />
                            {t(visit.billing.status)}
                          </div>
                        </div>
                      </div>

                      {!([AppointmentStatus.CANCELLED, AppointmentStatus.NO_SHOW].includes(visit.status)) && (
                        <div className="mt-4 rounded-lg border border-gray-100 p-3">
                          <p className="text-xs text-gray-500 mb-2">{t('visit_progress')}</p>
                          <div className="flex flex-wrap gap-2">
                            {VISIT_PROGRESS_STEPS.map((step, index) => {
                              const isDone = stepIndex >= index;

                              return (
                                <span
                                  key={step}
                                  className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium ${isDone ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-gray-50 border-gray-200 text-gray-500'}`}
                                >
                                  {isDone ? <CheckCircle2 className="w-3 h-3" /> : <Clock3 className="w-3 h-3" />}
                                  {t(step)}
                                </span>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {[AppointmentStatus.CANCELLED, AppointmentStatus.NO_SHOW].includes(visit.status) && (
                        <div className="mt-4 rounded-lg border border-rose-100 bg-rose-50 px-3 py-2 text-rose-700 inline-flex items-center gap-2 text-sm font-medium">
                          <XCircle className="w-4 h-4" />
                          {t('visit_closed_without_completion')}
                        </div>
                      )}

                      <div className="mt-3 grid grid-cols-1 md:grid-cols-4 gap-2 text-sm">
                        <div className="rounded-md bg-gray-50 px-3 py-2">
                          <span className="text-gray-500">{t('department')}:</span>
                          <span className="font-medium text-gray-900 ms-2">{visit.department}</span>
                        </div>
                        <div className="rounded-md bg-gray-50 px-3 py-2">
                          <span className="text-gray-500">{t('appointment_type')}:</span>
                          <span className="font-medium text-gray-900 ms-2">{visit.type}</span>
                        </div>
                        <div className="rounded-md bg-gray-50 px-3 py-2">
                          <span className="text-gray-500">{t('invoice_total')}:</span>
                          <span className="font-medium text-gray-900 ms-2">{visit.billing.total.toFixed(2)}</span>
                        </div>
                        <div className="rounded-md bg-gray-50 px-3 py-2">
                          <span className="text-gray-500">{t('payment_status')}:</span>
                          <span className="font-medium text-gray-900 ms-2">{t(visit.billing.status)}</span>
                        </div>
                      </div>

                      <div className="mt-3 rounded-lg border border-gray-100 p-3 space-y-3">
                        <div>
                          <p className="text-xs text-gray-500 mb-1">{t('diagnosis')}</p>
                          <p className="text-sm text-gray-900 font-medium">{encounter?.diagnosis || '-'}</p>
                        </div>

                        <div>
                          <p className="text-xs text-gray-500 mb-2">{t('vitals_title')}</p>
                          <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-sm">
                            <div className="rounded-md bg-gray-50 px-3 py-2">
                              <span className="text-gray-500">{t('blood_pressure')}:</span>
                              <span className="font-medium text-gray-900 ms-2">{bloodPressure}</span>
                            </div>
                            <div className="rounded-md bg-gray-50 px-3 py-2">
                              <span className="text-gray-500">{t('heart_rate')}:</span>
                              <span className="font-medium text-gray-900 ms-2">{encounter?.vitals?.heartRate ?? '-'}</span>
                            </div>
                            <div className="rounded-md bg-gray-50 px-3 py-2">
                              <span className="text-gray-500">{t('temp')}:</span>
                              <span className="font-medium text-gray-900 ms-2">{encounter?.vitals?.temperature ?? '-'}</span>
                            </div>
                            <div className="rounded-md bg-gray-50 px-3 py-2">
                              <span className="text-gray-500">{t('oxygen')}:</span>
                              <span className="font-medium text-gray-900 ms-2">{encounter?.vitals?.oxygenSat ?? '-'}</span>
                            </div>
                            <div className="rounded-md bg-gray-50 px-3 py-2">
                              <span className="text-gray-500">{t('weight')}:</span>
                              <span className="font-medium text-gray-900 ms-2">{encounter?.vitals?.weight ?? '-'}</span>
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div>
                            <p className="text-xs text-gray-500 mb-2">{t('tab_rx')}</p>
                            {encounter?.prescription && encounter.prescription.length > 0 ? (
                              <ul className="space-y-1 text-sm text-gray-700 list-disc ps-5">
                                {encounter.prescription.map((med) => (
                                  <li key={med.id}>
                                    <span className="font-medium text-gray-900">{med.name}</span>
                                    <span className="text-gray-600"> — {[med.dosage, med.frequency, med.duration].filter(Boolean).join(' • ')}</span>
                                  </li>
                                ))}
                              </ul>
                            ) : (
                              <p className="text-sm text-gray-500">{t('no_meds')}</p>
                            )}
                          </div>

                          <div>
                            <p className="text-xs text-gray-500 mb-2">{t('services_used')}</p>
                            {visit.billing.items.length > 0 ? (
                              <ul className="space-y-1 text-sm text-gray-700">
                                {visit.billing.items.map((item) => (
                                  <li key={item.id} className="flex items-center justify-between gap-2 rounded-md bg-gray-50 px-3 py-2">
                                    <span>{item.name}</span>
                                    <span className="font-medium text-gray-900">{item.quantity} × {item.unitPrice.toFixed(2)}</span>
                                  </li>
                                ))}
                              </ul>
                            ) : (
                              <p className="text-sm text-gray-500">-</p>
                            )}
                          </div>
                        </div>
                      </div>

                      {visit.notes && (
                        <p className="mt-3 text-sm text-gray-600">
                          <span className="font-semibold text-gray-800">{t('clinical_notes')}:</span> {visit.notes}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-gray-300 p-8 text-center text-gray-500">
                <UserRoundSearch className="w-8 h-8 mx-auto mb-3 text-gray-400" />
                {t('no_visits_for_patient')}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

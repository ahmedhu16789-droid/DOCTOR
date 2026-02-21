import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, Clock3 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { getDoctorsFromApi, shiftAppointmentsViaApi } from '../services/api';
import { sendWhatsAppQueue, WhatsAppMessage } from '../utils/whatsapp';
import { Select } from '../components/common/Select';
import { Branch, User, UserRole } from '../types';

interface AppointmentMigrationProps {
  currentUser: User;
  activeBranchId: string;
  branches: Branch[];
  onShiftApplied?: () => Promise<void> | void;
}

const SHIFT_MINUTES_OPTIONS = [15, 30, 45, 60, 90, 120, 180];

export const AppointmentMigration: React.FC<AppointmentMigrationProps> = ({
  currentUser,
  activeBranchId,
  branches,
  onShiftApplied,
}) => {
  const { t } = useTranslation();
  const [doctors, setDoctors] = useState<User[]>([]);
  const [doctorId, setDoctorId] = useState<string>('');
  const [branchId, setBranchId] = useState<string>(activeBranchId);
  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [fromTime, setFromTime] = useState<string>('08:00');
  const [shiftMinutes, setShiftMinutes] = useState<number>(60);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canAccess = [UserRole.ADMIN, UserRole.RECEPTIONIST, UserRole.DOCTOR].includes(currentUser.role);

  const doctorsQuery = useMemo(() => {
    if (currentUser.role === UserRole.ADMIN) {
      return {};
    }

    return activeBranchId ? { branchId: activeBranchId } : {};
  }, [activeBranchId, currentUser.role]);

  useEffect(() => {
    if (!canAccess) return;

    getDoctorsFromApi(doctorsQuery)
      .then((payload) => {
        let filtered = payload;

        if (currentUser.role === UserRole.DOCTOR) {
          filtered = payload.filter((doctor) => doctor.id === currentUser.id);
        }

        setDoctors(filtered);

        setDoctorId((current) => {
          if (currentUser.role === UserRole.DOCTOR) {
            return currentUser.id;
          }

          if (current && filtered.some((doctor) => doctor.id === current)) {
            return current;
          }

          return filtered[0]?.id ?? '';
        });
      })
      .catch(() => {
        setDoctors([]);
        setDoctorId('');
      });
  }, [canAccess, currentUser.id, currentUser.role, doctorsQuery]);

  useEffect(() => {
    if (!doctors.length) {
      setBranchId(activeBranchId);
      return;
    }

    const selectedDoctor = doctors.find((doctor) => doctor.id === doctorId);
    const selectedDoctorBranches = selectedDoctor?.assignedBranches ?? [];

    if (currentUser.role === UserRole.ADMIN) {
      if (branchId && selectedDoctorBranches.includes(branchId)) return;
      setBranchId(selectedDoctorBranches[0] ?? '');
      return;
    }

    setBranchId(activeBranchId);
  }, [activeBranchId, branchId, currentUser.role, doctorId, doctors]);

  const branchOptions = useMemo(() => {
    const selectedDoctor = doctors.find((doctor) => doctor.id === doctorId);
    const allowedIds = new Set(selectedDoctor?.assignedBranches ?? []);

    if (currentUser.role === UserRole.ADMIN) {
      return branches.filter((branch) => allowedIds.has(branch.id));
    }

    return branches.filter((branch) => branch.id === activeBranchId);
  }, [activeBranchId, branches, currentUser.role, doctorId, doctors]);

  if (!canAccess) {
    return null;
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!doctorId || !branchId) {
      setError(t('migration_validation'));
      return;
    }

    try {
      setIsSubmitting(true);
      setFeedback(null);
      setError(null);

      const result = await shiftAppointmentsViaApi({
        doctorId,
        branchId,
        date,
        fromTime,
        shiftMinutes,
      });

      if (result.shiftedData && result.shiftedData.length > 0) {
        const doctorName = doctors.find((d) => d.id === doctorId)?.name ?? '';
        const whatsappQueue: WhatsAppMessage[] = result.shiftedData
          .filter((d) => d.patientPhone)
          .map((d) => {
            const drText = doctorName ? ` مع د. ${doctorName}` : '';
            return {
              phone: d.patientPhone!,
              text: `مرحباً، تم تعديل موعدك${drText} ليكون الساعة ${d.afterTime} بدلاً من ${d.beforeTime}. شكراً لتفهمكم ونتمنى لكم دوام الصحة والعافية.`,
            };
          });

        if (whatsappQueue.length > 0) {
          sendWhatsAppQueue(whatsappQueue);
        }
      }

      setFeedback(t('migration_success', { count: result.shiftedAppointments }));
      await onShiftApplied?.();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : t('migration_error'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
      <div className="flex items-center gap-2 mb-5">
        <Clock3 className="w-5 h-5 text-primary-600" />
        <h2 className="text-xl font-bold text-gray-900">{t('appointment_migration')}</h2>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{t('doctor')}</label>
            <Select
              value={doctorId}
              onChange={(val) => setDoctorId(val)}
              disabled={currentUser.role === UserRole.DOCTOR}
              options={doctors.map((doctor) => ({ value: doctor.id, label: doctor.name }))}
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{t('branches')}</label>
            <Select
              value={branchId}
              onChange={(val) => setBranchId(val)}
              disabled={currentUser.role !== UserRole.ADMIN}
              options={branchOptions.map((branch) => ({ value: branch.id, label: branch.name }))}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{t('date')}</label>
            <input
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{t('migration_from_time')}</label>
            <input
              type="time"
              value={fromTime}
              onChange={(event) => setFromTime(event.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{t('migration_duration')}</label>
            <Select
              value={shiftMinutes}
              onChange={(val) => setShiftMinutes(Number(val))}
              options={SHIFT_MINUTES_OPTIONS.map((minutes) => ({
                value: minutes,
                label: t('migration_minutes', { count: minutes })
              }))}
            />
          </div>
        </div>

        {feedback && <p className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md px-3 py-2">{feedback}</p>}
        {
          error && (
            <p className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-md px-3 py-2 flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              <span>{error}</span>
            </p>
          )
        }

        <button
          type="submit"
          disabled={isSubmitting || !doctorId || !branchId}
          className="bg-primary-600 text-white rounded-md px-4 py-2 text-sm font-semibold hover:bg-primary-700 disabled:opacity-60"
        >
          {isSubmitting ? t('migration_loading') : t('migration_submit')}
        </button>
      </form >
    </div >
  );
};

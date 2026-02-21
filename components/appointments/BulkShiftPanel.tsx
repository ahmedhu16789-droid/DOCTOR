import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, Clock3 } from 'lucide-react';
import { getDoctorsFromApi, shiftAppointmentsViaApi } from '../../services/api';
import { User, UserRole } from '../../types';

interface BulkShiftPanelProps {
  activeBranchId: string;
  currentUser: User;
  onShiftApplied?: () => Promise<void> | void;
}

const SHIFT_MINUTES_OPTIONS = [15, 30, 45, 60, 90, 120, 180];

export const BulkShiftPanel: React.FC<BulkShiftPanelProps> = ({ activeBranchId, currentUser, onShiftApplied }) => {
  const [doctorOptions, setDoctorOptions] = useState<User[]>([]);
  const [doctorId, setDoctorId] = useState<string>('');
  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [fromTime, setFromTime] = useState<string>('08:00');
  const [shiftMinutes, setShiftMinutes] = useState<number>(60);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!activeBranchId) {
      setDoctorOptions([]);
      setDoctorId('');
      return;
    }

    getDoctorsFromApi({ branchId: activeBranchId })
      .then((payload) => {
        setDoctorOptions(payload);
        setDoctorId((currentDoctorId) => {
          if (currentUser.role === UserRole.DOCTOR) {
            return currentUser.id;
          }

          if (currentDoctorId && payload.some((doctor) => doctor.id === currentDoctorId)) {
            return currentDoctorId;
          }

          return payload[0]?.id ?? '';
        });
      })
      .catch(() => {
        setDoctorOptions([]);
        setDoctorId('');
      });
  }, [activeBranchId, currentUser.id, currentUser.role]);

  const canShiftAppointments = useMemo(() => {
    return [UserRole.ADMIN, UserRole.DOCTOR, UserRole.RECEPTIONIST].includes(currentUser.role);
  }, [currentUser.role]);

  if (!canShiftAppointments) {
    return null;
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!doctorId || !activeBranchId) {
      setError('اختر الفرع والطبيب أولاً.');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);
      setFeedback(null);

      const result = await shiftAppointmentsViaApi({
        doctorId,
        branchId: activeBranchId,
        date,
        fromTime,
        shiftMinutes,
      });

      setFeedback(`تم ترحيل ${result.shiftedAppointments} موعد بنجاح.`);
      await onShiftApplied?.();
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : 'تعذر تنفيذ الترحيل حالياً.';
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
      <div className="flex items-center gap-2 mb-4">
        <Clock3 className="w-5 h-5 text-primary-600" />
        <h3 className="font-bold text-gray-900">ترحيل مواعيد طبيب</h3>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className="block text-xs font-bold text-gray-500 uppercase mb-1">الطبيب</label>
          <select
            value={doctorId}
            onChange={(event) => setDoctorId(event.target.value)}
            disabled={currentUser.role === UserRole.DOCTOR}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm bg-white"
          >
            {doctorOptions.map((doctor) => (
              <option key={doctor.id} value={doctor.id}>{doctor.name}</option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">التاريخ</label>
            <input
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">من الساعة</label>
            <input
              type="time"
              value={fromTime}
              onChange={(event) => setFromTime(event.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-gray-500 uppercase mb-1">مدة الترحيل</label>
          <select
            value={shiftMinutes}
            onChange={(event) => setShiftMinutes(Number(event.target.value))}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm bg-white"
          >
            {SHIFT_MINUTES_OPTIONS.map((minutes) => (
              <option key={minutes} value={minutes}>{minutes} دقيقة</option>
            ))}
          </select>
        </div>

        {feedback && <p className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md px-3 py-2">{feedback}</p>}
        {error && (
          <p className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-md px-3 py-2 flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            <span>{error}</span>
          </p>
        )}

        <button
          type="submit"
          disabled={isSubmitting || !doctorId || !activeBranchId}
          className="w-full bg-primary-600 text-white rounded-md px-3 py-2 text-sm font-semibold hover:bg-primary-700 disabled:opacity-60"
        >
          {isSubmitting ? 'جاري الترحيل...' : 'تنفيذ الترحيل'}
        </button>
      </form>
    </div>
  );
};

import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, Clock3, ChevronDown, ChevronUp } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Select } from '../common/Select';
import { repositories } from '../../services/repositories';
import { sendWhatsAppQueue, WhatsAppMessage } from '../../utils/whatsapp';
import { User, UserRole } from '../../types';

interface BulkShiftPanelProps {
  activeBranchId: string;
  currentUser: User;
  onShiftApplied?: () => Promise<void> | void;
}

const SHIFT_MINUTES_OPTIONS = [15, 30, 45, 60, 90, 120, 180];

export const BulkShiftPanel: React.FC<BulkShiftPanelProps> = ({ activeBranchId, currentUser, onShiftApplied }) => {
  const { t } = useTranslation();
  const [doctorOptions, setDoctorOptions] = useState<User[]>([]);
  const [doctorId, setDoctorId] = useState<string>('');
  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [fromTime, setFromTime] = useState<string>('08:00');
  const [shiftMinutes, setShiftMinutes] = useState<number>(60);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [delayInsight, setDelayInsight] = useState<any | null>(null);

  useEffect(() => {
    if (!activeBranchId) {
      setDoctorOptions([]);
      setDoctorId('');
      return;
    }

    repositories.doctors.getDoctors({ branchId: activeBranchId })
      .then((payload) => {
        setDoctorOptions(payload);
        setDoctorId((currentDoctorId) => {
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
  }, [activeBranchId]);

  const canShiftAppointments = useMemo(() => {
    return [UserRole.ADMIN, UserRole.BRANCH_MANAGER, UserRole.RECEPTIONIST].includes(currentUser.role);
  }, [currentUser.role]);

  useEffect(() => {
    if (!doctorId || !activeBranchId || !canShiftAppointments) {
      setDelayInsight(null);
      return;
    }

    repositories.appointments.getDelayInsight({
      doctorId,
      branchId: activeBranchId,
      date,
    })
      .then((insight) => {
        setDelayInsight(insight);

        if (insight.showAlert) {
          setFromTime(insight.fromTime ?? fromTime);
          setShiftMinutes(insight.suggestedShiftMinutes || shiftMinutes);
        }
      })
      .catch(() => setDelayInsight(null));
  }, [doctorId, activeBranchId, date, canShiftAppointments]);

  if (!canShiftAppointments) {
    return null;
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!doctorId || !activeBranchId) {
      setError(t('migration_validation'));
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);
      setFeedback(null);

      const result = await repositories.appointments.shiftAppointments({
        doctorId,
        branchId: activeBranchId,
        date,
        fromTime,
        shiftMinutes,
      });

      if (result.shiftedData && result.shiftedData.length > 0) {
        const doctorName = doctorOptions.find((d) => d.id === doctorId)?.name ?? '';
        const whatsappQueue: WhatsAppMessage[] = result.shiftedData
          .filter((d: any) => d.patientPhone)
          .map((d: any) => {
            const drText = doctorName ? ` مع د. ${doctorName}` : '';
            return {
              phone: d.patientPhone,
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
      const message = submitError instanceof Error ? submitError.message : t('migration_error');
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };


  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between mb-2 group"
      >
        <div className="flex items-center gap-2">
          <Clock3 className="w-5 h-5 text-primary-600" />
          <h3 className="font-bold text-gray-900 group-hover:text-primary-600 transition-colors">{t('appointment_migration')}</h3>
        </div>
        {isExpanded ? (
          <ChevronUp className="w-4 h-4 text-gray-400 group-hover:text-primary-600 transition-colors" />
        ) : (
          <ChevronDown className="w-4 h-4 text-gray-400 group-hover:text-primary-600 transition-colors" />
        )}
      </button>

      {isExpanded && (
        <form onSubmit={handleSubmit} className="space-y-3 pt-2">
          {delayInsight?.showAlert && (
            <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              <div className="flex items-center gap-2 font-semibold"><AlertCircle className="w-4 h-4" /> {t('delay_detection_alert_title')}</div>
              <div>{t('delay_detection_alert_body', { delay: delayInsight.delayMinutes, count: delayInsight.impactedCount, shift: delayInsight.suggestedShiftMinutes })}</div>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{t('doctor')}</label>
            <Select
              value={doctorId}
              onChange={(val) => setDoctorId(val)}
              options={doctorOptions.map((doctor) => ({ value: doctor.id, label: doctor.name }))}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
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
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{t('migration_duration')}</label>
            <Select
              value={shiftMinutes.toString()}
              onChange={(val) => setShiftMinutes(Number(val))}
              options={SHIFT_MINUTES_OPTIONS.map((minutes) => ({ value: minutes.toString(), label: t('migration_minutes', { count: minutes }) }))}
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-md bg-primary-600 px-3 py-2 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-70"
          >
            {isSubmitting ? t('migration_loading') : t('migration_submit')}
          </button>

          {feedback && <p className="text-sm text-green-600 font-medium">{feedback}</p>}
          {error && <p className="text-sm text-red-600 font-medium">{error}</p>}
        </form>
      )}
    </div>
  );
};

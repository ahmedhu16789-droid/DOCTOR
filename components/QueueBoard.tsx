import React from 'react';
import { Appointment, AppointmentStatus } from '../types';
import { Clock, CheckCircle, PlayCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { formatTimeTo12Hour } from '../utils/time';

interface QueueBoardProps {
  appointments: Appointment[];
  onStatusChange: (id: string, status: AppointmentStatus) => void;
}

const getMetricLabel = (appointment: Appointment, t: (key: string, options?: Record<string, unknown>) => string): string | null => {
  if (appointment.status === AppointmentStatus.CANCELLED || appointment.status === AppointmentStatus.NO_SHOW) {
    return null;
  }

  if (appointment.status === AppointmentStatus.IN_PROGRESS && appointment.queueMetrics?.serviceMinutes != null) {
    return t('queue_board.service_time', { minutes: appointment.queueMetrics.serviceMinutes });
  }

  if ((appointment.status === AppointmentStatus.WAITING || appointment.status === AppointmentStatus.SCHEDULED || appointment.status === AppointmentStatus.CALLED)
    && appointment.queueMetrics?.waitingMinutes != null) {
    return t('queue_board.waiting_time', { minutes: appointment.queueMetrics.waitingMinutes });
  }

  if (appointment.queueMetrics?.delayMinutes != null && appointment.queueMetrics.delayMinutes > 0) {
    return t('queue_board.delay_time', { minutes: appointment.queueMetrics.delayMinutes });
  }

  return null;
};

const getEstimatedWaitingMinutesByAppointment = (appointments: Appointment[]): Map<string, number> => {
  const consultDurations = appointments
    .map(appointment => appointment.queueMetrics?.serviceMinutes)
    .filter((minutes): minutes is number => minutes != null && minutes > 0);

  if (consultDurations.length === 0) {
    return new Map();
  }

  const averageConsultDuration = consultDurations.reduce((sum, minutes) => sum + minutes, 0) / consultDurations.length;
  const inProgressCount = appointments.filter(appointment => appointment.status === AppointmentStatus.IN_PROGRESS).length;
  const waitingQueue = appointments.filter(appointment =>
    appointment.status === AppointmentStatus.WAITING
    || appointment.status === AppointmentStatus.SCHEDULED
    || appointment.status === AppointmentStatus.CALLED,
  );

  return new Map(
    waitingQueue.map((appointment, index) => [
      appointment.id,
      Math.max(0, Math.round((inProgressCount + index) * averageConsultDuration)),
    ]),
  );
};

const StatusColumn = ({
  title,
  items,
  color,
  icon: Icon,
  onStatusChange,
  nextStatus,
  t,
  estimatedWaitingMinutesByAppointment
}: {
  title: string,
  items: Appointment[],
  color: string,
  icon: any,
  onStatusChange: (id: string, status: AppointmentStatus) => void,
  nextStatus?: AppointmentStatus,
  t: (key: string, options?: Record<string, unknown>) => string,
  estimatedWaitingMinutesByAppointment: Map<string, number>
}) => (
  <div className="flex-1 min-w-[300px] bg-gray-50 rounded-xl p-4 flex flex-col h-full">
    <div className={`flex items-center space-x-2 mb-4 pb-2 border-b ${color}`}>
      <Icon className="w-5 h-5" />
      <h3 className="font-semibold text-gray-700">{title} <span className="text-gray-400 text-sm font-normal">({items.length})</span></h3>
    </div>
    <div className="space-y-3 overflow-y-auto flex-1 pr-2">
      {items.length === 0 && (
        <div className="text-center py-8 text-gray-400 italic text-sm">{t('queue_board.empty')}</div>
      )}
      {items.map(apt => {
        const estimatedWaitingMinutes = estimatedWaitingMinutesByAppointment.get(apt.id);
        const metricLabel = getMetricLabel(apt, t)
          ?? (estimatedWaitingMinutes != null
            ? t('queue_board.waiting_time', {
              minutes: estimatedWaitingMinutes,
              estimated: t('queue_board.estimated'),
            })
            : null);

        return (
        <div key={apt.id} className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-all">
          <div className="flex justify-between items-start mb-2">
            <div>
              <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-gray-100 text-gray-600 uppercase tracking-wider mb-1">
                {formatTimeTo12Hour(apt.timeSlot)}
              </span>
              <h4 className="font-semibold text-gray-900">{apt.patientName}</h4>
            </div>
            {apt.type === 'Procedure' && (
              <span className="w-2 h-2 rounded-full bg-purple-500" title={t('queue_board.procedure_badge')}></span>
            )}
          </div>
          <p className="text-xs text-gray-500 mb-3">{apt.department} • {apt.doctorName}</p>

          <div className="flex justify-between items-center">
            <div className="text-xs text-gray-500 min-h-4">{metricLabel}</div>
            {nextStatus && (
              <button
                onClick={() => onStatusChange(apt.id, nextStatus)}
                className="text-xs bg-primary-50 text-primary-700 hover:bg-primary-100 px-3 py-1.5 rounded-md font-medium transition-colors"
              >
                {t('queue_board.move_to', { status: t(`queue_board.status.${nextStatus}`) })}
              </button>
            )}
          </div>
        </div>
      )})}
    </div>
  </div>
);

export const QueueBoard: React.FC<QueueBoardProps> = ({ appointments, onStatusChange }) => {
  const { t } = useTranslation();
  const waiting = appointments.filter(a => a.status === AppointmentStatus.WAITING || a.status === AppointmentStatus.SCHEDULED);
  const inProgress = appointments.filter(a => a.status === AppointmentStatus.IN_PROGRESS);
  const completed = appointments.filter(a => a.status === AppointmentStatus.COMPLETED);
  const estimatedWaitingMinutesByAppointment = getEstimatedWaitingMinutesByAppointment(appointments);

  return (
    <div className="flex overflow-x-auto pb-4 gap-4 h-[calc(100vh-200px)]">
      <StatusColumn
        title={t('queue_board.column.waiting_room')}
        items={waiting}
        color="border-amber-400 text-amber-600"
        icon={Clock}
        onStatusChange={onStatusChange}
        nextStatus={AppointmentStatus.IN_PROGRESS}
        t={t}
        estimatedWaitingMinutesByAppointment={estimatedWaitingMinutesByAppointment}
      />
      <StatusColumn
        title={t('queue_board.column.in_progress')}
        items={inProgress}
        color="border-blue-500 text-blue-600"
        icon={PlayCircle}
        onStatusChange={onStatusChange}
        nextStatus={AppointmentStatus.COMPLETED}
        t={t}
        estimatedWaitingMinutesByAppointment={estimatedWaitingMinutesByAppointment}
      />
      <StatusColumn
        title={t('queue_board.column.completed')}
        items={completed}
        color="border-emerald-500 text-emerald-600"
        icon={CheckCircle}
        onStatusChange={onStatusChange}
        t={t}
        estimatedWaitingMinutesByAppointment={estimatedWaitingMinutesByAppointment}
      />
    </div>
  );
};

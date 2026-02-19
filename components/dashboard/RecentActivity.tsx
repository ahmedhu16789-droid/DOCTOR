import React from 'react';
import { Appointment, AppointmentStatus } from '../../types';
import { Clock } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { formatTimeTo12Hour } from '../../utils/time';

interface RecentActivityProps {
  appointments: Appointment[];
}

export const RecentActivity: React.FC<RecentActivityProps> = ({ appointments }) => {
  const recent = appointments.slice(0, 5);
  const { t } = useTranslation();

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col h-full">
      <div className="p-6 border-b border-gray-100 flex justify-between items-center">
        <h3 className="font-bold text-gray-900 text-lg">{t('recent_appointments')}</h3>
        <button className="text-sm text-primary-600 font-medium hover:text-primary-700">{t('view_all')}</button>
      </div>
      
      <div className="overflow-x-auto flex-1">
        <table className="min-w-full divide-y divide-gray-100">
          <thead className="bg-gray-50/50">
            <tr>
              <th className="px-6 py-4 text-start text-xs font-semibold text-gray-500 uppercase tracking-wider">{t('patient')}</th>
              <th className="px-6 py-4 text-start text-xs font-semibold text-gray-500 uppercase tracking-wider">{t('doctor')}</th>
              <th className="px-6 py-4 text-start text-xs font-semibold text-gray-500 uppercase tracking-wider">{t('status')}</th>
              <th className="px-6 py-4 text-end text-xs font-semibold text-gray-500 uppercase tracking-wider">{t('time')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {recent.map((apt) => (
              <tr key={apt.id} className="hover:bg-gray-50/80 transition-colors">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <div className="h-9 w-9 rounded-full bg-gradient-to-br from-primary-100 to-primary-200 flex items-center justify-center text-primary-700 font-bold text-xs me-3">
                      {apt.patientName.split(' ').map(n => n[0]).join('')}
                    </div>
                    <div>
                      <div className="text-sm font-bold text-gray-900">{apt.patientName}</div>
                      <div className="text-xs text-gray-500 capitalize">{apt.type.toLowerCase()}</div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                   {apt.doctorName}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border
                     ${apt.status === AppointmentStatus.SCHEDULED ? 'bg-gray-50 text-gray-700 border-gray-200' : ''}
                     ${apt.status === AppointmentStatus.WAITING ? 'bg-amber-50 text-amber-700 border-amber-200' : ''}
                     ${apt.status === AppointmentStatus.IN_PROGRESS ? 'bg-blue-50 text-blue-700 border-blue-200' : ''}
                     ${apt.status === AppointmentStatus.COMPLETED ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : ''}
                  `}>
                    {t(apt.status)}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-end text-sm text-gray-500 font-medium">
                  <div className="flex items-center justify-end gap-1">
                      <Clock className="w-3 h-3" /> {formatTimeTo12Hour(apt.timeSlot)}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
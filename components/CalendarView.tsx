import React, { useState, useMemo } from 'react';
import { Appointment, AppointmentStatus } from '../types';
import { ChevronLeft, ChevronRight, User, Calendar as CalendarIcon, PanelRightClose, PanelRightOpen } from 'lucide-react';

import { useTranslation } from 'react-i18next';

interface CalendarViewProps {
  appointments: Appointment[];
}

export const CalendarView: React.FC<CalendarViewProps> = ({ appointments }) => {
  const { t, i18n } = useTranslation();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [isAgendaOpen, setIsAgendaOpen] = useState(true);

  // Helpers
  const getDaysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
  const getFirstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay();

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);

  const monthNames = t('months', { returnObjects: true }) as string[];
  const daysShort = t('days_short', { returnObjects: true }) as string[];

  const handlePrevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const handleNextMonth = () => setCurrentDate(new Date(year, month + 1, 1));

  const isToday = (d: number) => {
    const today = new Date();
    return d === today.getDate() && month === today.getMonth() && year === today.getFullYear();
  };

  const isSelected = (d: number) => {
    return d === selectedDate.getDate() && month === selectedDate.getMonth() && year === selectedDate.getFullYear();
  };

  const getAppointmentsForDate = (d: number) => {
    // Format date as YYYY-MM-DD to match data
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    return appointments.filter(a => a.date === dateStr);
  };

  const selectedDateAppointments = useMemo(() => {
    const dateStr = `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}-${String(selectedDate.getDate()).padStart(2, '0')}`;
    return appointments.filter(a => a.date === dateStr).sort((a, b) => a.timeSlot.localeCompare(b.timeSlot));
  }, [selectedDate, appointments]);

  const renderCalendarDays = () => {
    const days = [];
    // Empty slots for previous month
    for (let i = 0; i < firstDay; i++) {
      days.push(<div key={`empty-${i}`} className="h-24 bg-gray-50/50 border border-gray-100"></div>);
    }

    // Days
    for (let d = 1; d <= daysInMonth; d++) {
      const dailyAppointments = getAppointmentsForDate(d);
      const hasAppointments = dailyAppointments.length > 0;

      days.push(
        <button
          key={d}
          onClick={() => setSelectedDate(new Date(year, month, d))}
          className={`h-24 border border-gray-100 p-2 flex flex-col items-start justify-start transition-all relative
            ${isToday(d) ? 'bg-blue-50' : 'bg-white hover:bg-gray-50'}
            ${isSelected(d) ? 'ring-2 ring-inset ring-primary-500 z-10' : ''}
          `}
        >
          <span className={`text-sm font-medium w-7 h-7 flex items-center justify-center rounded-full 
            ${isToday(d) ? 'bg-primary-600 text-white' : 'text-gray-700'}
          `}>
            {d}
          </span>

          {hasAppointments && (
            <div className="mt-2 w-full space-y-1">
              {dailyAppointments.slice(0, 2).map((apt, i) => (
                <div key={i} className="text-[10px] bg-primary-100 text-primary-700 px-1 py-0.5 rounded truncate w-full text-left font-medium border border-primary-200">
                  {apt.timeSlot} {apt.patientName.split(' ')[0]}
                </div>
              ))}
              {dailyAppointments.length > 2 && (
                <div className="text-[10px] text-gray-400 pl-1">
                  + {dailyAppointments.length - 2} more
                </div>
              )}
            </div>
          )}
        </button>
      );
    }
    return days;
  };

  return (
    <div className="flex flex-col h-[600px] lg:h-full bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-white">
        <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
          <CalendarIcon className="w-5 h-5 text-primary-600" />
          {monthNames[month]} {year}
        </h2>
        <div className="flex items-center space-x-2">
          <button onClick={handlePrevMonth} className="p-2 hover:bg-gray-100 rounded-full text-gray-600 border border-gray-200"><ChevronLeft className="w-5 h-5" /></button>
          <button onClick={() => setCurrentDate(new Date())} className="text-sm font-medium text-primary-600 hover:bg-primary-50 px-3 py-1.5 rounded-md border border-primary-200">{t('today')}</button>
          <button onClick={handleNextMonth} className="p-2 hover:bg-gray-100 rounded-full text-gray-600 border border-gray-200"><ChevronRight className="w-5 h-5" /></button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden flex-col lg:flex-row">
        {/* Calendar Grid */}
        <div className="flex-1 overflow-y-auto">
          <div className="grid grid-cols-7 border-b border-gray-200 bg-gray-50 text-center sticky top-0 z-10">
            {daysShort.map(day => (
              <div key={day} className="py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                {day}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {renderCalendarDays()}
          </div>
        </div>

        {/* Selected Day Agenda */}
        <div className="lg:hidden border-t border-gray-200 bg-white px-4 py-2">
          <button
            type="button"
            onClick={() => setIsAgendaOpen((prev) => !prev)}
            className="inline-flex items-center gap-2 text-sm font-medium text-primary-700 hover:text-primary-800"
          >
            {isAgendaOpen ? <PanelRightClose className="w-4 h-4" /> : <PanelRightOpen className="w-4 h-4" />}
            {isAgendaOpen ? t('hide_day_agenda') : t('show_day_agenda')}
          </button>
        </div>

        {isAgendaOpen && (
          <div className="w-full lg:w-80 bg-gray-50 border-l border-gray-200 flex flex-col h-full lg:max-h-full max-h-[300px]">
            <div className="p-4 border-b border-gray-200 bg-white flex-shrink-0 flex items-start justify-between gap-3">
              <div>
                <h3 className="font-bold text-gray-900">
                  {selectedDate.toLocaleDateString(i18n.language, { weekday: 'long', month: 'long', day: 'numeric' })}
                </h3>
                <p className="text-sm text-gray-500 mt-1">
                  {selectedDateAppointments.length} {t('appointment')}{selectedDateAppointments.length !== 1 ? 's' : ''}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsAgendaOpen(false)}
                className="hidden lg:inline-flex p-1.5 rounded-md text-gray-500 hover:text-primary-700 hover:bg-primary-50"
                aria-label={t('hide_day_agenda')}
              >
                <PanelRightClose className="w-4 h-4" />
              </button>
            </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {selectedDateAppointments.length === 0 ? (
              <div className="text-center py-10 text-gray-400 text-sm">
                {t('no_appointments')}
              </div>
            ) : (
              selectedDateAppointments.map(apt => (
                <div key={apt.id} className="bg-white p-3 rounded-lg border border-gray-200 shadow-sm border-l-4 border-l-primary-500 hover:shadow-md transition-shadow">
                  <div className="flex justify-between items-start mb-1">
                    <span className="font-bold text-gray-900 text-sm">{apt.timeSlot}</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium
                          ${apt.status === AppointmentStatus.SCHEDULED ? 'bg-blue-100 text-blue-700' : ''}
                          ${apt.status === AppointmentStatus.IN_PROGRESS ? 'bg-amber-100 text-amber-700' : ''}
                          ${apt.status === AppointmentStatus.COMPLETED ? 'bg-green-100 text-green-700' : ''}
                          ${apt.status === AppointmentStatus.WAITING ? 'bg-purple-100 text-purple-700' : ''}
                        `}>
                      {apt.status}
                    </span>
                  </div>
                  <div className="font-medium text-gray-800 text-sm mb-0.5">{apt.patientName}</div>
                  <div className="text-xs text-gray-500 flex items-center gap-1">
                    <User className="w-3 h-3" /> {apt.doctorName}
                  </div>
                </div>
              ))
            )}
          </div>
          </div>
        )}

        {!isAgendaOpen && (
          <button
            type="button"
            onClick={() => setIsAgendaOpen(true)}
            className="hidden lg:flex w-12 border-l border-gray-200 bg-gray-50 items-center justify-center text-gray-500 hover:text-primary-700 hover:bg-primary-50 transition-colors"
            aria-label={t('show_day_agenda')}
          >
            <PanelRightOpen className="w-5 h-5" />
          </button>
        )}
      </div>
    </div>
  );
};

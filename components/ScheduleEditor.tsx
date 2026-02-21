import React, { useState } from 'react';
import { WeeklyShift } from '../types';
import { BRANCHES } from '../constants';
import { X, Plus, Clock, AlertTriangle } from 'lucide-react';
import { Select } from './common/Select';
import { useTranslation } from 'react-i18next';

interface ScheduleEditorProps {
  schedule: WeeklyShift[];
  onSave: (newSchedule: WeeklyShift[]) => void;
  allowedBranches: string[];
}

export const ScheduleEditor: React.FC<ScheduleEditorProps> = ({ schedule, onSave, allowedBranches }) => {
  const { t } = useTranslation();
  const [shifts, setShifts] = useState<WeeklyShift[]>(schedule);
  const [newShift, setNewShift] = useState<Partial<WeeklyShift>>({
    dayOfWeek: 1,
    startTime: '09:00',
    endTime: '17:00',
    branchId: allowedBranches[0],
    slotDuration: 20
  });
  const [error, setError] = useState<string | null>(null);

  const days = [
    t('weekday.sunday'),
    t('weekday.monday'),
    t('weekday.tuesday'),
    t('weekday.wednesday'),
    t('weekday.thursday'),
    t('weekday.friday'),
    t('weekday.saturday')
  ];

  // Conflict Detection
  const hasConflict = (shift: Partial<WeeklyShift>) => {
    return shifts.some(s => {
      if (s.dayOfWeek !== shift.dayOfWeek) return false;
      // Convert to minutes for easy comparison
      const start1 = parseInt(s.startTime.replace(':', '')) * 1;
      const end1 = parseInt(s.endTime.replace(':', '')) * 1;
      const start2 = parseInt(shift.startTime!.replace(':', '')) * 1;
      const end2 = parseInt(shift.endTime!.replace(':', '')) * 1;

      return (start1 < end2 && start2 < end1);
    });
  };

  const handleAddShift = () => {
    setError(null);
    if (!newShift.startTime || !newShift.endTime || !newShift.branchId) return;

    if (newShift.startTime >= newShift.endTime) {
      setError(t('schedule_editor.error.end_after_start'));
      return;
    }

    if (hasConflict(newShift)) {
      setError(t('schedule_editor.error.overlap'));
      return;
    }

    const shiftToAdd: WeeklyShift = {
      id: Math.random().toString(),
      dayOfWeek: newShift.dayOfWeek!,
      startTime: newShift.startTime!,
      endTime: newShift.endTime!,
      branchId: newShift.branchId!,
      slotDuration: newShift.slotDuration || 20
    };

    const updated = [...shifts, shiftToAdd];
    setShifts(updated);
    onSave(updated);
  };

  const handleRemoveShift = (id: string) => {
    const updated = shifts.filter(s => s.id !== id);
    setShifts(updated);
    onSave(updated);
  };

  const getBranchName = (id: string) => BRANCHES.find(b => b.id === id)?.name || id;

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
      <h3 className="font-bold text-gray-900 mb-4 flex items-center">
        <Clock className="w-5 h-5 mr-2 text-primary-600" />
        {t('schedule_editor.title')}
      </h3>

      {/* Add Form */}
      <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 mb-6">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-3">
          <div className="col-span-1">
            <label className="text-xs font-bold text-gray-500 uppercase">{t('schedule_editor.day')}</label>
            <div className="mt-1">
              <Select
                value={newShift.dayOfWeek!.toString()}
                onChange={val => setNewShift({ ...newShift, dayOfWeek: parseInt(val) })}
                options={days.map((d, i) => ({ value: i.toString(), label: d }))}
              />
            </div>
          </div>
          <div className="col-span-1">
            <label className="text-xs font-bold text-gray-500 uppercase">{t('schedule_editor.branch')}</label>
            <div className="mt-1">
              <Select
                value={newShift.branchId || ''}
                onChange={val => setNewShift({ ...newShift, branchId: val })}
                options={BRANCHES.filter(b => allowedBranches.includes(b.id)).map(b => ({ value: b.id, label: b.name }))}
              />
            </div>
          </div>
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase">{t('schedule_editor.start')}</label>
            <input
              type="time"
              className="w-full mt-1 p-2 text-sm border rounded"
              value={newShift.startTime}
              onChange={e => setNewShift({ ...newShift, startTime: e.target.value })}
            />
          </div>
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase">{t('schedule_editor.end')}</label>
            <input
              type="time"
              className="w-full mt-1 p-2 text-sm border rounded"
              value={newShift.endTime}
              onChange={e => setNewShift({ ...newShift, endTime: e.target.value })}
            />
          </div>
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase">{t('schedule_editor.slot_min')}</label>
            <div className="mt-1">
              <Select
                value={newShift.slotDuration!.toString()}
                onChange={val => setNewShift({ ...newShift, slotDuration: parseInt(val) })}
                options={[
                  { value: '10', label: t('schedule_editor.slot_option', { minutes: 10 }) },
                  { value: '15', label: t('schedule_editor.slot_option', { minutes: 15 }) },
                  { value: '20', label: t('schedule_editor.slot_option', { minutes: 20 }) },
                  { value: '30', label: t('schedule_editor.slot_option', { minutes: 30 }) },
                  { value: '45', label: t('schedule_editor.slot_option', { minutes: 45 }) },
                  { value: '60', label: t('schedule_editor.slot_option', { minutes: 60 }) }
                ]}
              />
            </div>
          </div>
        </div>

        {error && (
          <div className="flex items-center text-red-600 text-sm mb-3 bg-red-50 p-2 rounded">
            <AlertTriangle className="w-4 h-4 mr-2" /> {error}
          </div>
        )}

        <button
          onClick={handleAddShift}
          className="w-full py-2 bg-white border-2 border-dashed border-gray-300 text-gray-500 font-bold rounded hover:border-primary-500 hover:text-primary-600 transition-colors flex justify-center items-center"
        >
          <Plus className="w-4 h-4 mr-2" /> {t('schedule_editor.add_shift')}
        </button>
      </div>

      {/* Visual Schedule Grid */}
      <div className="space-y-4">
        {days.map((dayName, dayIndex) => {
          const dayShifts = shifts.filter(s => s.dayOfWeek === dayIndex).sort((a, b) => a.startTime.localeCompare(b.startTime));

          if (dayShifts.length === 0) return null;

          return (
            <div key={dayIndex} className="flex flex-col sm:flex-row sm:items-center border-b border-gray-100 last:border-0 pb-4 last:pb-0">
              <div className="w-24 font-bold text-gray-900 text-sm mb-2 sm:mb-0">{dayName}</div>
              <div className="flex-1 flex flex-wrap gap-2">
                {dayShifts.map(shift => (
                  <div key={shift.id} className="relative group bg-blue-50 border border-blue-200 rounded px-3 py-1 text-sm flex items-center shadow-sm">
                    <span className="font-bold text-blue-900 mr-2">{shift.startTime} - {shift.endTime}</span>
                    <span className="text-xs text-blue-600 mr-3">{getBranchName(shift.branchId)}</span>
                    <span className="text-[10px] bg-white px-1 rounded text-gray-500 border border-gray-200">{shift.slotDuration}m</span>

                    <button
                      onClick={() => handleRemoveShift(shift.id)}
                      className="ml-2 text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
        {shifts.length === 0 && (
          <div className="text-center text-gray-400 text-sm italic py-4">{t('schedule_editor.empty')}</div>
        )}
      </div>
    </div>
  );
};

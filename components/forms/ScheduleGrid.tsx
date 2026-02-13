import React, { useState, useEffect } from 'react';
import { useFieldArray, Control, useWatch } from 'react-hook-form';
import { Plus, Trash2, AlertCircle, Copy, Clock, ArrowRight, MapPin, AlertTriangle, Building2 } from 'lucide-react';
import { WeeklyShift, Branch } from '../../types';
import { clsx } from 'clsx';

interface ScheduleGridProps {
  control: Control<any>;
  name: string;
  assignedBranchIds: string[];
  branches: Branch[];
}

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const timeToMinutes = (time: string) => {
  if (!time) return 0;
  const [h, m] = time.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
};

export const ScheduleGrid: React.FC<ScheduleGridProps> = ({ control, name, assignedBranchIds = [], branches }) => {
  // Default to the first assigned branch or empty
  const [activeBranchId, setActiveBranchId] = useState<string>(assignedBranchIds?.[0] || '');

  // Update active tab if assigned branches change and current active is no longer valid
  useEffect(() => {
    if (assignedBranchIds.length > 0 && !assignedBranchIds.includes(activeBranchId)) {
      setActiveBranchId(assignedBranchIds[0]);
    }
  }, [assignedBranchIds, activeBranchId]);

  const { fields, append, remove, replace } = useFieldArray({
    control,
    name
  });

  const scheduleData = useWatch({
    control,
    name
  }) || [];

  // Helper to get branch name
  const getBranchName = (id: string) => branches.find(b => b.id === id)?.name || 'Unknown Branch';

  const handleAddShift = (dayIndex: number) => {
    if (!activeBranchId) return;
    append({
      dayOfWeek: dayIndex,
      startTime: '09:00',
      endTime: '17:00',
      slotDuration: 20,
      branchId: activeBranchId,
      id: Math.random().toString()
    });
  };

  // Advanced Conflict Detection: Returns ID of conflicting shift
  const getConflictInfo = (currentItem: WeeklyShift, currentIndex: number) => {
    if (!currentItem) return null;

    const currentStart = timeToMinutes(currentItem.startTime);
    const currentEnd = timeToMinutes(currentItem.endTime);

    for (let i = 0; i < scheduleData.length; i++) {
      // Skip self
      if (i === currentIndex) continue;

      const other = scheduleData[i];

      // Skip if undefined or null
      if (!other) continue;

      // Check only same day
      if (other.dayOfWeek !== currentItem.dayOfWeek) continue;

      const otherStart = timeToMinutes(other.startTime);
      const otherEnd = timeToMinutes(other.endTime);

      // Check overlap
      if (currentStart < otherEnd && otherStart < currentEnd) {
        return {
          isConflict: true,
          branchName: getBranchName(other.branchId),
          isOtherBranch: other.branchId !== currentItem.branchId
        };
      }
    }
    return null;
  };

  const copyToAllDays = (sourceDayIndex: number) => {
    if (!activeBranchId) return;

    // 1. Get shifts for current branch on source day
    const sourceShifts = scheduleData.filter(s => s.dayOfWeek === sourceDayIndex && s.branchId === activeBranchId);
    if (sourceShifts.length === 0) return;

    // 2. We need to construct a new array that:
    //    - Keeps shifts from OTHER branches intact
    //    - Keeps shifts for THIS branch on the SOURCE day intact
    //    - Replaces shifts for THIS branch on TARGET days with copies of source

    const newSchedule: any[] = [];
    const sourceShiftsData = sourceShifts.map(s => ({ ...s })); // Deep copy values

    // Keep shifts from other branches
    scheduleData.forEach(s => {
      if (s && s.branchId !== activeBranchId) {
        newSchedule.push(s);
      }
    });

    // Rebuild current branch schedule
    DAYS.forEach((_, targetDayIndex) => {
      if (targetDayIndex === sourceDayIndex) {
        // Keep original shifts for the source day
        sourceShifts.forEach(s => newSchedule.push(s));
      } else {
        // Copy logic
        sourceShiftsData.forEach(s => {
          newSchedule.push({
            ...s,
            dayOfWeek: targetDayIndex,
            id: Math.random().toString(),
            branchId: activeBranchId
          });
        });
      }
    });

    replace(newSchedule);
  };

  if (!assignedBranchIds || assignedBranchIds.length === 0) {
    return (
      <div className="text-center py-12 bg-gray-50 rounded-xl border-2 border-dashed border-gray-300">
        <Building2 className="w-10 h-10 text-gray-300 mx-auto mb-3" />
        <p className="text-gray-500 font-medium">No branches assigned.</p>
        <p className="text-xs text-gray-400">Please select branches above to configure schedule.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {/* Branch Tabs */}
      <div className="flex overflow-x-auto gap-2 pb-2 border-b border-gray-200 no-scrollbar">
        {assignedBranchIds.map(branchId => {
          const branch = branches.find(b => b.id === branchId);
          const isActive = activeBranchId === branchId;
          const shiftCount = scheduleData.filter(s => s && s.branchId === branchId).length;

          return (
            <button
              key={branchId}
              type="button"
              onClick={() => setActiveBranchId(branchId)}
              className={clsx(
                "flex items-center whitespace-nowrap px-4 py-2.5 rounded-t-lg font-medium text-sm transition-all border-b-2",
                isActive
                  ? "border-primary-600 text-primary-700 bg-primary-50"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50"
              )}
            >
              <MapPin className={clsx("w-4 h-4 mr-2", isActive ? "text-primary-600" : "text-gray-400")} />
              {branch?.name}
              {shiftCount > 0 && (
                <span className={clsx("ml-2 text-[10px] px-1.5 py-0.5 rounded-full", isActive ? "bg-primary-200" : "bg-gray-200")}>
                  {shiftCount}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="flex justify-between items-center">
        <h4 className="text-sm font-bold text-gray-700 uppercase tracking-wide flex items-center">
          <Clock className="w-4 h-4 mr-2 text-primary-600" />
          Schedule for: <span className="text-gray-900 ml-1">{getBranchName(activeBranchId)}</span>
        </h4>
        <span className="text-xs text-gray-400 font-medium">Auto-saves on change</span>
      </div>

      <div className="space-y-4 animate-in fade-in duration-300">
        {DAYS.map((day, dayIndex) => {
          // Get indices for useFieldArray mapping
          // We filter visually, but must maintain the original index for RHF
          const relevantFields = fields
            .map((field, index) => ({ ...field, index }))
            .filter((f: any) => f && f.dayOfWeek === dayIndex && f.branchId === activeBranchId);

          const hasShifts = relevantFields.length > 0;

          return (
            <div key={day} className={clsx(
              "rounded-xl border transition-all duration-200 overflow-hidden",
              "border-gray-200 bg-gray-50/30 hover:border-gray-300"
            )}>
              {/* Day Header */}
              <div className="flex justify-between items-center px-4 py-3 bg-gray-100/50">
                <div className="flex items-center gap-3">
                  <span className="font-bold text-gray-700 w-24 text-sm">{day}</span>
                  {!hasShifts && (
                    <span className="text-xs text-gray-400 italic">No shifts configured</span>
                  )}
                </div>

                <div className="flex gap-2">
                  {hasShifts && (
                    <button
                      type="button"
                      onClick={() => copyToAllDays(dayIndex)}
                      className="text-xs text-gray-500 hover:text-primary-600 font-medium flex items-center gap-1 px-2 py-1 rounded hover:bg-white transition-colors"
                      title="Copy this day's schedule to all other days for this branch"
                    >
                      <Copy className="w-3 h-3" /> Copy to All
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => handleAddShift(dayIndex)}
                    className="p-1.5 rounded-md bg-white border border-gray-200 text-primary-600 hover:bg-primary-50 hover:border-primary-200 shadow-sm transition-all"
                    title="Add Shift"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Shifts List */}
              {hasShifts && (
                <div className="p-3 space-y-2">
                  {relevantFields.map((field: any) => {
                    const currentShift = scheduleData?.[field.index];
                    const conflict = currentShift ? getConflictInfo(currentShift, field.index) : null;

                    return (
                      <div key={field.id} className={clsx(
                        "flex flex-col sm:flex-row flex-wrap gap-3 items-start sm:items-center p-3 rounded-lg border shadow-sm transition-all relative",
                        conflict ? "bg-red-50 border-red-300" : "bg-white border-gray-200"
                      )}>
                        <div className="flex items-center gap-2">
                          <div className="flex flex-col">
                            <label className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-0.5">Start</label>
                            <input
                              type="time"
                              {...control.register(`${name}.${field.index}.startTime`)}
                              className={clsx(
                                "p-1.5 border rounded-md text-sm font-medium focus:ring-2 focus:ring-primary-500 w-28",
                                conflict ? "border-red-300 text-red-900 bg-red-50" : "border-gray-300 text-gray-700"
                              )}
                            />
                          </div>
                          <ArrowRight className="w-4 h-4 text-gray-300 mt-4" />
                          <div className="flex flex-col">
                            <label className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-0.5">End</label>
                            <input
                              type="time"
                              {...control.register(`${name}.${field.index}.endTime`)}
                              className={clsx(
                                "p-1.5 border rounded-md text-sm font-medium focus:ring-2 focus:ring-primary-500 w-28",
                                conflict ? "border-red-300 text-red-900 bg-red-50" : "border-gray-300 text-gray-700"
                              )}
                            />
                          </div>
                        </div>

                        <div className="h-8 w-px bg-gray-100 mx-2 hidden sm:block"></div>

                        <div className="flex flex-col">
                          <label className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-0.5">Slot Duration</label>
                          <select
                            {...control.register(`${name}.${field.index}.slotDuration`, { valueAsNumber: true })}
                            className="p-1.5 border border-gray-300 rounded-md text-sm text-gray-700 focus:ring-2 focus:ring-primary-500 bg-white"
                          >
                            <option value={10}>10 min</option>
                            <option value={15}>15 min</option>
                            <option value={20}>20 min</option>
                            <option value={30}>30 min</option>
                            <option value={45}>45 min</option>
                            <option value={60}>60 min</option>
                          </select>
                        </div>

                        {/* Conflict Message */}
                        {conflict && (
                          <div className="flex items-center text-xs text-red-600 font-bold bg-white px-2 py-1 rounded border border-red-100 ml-2 shadow-sm">
                            <AlertTriangle className="w-3 h-3 mr-1" />
                            {conflict.isOtherBranch
                              ? `Overlap in ${conflict.branchName}`
                              : "Overlap"}
                          </div>
                        )}

                        <button
                          type="button"
                          onClick={() => remove(field.index)}
                          className="ml-auto text-gray-400 hover:text-red-500 p-2 hover:bg-gray-100 rounded-full transition-colors absolute top-2 right-2 sm:static"
                          title="Remove shift"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
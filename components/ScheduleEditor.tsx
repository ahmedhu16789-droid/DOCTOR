import React, { useState } from 'react';
import { WeeklyShift, Branch } from '../types';
import { BRANCHES } from '../constants';
import { X, Plus, Clock, AlertTriangle } from 'lucide-react';

interface ScheduleEditorProps {
  schedule: WeeklyShift[];
  onSave: (newSchedule: WeeklyShift[]) => void;
  allowedBranches: string[];
}

export const ScheduleEditor: React.FC<ScheduleEditorProps> = ({ schedule, onSave, allowedBranches }) => {
  const [shifts, setShifts] = useState<WeeklyShift[]>(schedule);
  const [newShift, setNewShift] = useState<Partial<WeeklyShift>>({
    dayOfWeek: 1,
    startTime: '09:00',
    endTime: '17:00',
    branchId: allowedBranches[0],
    slotDuration: 20
  });
  const [error, setError] = useState<string | null>(null);

  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

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
        setError("End time must be after start time");
        return;
    }

    if (hasConflict(newShift)) {
        setError("This shift overlaps with an existing shift.");
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
        Weekly Schedule & Availability
      </h3>

      {/* Add Form */}
      <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 mb-6">
         <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-3">
             <div className="col-span-1">
                 <label className="text-xs font-bold text-gray-500 uppercase">Day</label>
                 <select 
                   className="w-full mt-1 p-2 text-sm border rounded"
                   value={newShift.dayOfWeek}
                   onChange={e => setNewShift({...newShift, dayOfWeek: parseInt(e.target.value)})}
                 >
                     {days.map((d, i) => <option key={i} value={i}>{d}</option>)}
                 </select>
             </div>
             <div className="col-span-1">
                 <label className="text-xs font-bold text-gray-500 uppercase">Branch</label>
                 <select 
                   className="w-full mt-1 p-2 text-sm border rounded"
                   value={newShift.branchId}
                   onChange={e => setNewShift({...newShift, branchId: e.target.value})}
                 >
                     {BRANCHES.filter(b => allowedBranches.includes(b.id)).map(b => (
                         <option key={b.id} value={b.id}>{b.name}</option>
                     ))}
                 </select>
             </div>
             <div>
                 <label className="text-xs font-bold text-gray-500 uppercase">Start</label>
                 <input 
                    type="time" 
                    className="w-full mt-1 p-2 text-sm border rounded"
                    value={newShift.startTime}
                    onChange={e => setNewShift({...newShift, startTime: e.target.value})} 
                 />
             </div>
             <div>
                 <label className="text-xs font-bold text-gray-500 uppercase">End</label>
                 <input 
                    type="time" 
                    className="w-full mt-1 p-2 text-sm border rounded"
                    value={newShift.endTime}
                    onChange={e => setNewShift({...newShift, endTime: e.target.value})} 
                 />
             </div>
             <div>
                 <label className="text-xs font-bold text-gray-500 uppercase">Slot (Min)</label>
                 <select 
                    className="w-full mt-1 p-2 text-sm border rounded"
                    value={newShift.slotDuration}
                    onChange={e => setNewShift({...newShift, slotDuration: parseInt(e.target.value)})}
                 >
                     <option value={10}>10 min</option>
                     <option value={15}>15 min</option>
                     <option value={20}>20 min</option>
                     <option value={30}>30 min</option>
                     <option value={45}>45 min</option>
                     <option value={60}>60 min</option>
                 </select>
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
             <Plus className="w-4 h-4 mr-2" /> Add Shift
         </button>
      </div>

      {/* Visual Schedule Grid */}
      <div className="space-y-4">
          {days.map((dayName, dayIndex) => {
              const dayShifts = shifts.filter(s => s.dayOfWeek === dayIndex).sort((a,b) => a.startTime.localeCompare(b.startTime));
              
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
              <div className="text-center text-gray-400 text-sm italic py-4">No working hours defined.</div>
          )}
      </div>
    </div>
  );
};
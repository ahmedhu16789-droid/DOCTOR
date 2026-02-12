import React from 'react';
import { TimeSlot } from '../types';
import { Clock } from 'lucide-react';

interface DoctorSlotPickerProps {
  slots: TimeSlot[];
  selectedSlot: string | null;
  onSelectSlot: (time: string) => void;
  date: string;
}

export const DoctorSlotPicker: React.FC<DoctorSlotPickerProps> = ({ slots, selectedSlot, onSelectSlot, date }) => {
  // Group slots by hour for better visualization
  const morningSlots = slots.filter(s => parseInt(s.time.split(':')[0]) < 12);
  const afternoonSlots = slots.filter(s => parseInt(s.time.split(':')[0]) >= 12);

  const SlotGrid = ({ items }: { items: TimeSlot[] }) => (
    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
      {items.map((slot) => (
        <button
          key={slot.time}
          disabled={!slot.available}
          onClick={() => onSelectSlot(slot.time)}
          className={`
            relative py-2 px-1 text-sm font-medium rounded-md border transition-all
            ${!slot.available 
              ? 'bg-gray-100 text-gray-400 border-transparent cursor-not-allowed decoration-slice' 
              : selectedSlot === slot.time
                ? 'bg-primary-600 text-white border-primary-600 shadow-md transform scale-105'
                : 'bg-white text-gray-700 border-gray-200 hover:border-primary-400 hover:text-primary-600 hover:shadow-sm'
            }
          `}
        >
          {slot.time}
          {!slot.available && (
            <span className="absolute inset-0 flex items-center justify-center">
              <div className="w-full border-t border-gray-300 transform -rotate-12"></div>
            </span>
          )}
        </button>
      ))}
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center text-sm text-gray-500 bg-gray-50 p-2 rounded-lg">
        <Clock className="w-4 h-4 mr-2" />
        <span>Time zone: Africa/Cairo (GMT+3) • Duration: 15 min</span>
      </div>

      <div>
        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Morning</h4>
        <SlotGrid items={morningSlots} />
        {morningSlots.length === 0 && <p className="text-sm text-gray-400 italic">No morning slots available.</p>}
      </div>

      <div>
        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Afternoon</h4>
        <SlotGrid items={afternoonSlots} />
        {afternoonSlots.length === 0 && <p className="text-sm text-gray-400 italic">No afternoon slots available.</p>}
      </div>
      
      <div className="flex items-center gap-4 text-xs mt-4 justify-center border-t border-gray-100 pt-4">
        <div className="flex items-center">
            <span className="w-3 h-3 rounded-full bg-white border border-gray-300 mr-1"></span> Available
        </div>
        <div className="flex items-center">
            <span className="w-3 h-3 rounded-full bg-primary-600 mr-1"></span> Selected
        </div>
        <div className="flex items-center">
            <span className="w-3 h-3 rounded-full bg-gray-100 border border-gray-200 mr-1"></span> Booked
        </div>
      </div>
    </div>
  );
};
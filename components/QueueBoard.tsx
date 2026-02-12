import React from 'react';
import { Appointment, AppointmentStatus } from '../types';
import { Clock, CheckCircle, AlertCircle, PlayCircle } from 'lucide-react';

interface QueueBoardProps {
  appointments: Appointment[];
  onStatusChange: (id: string, status: AppointmentStatus) => void;
}

const StatusColumn = ({ 
  title, 
  items, 
  color,
  icon: Icon,
  onStatusChange,
  nextStatus
}: { 
  title: string, 
  items: Appointment[], 
  color: string,
  icon: any,
  onStatusChange: (id: string, status: AppointmentStatus) => void,
  nextStatus?: AppointmentStatus
}) => (
  <div className="flex-1 min-w-[300px] bg-gray-50 rounded-xl p-4 flex flex-col h-full">
    <div className={`flex items-center space-x-2 mb-4 pb-2 border-b ${color}`}>
      <Icon className="w-5 h-5" />
      <h3 className="font-semibold text-gray-700">{title} <span className="text-gray-400 text-sm font-normal">({items.length})</span></h3>
    </div>
    <div className="space-y-3 overflow-y-auto flex-1 pr-2">
      {items.length === 0 && (
        <div className="text-center py-8 text-gray-400 italic text-sm">No patients</div>
      )}
      {items.map(apt => (
        <div key={apt.id} className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-all">
          <div className="flex justify-between items-start mb-2">
            <div>
              <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-gray-100 text-gray-600 uppercase tracking-wider mb-1">
                {apt.timeSlot}
              </span>
              <h4 className="font-semibold text-gray-900">{apt.patientName}</h4>
            </div>
            {apt.type === 'Procedure' && (
              <span className="w-2 h-2 rounded-full bg-purple-500" title="Procedure"></span>
            )}
          </div>
          <p className="text-xs text-gray-500 mb-3">{apt.department} • {apt.doctorName}</p>
          
          <div className="flex justify-between items-center">
             <div className="text-xs text-gray-400">
               {apt.status === AppointmentStatus.WAITING && "Waiting 15m"}
             </div>
             {nextStatus && (
               <button 
                onClick={() => onStatusChange(apt.id, nextStatus)}
                className="text-xs bg-primary-50 text-primary-700 hover:bg-primary-100 px-3 py-1.5 rounded-md font-medium transition-colors"
               >
                 Move to {nextStatus.replace('_', ' ')}
               </button>
             )}
          </div>
        </div>
      ))}
    </div>
  </div>
);

export const QueueBoard: React.FC<QueueBoardProps> = ({ appointments, onStatusChange }) => {
  const waiting = appointments.filter(a => a.status === AppointmentStatus.WAITING || a.status === AppointmentStatus.SCHEDULED);
  const inProgress = appointments.filter(a => a.status === AppointmentStatus.IN_PROGRESS);
  const completed = appointments.filter(a => a.status === AppointmentStatus.COMPLETED);

  return (
    <div className="flex overflow-x-auto pb-4 gap-4 h-[calc(100vh-200px)]">
      <StatusColumn 
        title="Waiting Room" 
        items={waiting} 
        color="border-amber-400 text-amber-600"
        icon={Clock}
        onStatusChange={onStatusChange}
        nextStatus={AppointmentStatus.IN_PROGRESS}
      />
      <StatusColumn 
        title="In Progress" 
        items={inProgress} 
        color="border-blue-500 text-blue-600"
        icon={PlayCircle}
        onStatusChange={onStatusChange}
        nextStatus={AppointmentStatus.COMPLETED}
      />
      <StatusColumn 
        title="Completed" 
        items={completed} 
        color="border-emerald-500 text-emerald-600"
        icon={CheckCircle}
        onStatusChange={onStatusChange}
      />
    </div>
  );
};
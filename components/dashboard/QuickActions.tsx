import React from 'react';
import { UserPlus, CalendarPlus, FileText, CreditCard, Stethoscope } from 'lucide-react';

interface QuickActionsProps {
  onAction: (action: string) => void;
}

export const QuickActions: React.FC<QuickActionsProps> = ({ onAction }) => {
  const actions = [
    { id: 'book_appointment', label: 'New Appointment', icon: CalendarPlus, color: 'bg-primary-600 text-white hover:bg-primary-700' },
    { id: 'register_patient', label: 'Register Patient', icon: UserPlus, color: 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50' },
    { id: 'process_payment', label: 'Payment', icon: CreditCard, color: 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50' },
    { id: 'consultation', label: 'Consultation', icon: Stethoscope, color: 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50' },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {actions.map((action) => (
        <button
          key={action.id}
          onClick={() => onAction(action.id)}
          className={`flex flex-col items-center justify-center p-4 rounded-xl shadow-sm transition-all duration-200 ${action.color} group`}
        >
          <action.icon className="w-6 h-6 mb-2 group-hover:scale-110 transition-transform" />
          <span className="text-sm font-bold">{action.label}</span>
        </button>
      ))}
    </div>
  );
};
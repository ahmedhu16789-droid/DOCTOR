import React from 'react';
import { UserPlus, CalendarPlus, CreditCard, Stethoscope } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface QuickActionsProps {
  onAction: (action: string) => void;
}

export const QuickActions: React.FC<QuickActionsProps> = ({ onAction }) => {
  const { t } = useTranslation();

  const actions = [
    { id: 'book_appointment', labelKey: 'quick_actions.new_appointment', icon: CalendarPlus, color: 'bg-primary-600 text-white hover:bg-primary-700' },
    { id: 'register_patient', labelKey: 'quick_actions.register_patient', icon: UserPlus, color: 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50' },
    { id: 'process_payment', labelKey: 'quick_actions.payment', icon: CreditCard, color: 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50' },
    { id: 'consultation', labelKey: 'quick_actions.consultation', icon: Stethoscope, color: 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50' },
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
          <span className="text-sm font-bold">{t(action.labelKey)}</span>
        </button>
      ))}
    </div>
  );
};

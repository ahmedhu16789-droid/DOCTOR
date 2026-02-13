import React from 'react';
import { LucideIcon, ArrowUp, ArrowDown, Minus } from 'lucide-react';
import { clsx } from 'clsx';
import { useTranslation } from 'react-i18next';

interface KPICardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  trend?: string;
  trendUp?: boolean;
  trendNeutral?: boolean;
  subtitle?: string;
  color?: 'blue' | 'green' | 'amber' | 'purple' | 'rose';
  className?: string;
}

export const KPICard: React.FC<KPICardProps> = ({ 
  title, 
  value, 
  icon: Icon, 
  trend, 
  trendUp, 
  trendNeutral, 
  subtitle,
  color = 'blue',
  className
}) => {
  const { t } = useTranslation();
  
  const colorStyles = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-emerald-50 text-emerald-600',
    amber: 'bg-amber-50 text-amber-600',
    purple: 'bg-purple-50 text-purple-600',
    rose: 'bg-rose-50 text-rose-600',
  };

  return (
    <div className={clsx(
      "bg-white rounded-xl p-6 border border-gray-200 shadow-sm hover:shadow-md transition-all duration-200 flex flex-col justify-between",
      className
    )}>
      <div className="flex justify-between items-start mb-4">
        <div className={clsx("p-3 rounded-xl", colorStyles[color])}>
          <Icon className="w-6 h-6" />
        </div>
        {trend && (
          <div className={clsx(
            "flex items-center text-xs font-bold px-2 py-1 rounded-full",
            trendNeutral ? "bg-gray-100 text-gray-600" :
            trendUp ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"
          )}>
            {trendNeutral ? <Minus className="w-3 h-3 me-1" /> : 
             trendUp ? <ArrowUp className="w-3 h-3 me-1" /> : <ArrowDown className="w-3 h-3 me-1" />}
            {trend}
          </div>
        )}
      </div>
      
      <div>
        <h3 className="text-3xl font-bold text-gray-900 tracking-tight">{value}</h3>
        <p className="text-sm font-medium text-gray-500 mt-1">{t(title as any) || title}</p>
        {subtitle && <p className="text-xs text-gray-400 mt-1">{t(subtitle as any) || subtitle}</p>}
      </div>
    </div>
  );
};
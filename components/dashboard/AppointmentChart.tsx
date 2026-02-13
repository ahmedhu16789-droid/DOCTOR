// @ts-nocheck
import React from 'react';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { useTranslation } from 'react-i18next';

const data = [
  { name: 'Ortho', count: 12 },
  { name: 'Cardio', count: 19 },
  { name: 'Dental', count: 8 },
  { name: 'Internal', count: 15 },
  { name: 'Pediatric', count: 10 },
];

const COLORS = ['#0ea5e9', '#8b5cf6', '#10b981', '#f59e0b', '#f43f5e'];

export const AppointmentChart: React.FC = () => {
  const { t } = useTranslation();

  return (
    <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm h-full flex flex-col">
      <h3 className="font-bold text-gray-900 text-lg mb-1">{t('visits_by_dept')}</h3>
      <p className="text-sm text-gray-500 mb-6">{t('patient_distribution')}</p>

      <div className="flex-1 w-full min-h-[250px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data}>
            <XAxis
              dataKey="name"
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#64748b', fontSize: 12 }}
              dy={10}
            />
            {/* @ts-ignore */}
            <Tooltip
              cursor={{ fill: '#f1f5f9' }}
              contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
            />
            {/* @ts-ignore */}
            <Bar dataKey="count" radius={[6, 6, 0, 0]} barSize={40}>
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
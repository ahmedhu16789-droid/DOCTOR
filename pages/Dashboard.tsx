import React from 'react';
import { User, Appointment, UserRole } from '../types';
import { RevenueChart } from '../components/dashboard/RevenueChart';
import { AppointmentChart } from '../components/dashboard/AppointmentChart';
import { RecentActivity } from '../components/dashboard/RecentActivity';
import { useTranslation } from 'react-i18next';

interface DashboardProps {
  user: User;
  appointments: Appointment[];
  onStatusChange: (id: string, status: any) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ user, appointments, onStatusChange }) => {
  const isAdmin = user.role === UserRole.ADMIN || user.role === UserRole.BRANCH_MANAGER;
  const { t } = useTranslation();

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto animate-in fade-in duration-500">
      
      {/* Main Content Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          
          {/* Charts Column (2/3 width on large screens) */}
          <div className="xl:col-span-2 space-y-6">
              {isAdmin && (
                  <div className="h-[400px]">
                      <RevenueChart />
                  </div>
              )}
              <div className="h-[350px]">
                   <AppointmentChart />
              </div>
          </div>

          {/* Side Column (1/3 width) */}
          <div className="space-y-6 flex flex-col">
              <div className="flex-1 min-h-[400px]">
                  <RecentActivity appointments={appointments} />
              </div>
          </div>
      </div>
    </div>
  );
};
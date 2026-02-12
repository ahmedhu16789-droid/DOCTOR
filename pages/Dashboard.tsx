import React from 'react';
import { User, Appointment, UserRole } from '../types';
import { KPICard } from '../components/dashboard/KPICard';
import { RevenueChart } from '../components/dashboard/RevenueChart';
import { AppointmentChart } from '../components/dashboard/AppointmentChart';
import { RecentActivity } from '../components/dashboard/RecentActivity';
import { QuickActions } from '../components/dashboard/QuickActions';
import { 
  Users, CalendarCheck, Clock, DollarSign, Activity 
} from 'lucide-react';

interface DashboardProps {
  user: User;
  appointments: Appointment[];
  onStatusChange: (id: string, status: any) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ user, appointments, onStatusChange }) => {
  const isDoctor = user.role === UserRole.DOCTOR;
  const isAdmin = user.role === UserRole.ADMIN || user.role === UserRole.BRANCH_MANAGER;

  const totalRevenue = 154000;
  const waitingPatients = appointments.filter(a => a.status === 'WAITING').length;
  const activeDoctors = 8;
  const todayApts = appointments.filter(a => a.date === new Date().toISOString().split('T')[0]).length;

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto animate-in fade-in duration-500">
      
      {/* Welcome Banner */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
           <h1 className="text-2xl font-bold text-gray-900">Good Morning, {user.name.split(' ')[0]} 👋</h1>
           <p className="text-gray-500">Here's what's happening in your clinic today.</p>
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-500 bg-white px-3 py-1.5 rounded-full border border-gray-200 shadow-sm">
           <Clock className="w-4 h-4" />
           <span>{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</span>
        </div>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
        <KPICard 
          title="Total Revenue" 
          value={`${totalRevenue.toLocaleString()} EGP`} 
          icon={DollarSign} 
          trend="12.5%" 
          trendUp={true} 
          color="green" 
        />
        <KPICard 
          title="Appointments" 
          value={appointments.length} 
          icon={CalendarCheck} 
          trend="4.2%" 
          trendUp={true} 
          color="blue" 
          subtitle={`${todayApts} scheduled today`}
        />
        <KPICard 
          title="Waiting Patients" 
          value={waitingPatients} 
          icon={Users} 
          trend="2" 
          trendNeutral={true}
          color="amber" 
          subtitle="Avg wait: 14 mins"
        />
        <KPICard 
          title="Active Doctors" 
          value={activeDoctors} 
          icon={Activity} 
          color="purple" 
          subtitle="3 currently in-visit"
        />
      </div>

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
              <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                 <h3 className="font-bold text-gray-900 mb-4">Quick Actions</h3>
                 <QuickActions onAction={(action) => console.log(action)} />
              </div>

              <div className="flex-1 min-h-[400px]">
                  <RecentActivity appointments={appointments} />
              </div>
          </div>
      </div>
    </div>
  );
};
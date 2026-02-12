import React, { useState, ReactNode } from 'react';
import { User } from '../../types';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { clsx } from 'clsx';

interface DashboardLayoutProps {
  children: ReactNode;
  user: User | null;
  onLogout: () => void;
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export const DashboardLayout: React.FC<DashboardLayoutProps> = ({ 
  children, user, onLogout, activeTab, setActiveTab 
}) => {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  if (!user) return <div className="min-h-screen bg-gray-50">{children}</div>;

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <Sidebar 
        userRole={user.role}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        collapsed={collapsed}
        setCollapsed={setCollapsed}
        mobileOpen={mobileOpen}
        setMobileOpen={setMobileOpen}
        onLogout={onLogout}
      />
      
      <div className={clsx(
          "flex-1 flex flex-col min-h-screen transition-all duration-300",
          collapsed ? "md:ml-20" : "md:ml-64"
      )}>
         <Header 
            user={user}
            collapsed={collapsed}
            setMobileOpen={setMobileOpen}
            activeTab={activeTab}
         />

         <main className="flex-1 p-4 sm:p-6 lg:p-8 mt-16 overflow-x-hidden">
             {children}
         </main>
      </div>
    </div>
  );
};
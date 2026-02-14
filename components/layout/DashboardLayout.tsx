import React, { useState, ReactNode } from 'react';
import { Branch, User } from '../../types';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { clsx } from 'clsx';

interface DashboardLayoutProps {
  children: ReactNode;
  user: User | null;
  onLogout: () => void;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  availableBranches: Branch[];
  activeBranchId: string;
  onActiveBranchChange: (branchId: string) => void;
}

export const DashboardLayout: React.FC<DashboardLayoutProps> = ({ 
  children,
  user,
  onLogout,
  activeTab,
  setActiveTab,
  availableBranches,
  activeBranchId,
  onActiveBranchChange,
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
          collapsed ? "md:ms-20" : "md:ms-64" // Changed ml to ms (margin-start)
      )}>
         <Header 
            user={user}
            collapsed={collapsed}
            setMobileOpen={setMobileOpen}
            activeTab={activeTab}
            availableBranches={availableBranches}
            activeBranchId={activeBranchId}
            onActiveBranchChange={onActiveBranchChange}
         />

         <main className="flex-1 p-4 sm:p-6 lg:p-8 mt-16 overflow-x-hidden">
             {children}
         </main>
      </div>
    </div>
  );
};
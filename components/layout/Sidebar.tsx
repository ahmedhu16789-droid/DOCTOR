import React from 'react';
import { 
  LayoutDashboard, Calendar, Users, Activity, Settings, 
  LogOut, Building2, Stethoscope, Briefcase, Wallet, 
  ChevronLeft, ChevronRight 
} from 'lucide-react';
import { UserRole } from '../../types';
import { clsx } from 'clsx';

interface SidebarProps {
  userRole: UserRole;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  collapsed: boolean;
  setCollapsed: (v: boolean) => void;
  mobileOpen: boolean;
  setMobileOpen: (v: boolean) => void;
  onLogout: () => void;
}

const MENU_ITEMS = [
  { 
    group: 'Workspace',
    items: [
      { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { id: 'appointments', label: 'Appointments', icon: Calendar },
      { id: 'queue', label: 'Queue Board', icon: Activity },
    ]
  },
  {
    group: 'Management',
    items: [
      { id: 'patients', label: 'Patients', icon: Users },
      { id: 'doctors', label: 'Doctors', icon: Stethoscope, roles: [UserRole.ADMIN, UserRole.BRANCH_MANAGER] },
      { id: 'employees', label: 'Staff & HR', icon: Briefcase, roles: [UserRole.ADMIN, UserRole.BRANCH_MANAGER] },
      { id: 'branches', label: 'Branches', icon: Building2, roles: [UserRole.ADMIN] },
    ]
  },
  {
    group: 'Finance',
    items: [
      { id: 'finance', label: 'Reports', icon: Wallet, roles: [UserRole.ADMIN, UserRole.BRANCH_MANAGER] },
    ]
  }
];

export const Sidebar: React.FC<SidebarProps> = ({ 
  userRole, activeTab, setActiveTab, collapsed, setCollapsed, mobileOpen, setMobileOpen, onLogout 
}) => {
  
  const SidebarContent = () => (
    <div className="flex flex-col h-full bg-white border-r border-gray-200">
      {/* Brand */}
      <div className={clsx("h-16 flex items-center border-b border-gray-100 transition-all duration-300", collapsed ? "justify-center px-0" : "px-6")}>
        <div className="flex items-center space-x-2 text-primary-600">
           <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center text-white shrink-0">
             <Building2 className="w-5 h-5" />
           </div>
           {!collapsed && <span className="font-bold text-lg tracking-tight text-gray-900">Al-Fath Clinic</span>}
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 space-y-6">
        {MENU_ITEMS.map((group, idx) => {
          const filteredItems = group.items.filter(item => !item.roles || item.roles.includes(userRole));
          if (filteredItems.length === 0) return null;

          return (
            <div key={idx} className="px-3">
              {!collapsed && (
                <h4 className="px-4 mb-2 text-xs font-bold text-gray-400 uppercase tracking-wider">
                  {group.group}
                </h4>
              )}
              <div className="space-y-1">
                {filteredItems.map(item => (
                  <button
                    key={item.id}
                    onClick={() => {
                        setActiveTab(item.id);
                        setMobileOpen(false);
                    }}
                    title={collapsed ? item.label : undefined}
                    className={clsx(
                      "w-full flex items-center rounded-lg transition-all duration-200 group relative",
                      collapsed ? "justify-center p-3" : "px-4 py-2.5 space-x-3",
                      activeTab === item.id 
                        ? "bg-primary-50 text-primary-700 font-semibold shadow-sm" 
                        : "text-gray-500 hover:bg-gray-50 hover:text-gray-900 font-medium"
                    )}
                  >
                    <item.icon className={clsx("w-5 h-5 transition-colors", activeTab === item.id ? "text-primary-600" : "text-gray-400 group-hover:text-gray-600")} />
                    {!collapsed && <span>{item.label}</span>}
                    
                    {/* Active Indicator Strip */}
                    {activeTab === item.id && (
                        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-primary-600 rounded-r-full" />
                    )}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-3 border-t border-gray-100 space-y-1">
        <button
           onClick={() => setActiveTab('settings')}
           className={clsx(
             "w-full flex items-center rounded-lg transition-all duration-200 group",
             collapsed ? "justify-center p-3" : "px-4 py-2.5 space-x-3",
             activeTab === 'settings' ? "bg-gray-100 text-gray-900" : "text-gray-500 hover:bg-gray-50"
           )}
        >
            <Settings className="w-5 h-5" />
            {!collapsed && <span>Settings</span>}
        </button>
        <button
           onClick={onLogout}
           className={clsx(
             "w-full flex items-center rounded-lg transition-all duration-200 group text-rose-500 hover:bg-rose-50",
             collapsed ? "justify-center p-3" : "px-4 py-2.5 space-x-3"
           )}
        >
            <LogOut className="w-5 h-5" />
            {!collapsed && <span>Sign Out</span>}
        </button>
        
        {/* Collapse Toggle (Desktop Only) */}
        <div className="hidden md:flex justify-end pt-2">
            <button 
                onClick={() => setCollapsed(!collapsed)}
                className="p-1.5 rounded-md hover:bg-gray-100 text-gray-400"
            >
                {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
            </button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className={clsx(
        "hidden md:block fixed inset-y-0 left-0 z-20 h-full transition-all duration-300 ease-in-out",
        collapsed ? "w-20" : "w-64"
      )}>
        <SidebarContent />
      </aside>

      {/* Mobile Drawer */}
      <div className={clsx("md:hidden fixed inset-0 z-40 transition-opacity", mobileOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none")}>
         <div className="absolute inset-0 bg-gray-900/50 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
         <div className={clsx(
             "absolute inset-y-0 left-0 w-64 bg-white shadow-2xl transition-transform duration-300",
             mobileOpen ? "translate-x-0" : "-translate-x-full"
         )}>
             <SidebarContent />
         </div>
      </div>
    </>
  );
};
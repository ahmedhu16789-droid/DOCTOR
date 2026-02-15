import React from 'react';
import { Menu, Bell, Search, ChevronDown, Globe } from 'lucide-react';
import { Branch, User } from '../../types';
import { clsx } from 'clsx';
import { useLanguage } from '../../contexts/LanguageContext';
import { useTranslation } from 'react-i18next';

interface HeaderProps {
  user: User;
  collapsed: boolean;
  setMobileOpen: (v: boolean) => void;
  activeTab: string;
  availableBranches: Branch[];
  activeBranchId: string;
  onActiveBranchChange: (branchId: string) => void;
  canChangeBranch?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  user,
  collapsed,
  setMobileOpen,
  activeTab,
  availableBranches,
  activeBranchId,
  onActiveBranchChange,
  canChangeBranch = true,
}) => {
  const { language, toggleLanguage } = useLanguage();
  const { t } = useTranslation();

  return (
    <header className={clsx(
        "fixed top-0 z-10 h-16 bg-white/80 backdrop-blur-md border-b border-gray-200 transition-all duration-300 flex items-center justify-between px-4 sm:px-6",
        // Logic for positioning needs to be directional-aware or handled by parent layout padding
        "w-full lg:w-auto lg:start-64 lg:end-0", // Default expanded
        collapsed ? "lg:start-20" : "lg:start-64",
        "start-0 end-0" // Mobile
    )}>
      
      {/* Start: Mobile Toggle & Title */}
      <div className="flex items-center gap-4">
        <button 
            onClick={() => setMobileOpen(true)}
            className="md:hidden p-2 -ms-2 text-gray-500 hover:bg-gray-100 rounded-lg"
        >
            <Menu className="w-6 h-6" />
        </button>
        
        <h2 className="text-xl font-bold text-gray-800 capitalize hidden sm:block">
           {t(activeTab.replace('-', '_') as any) || activeTab}
        </h2>

        {/* Branch Selector (Desktop) */}
        <div className="hidden lg:flex items-center ms-6 ps-6 border-s border-gray-200">
             <span className="text-xs font-bold text-gray-400 me-2 uppercase tracking-wider">{t('current_branch')}:</span>
             <select
                value={activeBranchId}
                onChange={(event) => onActiveBranchChange(event.target.value)}
                disabled={!canChangeBranch}
                className="text-sm font-semibold text-gray-700 bg-transparent border-none focus:ring-0 p-0 cursor-pointer hover:text-primary-600 disabled:cursor-not-allowed disabled:text-gray-400"
             >
                 {availableBranches.map(b => (
                     <option key={b.id} value={b.id}>{b.name}</option>
                 ))}
             </select>
        </div>
      </div>

      {/* End: Actions & Profile */}
      <div className="flex items-center gap-2 sm:gap-4">
        
        {/* Language Switcher */}
        <button 
            onClick={toggleLanguage}
            className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-gray-50 text-gray-600 hover:bg-gray-100 border border-gray-200 text-xs font-bold transition-all"
        >
            <Globe className="w-3.5 h-3.5" />
            {language === 'en' ? 'العربية' : 'English'}
        </button>

        {/* Search Bar (Hidden on small mobile) */}
        <div className="hidden md:flex items-center relative">
            <Search className="absolute start-3 w-4 h-4 text-gray-400" />
            <input 
                type="text" 
                placeholder={t('search')} 
                className="ps-9 pe-4 py-1.5 rounded-full border border-gray-200 bg-gray-50 text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent w-48 transition-all focus:w-64"
            />
        </div>

        {/* Notifications */}
        <button className="relative p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors">
            <Bell className="w-5 h-5" />
            <span className="absolute top-1.5 end-1.5 w-2 h-2 bg-rose-500 rounded-full border-2 border-white"></span>
        </button>

        <div className="h-8 w-px bg-gray-200 mx-1"></div>

        {/* User Profile */}
        <button className="flex items-center gap-3 ps-1 pe-2 py-1 rounded-full hover:bg-gray-50 border border-transparent hover:border-gray-200 transition-all">
            <img 
                src={user.avatarUrl || 'https://via.placeholder.com/40'} 
                alt={user.name}
                className="w-8 h-8 rounded-full object-cover border border-gray-200"
            />
            <div className="hidden sm:block text-start">
                <p className="text-sm font-bold text-gray-900 leading-none">{user.name}</p>
                <p className="text-[10px] font-medium text-gray-500 uppercase mt-0.5">{user.role.replace('_', ' ')}</p>
            </div>
            <ChevronDown className="w-4 h-4 text-gray-400 hidden sm:block" />
        </button>
      </div>
    </header>
  );
};

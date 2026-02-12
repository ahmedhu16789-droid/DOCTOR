import React from 'react';
import { Menu, Bell, Search, ChevronDown } from 'lucide-react';
import { User, UserRole } from '../../types';
import { clsx } from 'clsx';
import { BRANCHES } from '../../constants';

interface HeaderProps {
  user: User;
  collapsed: boolean;
  setMobileOpen: (v: boolean) => void;
  activeTab: string;
}

export const Header: React.FC<HeaderProps> = ({ user, collapsed, setMobileOpen, activeTab }) => {
  return (
    <header className={clsx(
        "fixed top-0 right-0 z-10 h-16 bg-white/80 backdrop-blur-md border-b border-gray-200 transition-all duration-300 flex items-center justify-between px-4 sm:px-6",
        collapsed ? "md:left-20" : "md:left-64",
        "left-0"
    )}>
      
      {/* Left: Mobile Toggle & Title */}
      <div className="flex items-center gap-4">
        <button 
            onClick={() => setMobileOpen(true)}
            className="md:hidden p-2 -ml-2 text-gray-500 hover:bg-gray-100 rounded-lg"
        >
            <Menu className="w-6 h-6" />
        </button>
        
        <h2 className="text-xl font-bold text-gray-800 capitalize hidden sm:block">
           {activeTab.replace('-', ' ')}
        </h2>

        {/* Branch Selector (Desktop) */}
        <div className="hidden lg:flex items-center ml-6 pl-6 border-l border-gray-200">
             <span className="text-xs font-bold text-gray-400 mr-2 uppercase tracking-wider">Current Branch:</span>
             <select className="text-sm font-semibold text-gray-700 bg-transparent border-none focus:ring-0 p-0 cursor-pointer hover:text-primary-600">
                 {BRANCHES.map(b => (
                     <option key={b.id} value={b.id}>{b.name}</option>
                 ))}
             </select>
        </div>
      </div>

      {/* Right: Actions & Profile */}
      <div className="flex items-center gap-2 sm:gap-4">
        {/* Search Bar (Hidden on small mobile) */}
        <div className="hidden md:flex items-center relative">
            <Search className="absolute left-3 w-4 h-4 text-gray-400" />
            <input 
                type="text" 
                placeholder="Search..." 
                className="pl-9 pr-4 py-1.5 rounded-full border border-gray-200 bg-gray-50 text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent w-48 transition-all focus:w-64"
            />
        </div>

        {/* Notifications */}
        <button className="relative p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors">
            <Bell className="w-5 h-5" />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-rose-500 rounded-full border-2 border-white"></span>
        </button>

        <div className="h-8 w-px bg-gray-200 mx-1"></div>

        {/* User Profile */}
        <button className="flex items-center gap-3 pl-1 pr-2 py-1 rounded-full hover:bg-gray-50 border border-transparent hover:border-gray-200 transition-all">
            <img 
                src={user.avatarUrl || 'https://via.placeholder.com/40'} 
                alt={user.name}
                className="w-8 h-8 rounded-full object-cover border border-gray-200"
            />
            <div className="hidden sm:block text-left">
                <p className="text-sm font-bold text-gray-900 leading-none">{user.name}</p>
                <p className="text-[10px] font-medium text-gray-500 uppercase mt-0.5">{user.role.replace('_', ' ')}</p>
            </div>
            <ChevronDown className="w-4 h-4 text-gray-400 hidden sm:block" />
        </button>
      </div>
    </header>
  );
};
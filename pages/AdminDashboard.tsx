import React, { useState } from 'react';
import { User, UserRole } from '../types';
import { MOCK_USERS, BRANCHES } from '../constants';
import { KPICard } from '../components/dashboard/KPICard';
import { DoctorForm } from '../components/forms/DoctorForm';
import { Users, Building2, TrendingUp, DollarSign, Plus, XCircle, Stethoscope } from 'lucide-react';

interface AdminDashboardProps {
  currentUser: User;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ currentUser }) => {
  const [activeTab, setActiveTab] = useState<'OVERVIEW' | 'USERS'>('OVERVIEW');
  
  // State for Users
  const [users, setUsers] = useState<User[]>(MOCK_USERS);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [isCreatingUser, setIsCreatingUser] = useState(false);

  const isSuperAdmin = currentUser.role === UserRole.ADMIN;
  
  // Filter logic: Super admin sees all, Branch manager sees their branch staff
  const managedBranches = currentUser.assignedBranches;
  
  const filteredUsers = users.filter(u => {
      if (isSuperAdmin) return true;
      return u.assignedBranches.some(b => managedBranches.includes(b));
  });

  const doctorsCount = filteredUsers.filter(u => u.role === UserRole.DOCTOR).length;
  const activeBranches = BRANCHES.filter(b => b.isActive).length;

  // --- Handlers ---
  const handleSaveUser = (savedUser: User) => {
      if (isCreatingUser) {
          setUsers([...users, savedUser]);
      } else {
          setUsers(users.map(u => u.id === savedUser.id ? savedUser : u));
      }
      setIsCreatingUser(false);
      setEditingUser(null);
  };

  // --- Render Sections ---
  const renderOverview = () => (
    <div className="space-y-6 animate-in fade-in">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <KPICard 
                title="Total Revenue" 
                value="154,000 EGP"
                icon={DollarSign} 
                color="green" 
                trend="15%" 
                trendUp={true}
            />
             <KPICard 
                title="Active Doctors" 
                value={doctorsCount}
                icon={Stethoscope} 
                color="blue" 
                subtitle="Across all branches"
            />
             <KPICard 
                title="Active Branches" 
                value={activeBranches}
                icon={Building2} 
                color="purple" 
            />
             <KPICard 
                title="Avg Utilization" 
                value="85%"
                icon={TrendingUp} 
                color="amber" 
            />
        </div>

        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
            <h3 className="font-bold text-gray-900 mb-6">Financial Performance by Branch</h3>
            <div className="space-y-6">
                {BRANCHES.map((b, i) => {
                     // Hide branches not managed by current user if not super admin
                     if (!isSuperAdmin && !managedBranches.includes(b.id)) return null; 
                     const percentage = 80 - (i * 15);
                     
                     return (
                        <div key={b.id} className="space-y-2">
                            <div className="flex justify-between text-sm font-medium">
                                <span className="text-gray-700">{b.name}</span>
                                <span className="text-gray-900 font-bold">{(percentage * 1000).toLocaleString()} EGP</span>
                            </div>
                            <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                                <div className="h-full bg-primary-600 rounded-full" style={{ width: `${percentage}%` }}></div>
                            </div>
                        </div>
                     );
                })}
            </div>
        </div>
    </div>
  );

  const renderUserList = () => (
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col h-full">
          <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-gray-50/50">
              <h3 className="font-bold text-gray-900">Staff Directory</h3>
              {isSuperAdmin && (
                  <button 
                    onClick={() => setIsCreatingUser(true)}
                    className="flex items-center px-3 py-2 bg-primary-600 text-white rounded-lg text-sm font-bold hover:bg-primary-700 transition-colors"
                  >
                      <Plus className="w-4 h-4 mr-2" /> Add Doctor
                  </button>
              )}
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                    <tr>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">User</th>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Role</th>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Branches</th>
                        <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                    </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                    {filteredUsers.map(u => (
                        <tr key={u.id} className="hover:bg-gray-50/50 transition-colors">
                            <td className="px-6 py-4 whitespace-nowrap">
                                <div className="flex items-center">
                                    <img className="h-9 w-9 rounded-full object-cover border border-gray-100" src={u.avatarUrl || 'https://via.placeholder.com/150'} alt="" />
                                    <div className="ml-3">
                                        <div className="text-sm font-bold text-gray-900">{u.name}</div>
                                        <div className="text-xs text-gray-500">{u.email}</div>
                                    </div>
                                </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                <span className={`px-2.5 py-0.5 inline-flex text-xs leading-5 font-bold rounded-full uppercase tracking-wide
                                    ${u.role === UserRole.DOCTOR ? 'bg-blue-50 text-blue-700' : 
                                    u.role === UserRole.ADMIN ? 'bg-purple-50 text-purple-700' : 'bg-green-50 text-green-700'}`}>
                                    {u.role.replace('_', ' ')}
                                </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                {u.assignedBranches.length} Assigned
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                {isSuperAdmin && u.role === UserRole.DOCTOR && (
                                    <button 
                                        onClick={() => setEditingUser(u)}
                                        className="text-primary-600 hover:text-primary-800 font-semibold"
                                    >
                                        Edit
                                    </button>
                                )}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
          </div>
      </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
              {isSuperAdmin ? 'Clinic Administration' : 'Branch Management'}
          </h1>
          
          <div className="flex bg-gray-100/80 p-1 rounded-lg self-start sm:self-auto">
              <button 
                onClick={() => setActiveTab('OVERVIEW')}
                className={`px-4 py-1.5 rounded-md text-sm font-bold transition-all ${activeTab === 'OVERVIEW' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-900'}`}
              >
                  Overview
              </button>
              <button 
                onClick={() => setActiveTab('USERS')}
                className={`px-4 py-1.5 rounded-md text-sm font-bold transition-all ${activeTab === 'USERS' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-900'}`}
              >
                  Staff & Doctors
              </button>
          </div>
      </div>

      <div className="min-h-[500px]">
          {activeTab === 'OVERVIEW' && renderOverview()}
          {activeTab === 'USERS' && renderUserList()}
      </div>

      {/* Doctor Editor Modal */}
      {(editingUser || isCreatingUser) && (
          <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-2xl w-full max-w-4xl h-[90vh] flex flex-col overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
                  <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
                      <h2 className="text-lg font-bold text-gray-900">
                          {isCreatingUser ? 'Add New Doctor' : `Edit ${editingUser?.name}`}
                      </h2>
                      <button onClick={() => { setIsCreatingUser(false); setEditingUser(null); }} className="p-2 hover:bg-gray-200 rounded-full transition-colors">
                          <XCircle className="w-5 h-5 text-gray-500" />
                      </button>
                  </div>
                  <div className="flex-1 overflow-hidden">
                      <DoctorForm 
                        initialData={editingUser || undefined}
                        onSave={handleSaveUser}
                        onCancel={() => { setIsCreatingUser(false); setEditingUser(null); }}
                      />
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};
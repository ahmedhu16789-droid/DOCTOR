import React, { useEffect, useMemo, useState } from 'react';
import { User, UserRole, Branch } from '../types';
import { MOCK_USERS, BRANCHES } from '../constants';
import { KPICard } from '../components/dashboard/KPICard';
import { DoctorForm } from '../components/forms/DoctorForm';
import { Building2, TrendingUp, DollarSign, Plus, XCircle, Stethoscope } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { createDoctorViaApi, getBranchesFromApi, getDepartmentsFromApi, getDoctorsFromApi, updateDoctorViaApi, ApiDepartmentOption } from '../services/api';

interface AdminDashboardProps {
    currentUser: User;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ currentUser }) => {
    const { t } = useTranslation();
    const [activeTab, setActiveTab] = useState<'OVERVIEW' | 'USERS'>('OVERVIEW');
    const [users, setUsers] = useState<User[]>(MOCK_USERS.filter((u) => u.role === UserRole.DOCTOR));
    const [branches, setBranches] = useState<Branch[]>(BRANCHES);
    const [departments, setDepartments] = useState<ApiDepartmentOption[]>([]);
    const [editingUser, setEditingUser] = useState<User | null>(null);
    const [isCreatingUser, setIsCreatingUser] = useState(false);

    const isSuperAdmin = currentUser.role === UserRole.ADMIN;
    const managedBranches = currentUser.assignedBranches;

    useEffect(() => {
        (async () => {
            try {
                const [apiDoctors, apiBranches, apiDepartments] = await Promise.all([
                    getDoctorsFromApi(),
                    getBranchesFromApi(),
                    getDepartmentsFromApi(),
                ]);
                setUsers(apiDoctors);
                setBranches(apiBranches);
                setDepartments(apiDepartments);
            } catch {
                // keep local fallback
            }
        })();
    }, []);

    const filteredUsers = useMemo(() => users.filter(u => {
        if (isSuperAdmin) return true;
        return u.assignedBranches.some(b => managedBranches.includes(b));
    }), [users, isSuperAdmin, managedBranches]);

    const doctorsCount = filteredUsers.length;
    const activeBranches = branches.filter(b => b.isActive).length;

    const handleSaveUser = async (savedUser: User) => {
        const persisted = isCreatingUser ? await createDoctorViaApi(savedUser) : await updateDoctorViaApi(savedUser);
        if (isCreatingUser) {
            setUsers([...users, persisted]);
        } else {
            setUsers(users.map(u => u.id === persisted.id ? persisted : u));
        }
        setIsCreatingUser(false);
        setEditingUser(null);
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <h1 className="text-2xl font-bold text-gray-900 tracking-tight">{isSuperAdmin ? t('clinic_admin') : t('branch_mgmt')}</h1>
                <div className="flex bg-gray-100/80 p-1 rounded-lg self-start sm:self-auto">
                    <button onClick={() => setActiveTab('OVERVIEW')} className={`px-4 py-1.5 rounded-md text-sm font-bold transition-all ${activeTab === 'OVERVIEW' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-900'}`}>{t('overview')}</button>
                    <button onClick={() => setActiveTab('USERS')} className={`px-4 py-1.5 rounded-md text-sm font-bold transition-all ${activeTab === 'USERS' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-900'}`}>{t('staff_doctors')}</button>
                </div>
            </div>

            {activeTab === 'OVERVIEW' && <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <KPICard title={t('total_revenue')} value="154,000 EGP" icon={DollarSign} color="green" trend="15%" trendUp />
                <KPICard title={t('active_doctors')} value={doctorsCount} icon={Stethoscope} color="blue" subtitle={t('across_branches')} />
                <KPICard title={t('active_branches')} value={activeBranches} icon={Building2} color="purple" />
                <KPICard title={t('avg_utilization')} value="85%" icon={TrendingUp} color="amber" />
            </div>}

            {activeTab === 'USERS' && <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col h-full">
                <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-gray-50/50">
                    <h3 className="font-bold text-gray-900">{t('staff_directory')}</h3>
                    {isSuperAdmin && <button onClick={() => setIsCreatingUser(true)} className="flex items-center px-3 py-2 bg-primary-600 text-white rounded-lg text-sm font-bold hover:bg-primary-700 transition-colors"><Plus className="w-4 h-4 mr-2" /> {t('add_doctor')}</button>}
                </div>
                <div className="overflow-auto"><table className="min-w-full"><tbody>{filteredUsers.map((u) => <tr key={u.id}><td className="px-6 py-4">{u.name}</td><td>{u.specialty}</td><td>{u.assignedBranches.length}</td><td>{isSuperAdmin && <button onClick={() => setEditingUser(u)}>{t('edit')}</button>}</td></tr>)}</tbody></table></div>
            </div>}

            {(editingUser || isCreatingUser) && (
                <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl w-full max-w-4xl h-[90vh] flex flex-col overflow-hidden shadow-2xl">
                        <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
                            <h2 className="text-lg font-bold text-gray-900">{isCreatingUser ? t('add_new_doctor') : t('edit_user', { name: editingUser?.name })}</h2>
                            <button onClick={() => { setIsCreatingUser(false); setEditingUser(null); }} className="p-2 hover:bg-gray-200 rounded-full transition-colors"><XCircle className="w-5 h-5 text-gray-500" /></button>
                        </div>
                        <div className="flex-1 overflow-hidden">
                            <DoctorForm
                                initialData={editingUser || undefined}
                                branches={branches}
                                departments={departments}
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

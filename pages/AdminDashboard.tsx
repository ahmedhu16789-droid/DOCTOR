import React, { useEffect, useMemo, useState } from 'react';
import { User, UserRole, Branch, Department } from '../types';
import { MOCK_USERS, BRANCHES } from '../constants';
import { KPICard } from '../components/dashboard/KPICard';
import { DoctorForm } from '../components/forms/DoctorForm';
import { Building2, TrendingUp, DollarSign, Plus, XCircle, Stethoscope, Search } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { createDoctorViaApi, getBranchesFromApi, getDepartmentsFromApi, getDoctorsFromApi, updateDoctorViaApi, ApiDepartmentOption } from '../services/api';

interface AdminDashboardProps {
    currentUser: User;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ currentUser }) => {
    const { t, i18n } = useTranslation();
    const [activeTab, setActiveTab] = useState<'OVERVIEW' | 'USERS'>('OVERVIEW');
    const [users, setUsers] = useState<User[]>(MOCK_USERS.filter((u) => u.role === UserRole.DOCTOR));
    const [branches, setBranches] = useState<Branch[]>(BRANCHES);
    const [departments, setDepartments] = useState<ApiDepartmentOption[]>([]);
    const [editingUser, setEditingUser] = useState<User | null>(null);
    const [isCreatingUser, setIsCreatingUser] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedBranch, setSelectedBranch] = useState('ALL');
    const [selectedSpecialty, setSelectedSpecialty] = useState('ALL');

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
                // Keep local fallback in offline or restricted environments.
            }
        })();
    }, []);

    const branchNameMap = useMemo(
        () => Object.fromEntries(branches.map((branch) => [branch.id, branch.name])),
        [branches]
    );

    const specialtyLabelMap = useMemo(
        () => Object.fromEntries(departments.map((department) => [department.value, i18n.language === 'ar' ? department.labelAr : department.labelEn])),
        [departments, i18n.language]
    );

    const managedUsers = useMemo(() => users.filter((user) => {
        if (isSuperAdmin) return true;
        return user.assignedBranches.some((branchId) => managedBranches.includes(branchId));
    }), [users, isSuperAdmin, managedBranches]);

    const filteredUsers = useMemo(() => managedUsers.filter((user) => {
        const search = searchTerm.trim().toLowerCase();
        const matchesSearch = !search || user.name.toLowerCase().includes(search) || (user.phone ?? '').toLowerCase().includes(search);
        const matchesBranch = selectedBranch === 'ALL' || user.assignedBranches.includes(selectedBranch);
        const matchesSpecialty = selectedSpecialty === 'ALL' || user.specialty === selectedSpecialty;
        return matchesSearch && matchesBranch && matchesSpecialty;
    }), [managedUsers, searchTerm, selectedBranch, selectedSpecialty]);

    const doctorsCount = managedUsers.length;
    const activeBranches = branches.filter((branch) => branch.isActive).length;

    const handleSaveUser = async (savedUser: User) => {
        const persisted = isCreatingUser ? await createDoctorViaApi(savedUser) : await updateDoctorViaApi(savedUser);

        if (isCreatingUser) {
            setUsers((previous) => [...previous, persisted]);
        } else {
            setUsers((previous) => previous.map((user) => user.id === persisted.id ? persisted : user));
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

            {activeTab === 'OVERVIEW' && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <KPICard title={t('total_revenue')} value="154,000 EGP" icon={DollarSign} color="green" trend="15%" trendUp />
                    <KPICard title={t('active_doctors')} value={doctorsCount} icon={Stethoscope} color="blue" subtitle={t('across_branches')} />
                    <KPICard title={t('active_branches')} value={activeBranches} icon={Building2} color="purple" />
                    <KPICard title={t('avg_utilization')} value="85%" icon={TrendingUp} color="amber" />
                </div>
            )}

            {activeTab === 'USERS' && (
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col h-full">
                    <div className="p-4 border-b border-gray-200 flex flex-col lg:flex-row gap-3 lg:items-center lg:justify-between bg-gray-50/50">
                        <h3 className="font-bold text-gray-900">{t('staff_directory')}</h3>
                        <div className="flex flex-wrap gap-2 w-full lg:w-auto">
                            <div className="relative flex-1 min-w-[220px]">
                                <Search className="w-4 h-4 absolute top-1/2 -translate-y-1/2 left-3 text-gray-400" />
                                <input
                                    value={searchTerm}
                                    onChange={(event) => setSearchTerm(event.target.value)}
                                    placeholder={t('doctor_search_placeholder')}
                                    className="w-full rounded-lg border border-gray-300 bg-white pl-9 pr-3 py-2 text-sm"
                                />
                            </div>
                            <select value={selectedSpecialty} onChange={(event) => setSelectedSpecialty(event.target.value)} className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm min-w-[180px]">
                                <option value="ALL">{t('all_specialties')}</option>
                                {(departments.length ? departments : Object.values(Department).map((value) => ({ value, labelEn: value, labelAr: value }))).map((department) => (
                                    <option key={department.value} value={department.value}>{i18n.language === 'ar' ? department.labelAr : department.labelEn}</option>
                                ))}
                            </select>
                            <select value={selectedBranch} onChange={(event) => setSelectedBranch(event.target.value)} className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm min-w-[180px]">
                                <option value="ALL">{t('all_branches')}</option>
                                {branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
                            </select>
                            {isSuperAdmin && (
                                <button onClick={() => setIsCreatingUser(true)} className="flex items-center px-3 py-2 bg-primary-600 text-white rounded-lg text-sm font-bold hover:bg-primary-700 transition-colors">
                                    <Plus className="w-4 h-4 mr-2 rtl:ml-2 rtl:mr-0" /> {t('add_doctor')}
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="px-4 py-2 text-xs text-gray-500 border-b border-gray-100">{filteredUsers.length} {t('doctors_found')}</div>

                    <div className="overflow-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-4 py-3 text-start text-xs font-semibold text-gray-500 uppercase">{t('doctor')}</th>
                                    <th className="px-4 py-3 text-start text-xs font-semibold text-gray-500 uppercase">{t('department')}</th>
                                    <th className="px-4 py-3 text-start text-xs font-semibold text-gray-500 uppercase">{t('branches')}</th>
                                    <th className="px-4 py-3 text-start text-xs font-semibold text-gray-500 uppercase">{t('payroll_model')}</th>
                                    <th className="px-4 py-3 text-start text-xs font-semibold text-gray-500 uppercase">{t('amount')}</th>
                                    <th className="px-4 py-3 text-start text-xs font-semibold text-gray-500 uppercase">{t('actions')}</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {filteredUsers.map((user) => (
                                    <tr key={user.id} className="hover:bg-gray-50">
                                        <td className="px-4 py-3">
                                            <div className="font-semibold text-gray-900">{user.name}</div>
                                            <div className="text-xs text-gray-500">{user.phone || user.email || '-'}</div>
                                        </td>
                                        <td className="px-4 py-3 text-sm text-gray-700">{specialtyLabelMap[user.specialty as string] || user.specialty || '-'}</td>
                                        <td className="px-4 py-3">
                                            <div className="flex flex-wrap gap-1">
                                                {user.assignedBranches.map((branchId) => (
                                                    <span key={branchId} className="px-2 py-1 text-xs rounded-full bg-primary-50 text-primary-700 border border-primary-100">
                                                        {branchNameMap[branchId] || branchId}
                                                    </span>
                                                ))}
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-sm text-gray-700">{user.payroll?.model || '-'}</td>
                                        <td className="px-4 py-3 text-sm text-gray-700">{user.consultationFee ?? 0} EGP</td>
                                        <td className="px-4 py-3">
                                            {isSuperAdmin && (
                                                <button onClick={() => setEditingUser(user)} className="text-primary-600 hover:text-primary-800 text-sm font-semibold">
                                                    {t('edit')}
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                                {filteredUsers.length === 0 && (
                                    <tr>
                                        <td colSpan={6} className="px-4 py-8 text-center text-sm text-gray-500">{t('no_doctors_found')}</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {(editingUser || isCreatingUser) && (
                <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl w-full max-w-5xl h-[92vh] flex flex-col overflow-hidden shadow-2xl">
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

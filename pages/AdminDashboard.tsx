import React, { useEffect, useMemo, useState } from 'react';
import { User, UserRole, Branch, Department } from '../types';
import { MOCK_USERS, BRANCHES } from '../constants';
import { KPICard } from '../components/dashboard/KPICard';
import { DoctorForm } from '../components/forms/DoctorForm';
import { Building2, TrendingUp, DollarSign, Plus, XCircle, Stethoscope, Search, Phone, Mail, Filter, Link2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { createAccessLinkViaApi, createDoctorViaApi, getBranchesFromApi, getDepartmentsFromApi, getDoctorsFromApi, updateDoctorViaApi, ApiDepartmentOption } from '../services/api';

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
    const [departmentFilter, setDepartmentFilter] = useState('ALL');
    const [branchFilter, setBranchFilter] = useState('ALL');

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


    const departmentOptions = departments.length
        ? departments
        : Object.values(Department).map((department) => ({ value: department, labelAr: department, labelEn: department }));

    const filteredUsers = useMemo(() => users.filter(u => {
        const branchScopedUser = isSuperAdmin || u.assignedBranches.some(b => managedBranches.includes(b));
        if (!branchScopedUser) return false;

        const matchesSearch = !searchTerm.trim() || [u.name, u.email, u.phone, u.specialty]
            .filter(Boolean)
            .some((value) => value!.toLowerCase().includes(searchTerm.trim().toLowerCase()));
        const matchesDepartment = departmentFilter === 'ALL' || u.specialty === departmentFilter;
        const matchesBranch = branchFilter === 'ALL' || u.assignedBranches.includes(branchFilter);

        return matchesSearch && matchesDepartment && matchesBranch;
    }), [users, isSuperAdmin, managedBranches, searchTerm, departmentFilter, branchFilter]);

    const doctorsCount = filteredUsers.length;
    const activeBranches = branches.filter(b => b.isActive).length;



    const handleGenerateAccessLink = async (user: User): Promise<void> => {
        try {
            const { token } = await createAccessLinkViaApi(user.id);
            const link = `${window.location.origin}${window.location.pathname}?accessToken=${encodeURIComponent(token)}`;
            await navigator.clipboard.writeText(link);
            alert(t('copy_link_done'));
        } catch (error) {
            const message = error instanceof Error && error.message === 'User has no email'
                ? t('copy_link_missing_email')
                : (error instanceof Error ? error.message : t('copy_link_missing_email'));
            alert(message);
        }
    };

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
                <div className="p-4 border-b border-gray-200 bg-white grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="relative">
                        <Search className="w-4 h-4 text-gray-400 absolute top-1/2 -translate-y-1/2 left-3 rtl:right-3 rtl:left-auto" />
                        <input
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder={t('search_employees')}
                            className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-3 rtl:pr-9 rtl:pl-3 text-sm focus:ring-primary-500 focus:border-primary-500"
                        />
                    </div>
                    <select value={departmentFilter} onChange={(e) => setDepartmentFilter(e.target.value)} className="rounded-lg border border-gray-300 py-2 px-3 text-sm focus:ring-primary-500 focus:border-primary-500">
                        <option value="ALL">{t('all_departments')}</option>
                        {departmentOptions.map((department) => (
                            <option key={department.value} value={department.value}>{i18n.language === 'ar' ? department.labelAr : department.labelEn}</option>
                        ))}
                    </select>
                    <select value={branchFilter} onChange={(e) => setBranchFilter(e.target.value)} className="rounded-lg border border-gray-300 py-2 px-3 text-sm focus:ring-primary-500 focus:border-primary-500">
                        <option value="ALL">{t('all_branches')}</option>
                        {branches.map((branch) => (
                            <option key={branch.id} value={branch.id}>{branch.name}</option>
                        ))}
                    </select>
                </div>
                <div className="overflow-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left rtl:text-right text-xs font-bold text-gray-500 uppercase">{t('doctor_details')}</th>
                                <th className="px-6 py-3 text-left rtl:text-right text-xs font-bold text-gray-500 uppercase">{t('department')}</th>
                                <th className="px-6 py-3 text-left rtl:text-right text-xs font-bold text-gray-500 uppercase">{t('branches')}</th>
                                <th className="px-6 py-3 text-left rtl:text-right text-xs font-bold text-gray-500 uppercase">{t('payroll_model')}</th>
                                <th className="px-6 py-3 text-right rtl:text-left text-xs font-bold text-gray-500 uppercase">{t('actions')}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {filteredUsers.map((u) => (
                                <tr key={u.id} className="hover:bg-gray-50/70">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="h-10 w-10 rounded-full bg-primary-100 text-primary-700 font-bold flex items-center justify-center">{u.name.charAt(0)}</div>
                                            <div>
                                                <p className="font-semibold text-gray-900">{u.name}</p>
                                                <div className="text-xs text-gray-500 space-y-1">
                                                    {u.phone && <p className="flex items-center gap-1"><Phone className="w-3 h-3" /> {u.phone}</p>}
                                                    {u.email && <p className="flex items-center gap-1"><Mail className="w-3 h-3" /> {u.email}</p>}
                                                </div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-sm text-gray-700">{u.specialty || '-'}</td>
                                    <td className="px-6 py-4">
                                        <div className="flex flex-wrap gap-1.5">
                                            {u.assignedBranches.map((branchId) => {
                                                const branchName = branches.find((branch) => branch.id === branchId)?.name || branchId;
                                                return <span key={branchId} className="px-2 py-1 text-xs rounded-full bg-blue-50 text-blue-700 border border-blue-200">{branchName}</span>;
                                            })}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-sm text-gray-700">{u.payroll?.model?.replace('_', ' ') || '-'}</td>
                                    <td className="px-6 py-4 text-right rtl:text-left">
                                        {isSuperAdmin && (
                                            <div className="inline-flex items-center gap-3">
                                                <button onClick={() => setEditingUser(u)} className="text-primary-700 font-medium hover:text-primary-900">{t('edit')}</button>
                                                <button onClick={() => handleGenerateAccessLink(u)} className="text-blue-700 font-medium hover:text-blue-900 inline-flex items-center gap-1">
                                                    <Link2 className="w-4 h-4" /> {t('copy_access_link')}
                                                </button>
                                            </div>
                                        )}
                                    </td>
                                </tr>
                            ))}
                            {!filteredUsers.length && (
                                <tr>
                                    <td colSpan={5} className="px-6 py-10 text-center text-sm text-gray-500">
                                        <Filter className="mx-auto mb-2 w-4 h-4 text-gray-400" />
                                        {t('no_doctors_match_filters')}
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
                <div className="px-4 py-2 bg-gray-50 text-xs text-gray-500 border-t border-gray-200">
                    {t('doctors_count_label', { count: filteredUsers.length })}
                </div>
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

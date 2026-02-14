import React, { useState, useEffect, useMemo } from 'react';
import { User, Employee, UserRole, Branch } from '../types';
import { EmployeeForm } from '../components/forms/EmployeeForm';
import { UserPlus, Search, MapPin, DollarSign, Clock } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { createEmployeeViaApi, getBranchesFromApi, getEmployeesFromApi, getRolesFromApi, updateEmployeeViaApi } from '../services/api';

interface EmployeeManagementProps {
  currentUser: User;
}

const DEFAULT_ROLES: UserRole[] = [UserRole.RECEPTIONIST, UserRole.NURSE, UserRole.PHARMACY_MANAGER, UserRole.BRANCH_MANAGER];

export const EmployeeManagement: React.FC<EmployeeManagementProps> = () => {
  const { t } = useTranslation();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [roleOptions, setRoleOptions] = useState<UserRole[]>(DEFAULT_ROLES);
  const [loading, setLoading] = useState(true);
  const [selectedEmp, setSelectedEmp] = useState<Employee | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRole, setSelectedRole] = useState('');

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const [empData, branchData, roleData] = await Promise.all([
          getEmployeesFromApi(),
          getBranchesFromApi(),
          getRolesFromApi(),
        ]);

        setEmployees(empData as Employee[]);
        setBranches(branchData);

        // Filter out DOCTOR role - doctors have their own DoctorForm
        const apiRoles = roleData.map((r) => r.value).filter((role) => Object.values(UserRole).includes(role) && role !== 'DOCTOR');
        setRoleOptions(apiRoles.length > 0 ? Array.from(new Set(apiRoles)) : DEFAULT_ROLES.filter(r => r !== UserRole.DOCTOR));
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  const handleSaveEmployee = async (emp: Employee) => {
    const saved = isCreating
      ? await createEmployeeViaApi(emp)
      : await updateEmployeeViaApi(emp);

    if (isCreating) {
      setEmployees((prev) => [...prev, saved as Employee]);
    } else {
      setEmployees((prev) => prev.map((e) => e.id === saved.id ? saved as Employee : e));
    }

    setIsCreating(false);
    setSelectedEmp(null);
  };

  const getBranchNames = (ids: string[]) => {
    return ids.map(id => branches.find(b => b.id === id)?.name).filter(Boolean).join(', ');
  };

  const visibleEmployees = useMemo(() => employees.filter((emp) => {
    const matchesName = searchTerm.trim() ? emp.name.toLowerCase().includes(searchTerm.toLowerCase()) : true;
    const matchesRole = selectedRole ? emp.role === selectedRole : true;
    return matchesName && matchesRole;
  }), [employees, searchTerm, selectedRole]);

  if (loading) {
    return (
      <div className="w-full h-96 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('employee_mgmt')}</h1>
          <p className="text-sm text-gray-500">{t('employee_desc')}</p>
        </div>
        <button
          onClick={() => setIsCreating(true)}
          className="flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg font-bold hover:bg-primary-700 shadow-sm"
        >
          <UserPlus className="w-4 h-4 mr-2 rtl:ml-2 rtl:mr-0" /> {t('add_employee')}
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-4 border-b border-gray-200 bg-gray-50 flex gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 rtl:right-3 rtl:left-auto top-2.5 text-gray-400 w-4 h-4" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={t('search_employees')}
              className="w-full pl-9 rtl:pr-9 rtl:pl-4 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-primary-500 focus:border-primary-500"
            />
          </div>
          <select value={selectedRole} onChange={(e) => setSelectedRole(e.target.value)} className="border-gray-300 rounded-lg text-sm">
            <option value="">{t('all_roles')}</option>
            {roleOptions.map((role) => (
              <option key={role} value={role}>{t(role.toLowerCase() as any)}</option>
            ))}
          </select>
        </div>

        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-white">
            <tr>
              <th className="px-6 py-3 text-left rtl:text-right text-xs font-bold text-gray-500 uppercase tracking-wider">{t('employee')}</th>
              <th className="px-6 py-3 text-left rtl:text-right text-xs font-bold text-gray-500 uppercase tracking-wider">{t('role_branch')}</th>
              <th className="px-6 py-3 text-left rtl:text-right text-xs font-bold text-gray-500 uppercase tracking-wider">{t('payroll_model')}</th>
              <th className="px-6 py-3 text-right rtl:text-left text-xs font-bold text-gray-500 uppercase tracking-wider">{t('actions')}</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {visibleEmployees.map(emp => (
              <tr key={emp.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <div className="h-10 w-10 rounded-full bg-primary-100 flex items-center justify-center text-primary-600 font-bold">
                      {emp.name.charAt(0)}
                    </div>
                    <div className="ml-4 rtl:mr-4 rtl:ml-0">
                      <div className="text-sm font-bold text-gray-900">{emp.name}</div>
                      <div className="text-xs text-gray-500">{emp.jobTitle}</div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 mb-1">
                    {t(emp.role.toLowerCase() as any)}
                  </span>
                  <div className="text-xs text-gray-500 flex items-center mt-1">
                    <MapPin className="w-3 h-3 mr-1 rtl:ml-1 rtl:mr-0" />
                    {getBranchNames(emp.assignedBranches)}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex flex-col">
                    <span className="text-sm font-medium text-gray-900 flex items-center">
                      <DollarSign className="w-3 h-3 mr-1 rtl:ml-1 rtl:mr-0 text-gray-400" />
                      {emp.payroll?.baseSalary?.toLocaleString() ?? 0} EGP
                    </span>
                    <span className="text-xs text-gray-500 capitalize">{emp.payroll?.model.replace('_', ' ').toLowerCase()}</span>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right rtl:text-left text-sm font-medium">
                  <button
                    onClick={() => setSelectedEmp(emp)}
                    className="text-primary-600 hover:text-primary-900 flex items-center justify-end rtl:justify-start gap-1 inline-flex"
                  >
                    <Clock className="w-4 h-4" /> {t('manage')}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {(selectedEmp || isCreating) && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-4xl h-[90vh] flex flex-col overflow-hidden">
            <div className="p-4 border-b border-gray-200 flex justify-between items-center">
              <h2 className="text-xl font-bold text-gray-900">
                {isCreating ? t('add_new_employee') : t('edit_user', { name: selectedEmp?.name })}
              </h2>
              <button onClick={() => { setIsCreating(false); setSelectedEmp(null); }} className="p-2 hover:bg-gray-100 rounded-full">
                <span className="sr-only">Close</span>
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="flex-1 overflow-hidden">
              <EmployeeForm
                initialData={selectedEmp || undefined}
                branches={branches}
                roleOptions={roleOptions}
                onSave={handleSaveEmployee}
                onCancel={() => { setIsCreating(false); setSelectedEmp(null); }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

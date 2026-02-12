import React, { useState, useEffect } from 'react';
import { User, Employee, UserRole } from '../types';
import { MOCK_EMPLOYEES } from '../services/mockData';
import { EmployeeForm } from '../components/forms/EmployeeForm';
import { UserPlus, Search, MapPin, DollarSign, Clock } from 'lucide-react';
import { BRANCHES } from '../constants';

interface EmployeeManagementProps {
  currentUser: User;
}

export const EmployeeManagement: React.FC<EmployeeManagementProps> = ({ currentUser }) => {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEmp, setSelectedEmp] = useState<Employee | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    // Simulate API fetch
    setTimeout(() => {
        setEmployees(MOCK_EMPLOYEES);
        setLoading(false);
    }, 500);
  }, []);

  const handleSaveEmployee = (emp: Employee) => {
    if (isCreating) {
        setEmployees([...employees, emp]);
    } else {
        setEmployees(employees.map(e => e.id === emp.id ? emp : e));
    }
    setIsCreating(false);
    setSelectedEmp(null);
  };

  const getBranchNames = (ids: string[]) => {
      return ids.map(id => BRANCHES.find(b => b.id === id)?.name).join(', ');
  };

  if (loading) {
      return (
          <div className="w-full h-96 flex items-center justify-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
          </div>
      );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
              <h1 className="text-2xl font-bold text-gray-900">Employee Management</h1>
              <p className="text-sm text-gray-500">Manage HR, Payroll configuration, and Staff Shifts</p>
          </div>
          <button 
            onClick={() => setIsCreating(true)}
            className="flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg font-bold hover:bg-primary-700 shadow-sm"
          >
              <UserPlus className="w-4 h-4 mr-2" /> Add Employee
          </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-4 border-b border-gray-200 bg-gray-50 flex gap-4">
                <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-2.5 text-gray-400 w-4 h-4" />
                    <input 
                        type="text" 
                        placeholder="Search employees..." 
                        className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-primary-500 focus:border-primary-500"
                    />
                </div>
                <select className="border-gray-300 rounded-lg text-sm">
                    <option>All Roles</option>
                    <option>Nurse</option>
                    <option>Receptionist</option>
                </select>
            </div>
            
            <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-white">
                    <tr>
                        <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Employee</th>
                        <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Role & Branch</th>
                        <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Payroll Model</th>
                        <th className="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">Actions</th>
                    </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                    {employees.map(emp => (
                        <tr key={emp.id} className="hover:bg-gray-50 transition-colors">
                            <td className="px-6 py-4 whitespace-nowrap">
                                <div className="flex items-center">
                                    <div className="h-10 w-10 rounded-full bg-primary-100 flex items-center justify-center text-primary-600 font-bold">
                                        {emp.name.charAt(0)}
                                    </div>
                                    <div className="ml-4">
                                        <div className="text-sm font-bold text-gray-900">{emp.name}</div>
                                        <div className="text-xs text-gray-500">{emp.jobTitle}</div>
                                    </div>
                                </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 mb-1">
                                    {emp.role.replace('_', ' ')}
                                </span>
                                <div className="text-xs text-gray-500 flex items-center mt-1">
                                    <MapPin className="w-3 h-3 mr-1" />
                                    {getBranchNames(emp.assignedBranches)}
                                </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                                <div className="flex flex-col">
                                    <span className="text-sm font-medium text-gray-900 flex items-center">
                                        <DollarSign className="w-3 h-3 mr-1 text-gray-400" />
                                        {emp.payroll?.baseSalary?.toLocaleString()} EGP
                                    </span>
                                    <span className="text-xs text-gray-500 capitalize">{emp.payroll?.model.replace('_', ' ').toLowerCase()}</span>
                                </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                <button 
                                    onClick={() => setSelectedEmp(emp)}
                                    className="text-primary-600 hover:text-primary-900 mr-4 flex items-center justify-end gap-1 inline-flex"
                                >
                                    <Clock className="w-4 h-4" /> Manage
                                </button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
      </div>

      {/* Employee Editor Modal */}
      {(selectedEmp || isCreating) && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-2xl w-full max-w-4xl h-[90vh] flex flex-col overflow-hidden">
                  <div className="p-4 border-b border-gray-200 flex justify-between items-center">
                      <h2 className="text-xl font-bold text-gray-900">
                          {isCreating ? 'Add New Employee' : `Edit ${selectedEmp?.name}`}
                      </h2>
                      <button onClick={() => { setIsCreating(false); setSelectedEmp(null); }} className="p-2 hover:bg-gray-100 rounded-full">
                          <span className="sr-only">Close</span>
                          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                      </button>
                  </div>
                  <div className="flex-1 overflow-hidden">
                      <EmployeeForm 
                        initialData={selectedEmp || undefined}
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
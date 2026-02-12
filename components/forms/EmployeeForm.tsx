import React from 'react';
import { useForm, Controller } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { BRANCHES } from '../../constants';
import { ScheduleGrid } from './ScheduleGrid';
import { BranchSelector } from './BranchSelector';
import { Employee, UserRole } from '../../types';
import { Save, User as UserIcon } from 'lucide-react';

// --- Validation Schema ---
const employeeSchema = z.object({
  name: z.string().min(3, 'Name is required'),
  phone: z.string().min(10, 'Valid phone required'),
  email: z.string().email().optional().or(z.literal('')),
  jobTitle: z.string().min(2),
  role: z.nativeEnum(UserRole),
  assignedBranches: z.array(z.string()).min(1, 'Select at least one branch'),
  payroll: z.object({
    model: z.literal('FIXED_SALARY'),
    baseSalary: z.number().min(0),
  }),
  schedule: z.array(z.any()).optional() // Reuse schedule structure for shifts
});

type EmployeeFormValues = z.infer<typeof employeeSchema>;

interface EmployeeFormProps {
  initialData?: Employee;
  onSave: (data: Employee) => void;
  onCancel: () => void;
}

export const EmployeeForm: React.FC<EmployeeFormProps> = ({ initialData, onSave, onCancel }) => {
  const { register, control, handleSubmit, watch, formState: { errors, isSubmitting } } = useForm<EmployeeFormValues>({
    resolver: zodResolver(employeeSchema),
    defaultValues: {
      name: initialData?.name || '',
      phone: initialData?.phone || '',
      email: initialData?.email || '',
      jobTitle: initialData?.jobTitle || '',
      role: initialData?.role || UserRole.RECEPTIONIST,
      assignedBranches: initialData?.assignedBranches || [],
      payroll: initialData?.payroll || { model: 'FIXED_SALARY', baseSalary: 0 },
      schedule: initialData?.schedule || []
    }
  });
  
  const assignedBranchIds = watch('assignedBranches');

  const onSubmit = async (data: EmployeeFormValues) => {
    const payload: Employee = {
        id: initialData?.id || Math.random().toString(),
        status: 'ACTIVE',
        ...data,
        schedule: data.schedule?.map((s: any) => ({ ...s, id: s.id || Math.random().toString(), branchId: s.branchId || assignedBranchIds[0] }))
    } as Employee;
    
    await new Promise(resolve => setTimeout(resolve, 800));
    onSave(payload);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="h-full flex flex-col">
      <div className="flex-1 overflow-y-auto p-6 space-y-8">
         
         {/* Basic Info */}
         <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
             <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
                 <UserIcon className="w-5 h-5 mr-2 text-primary-600" /> Employee Information
             </h3>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                    <label className="block text-sm font-medium text-gray-700">Full Name</label>
                    <input {...register('name')} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm border p-2" />
                    {errors.name && <p className="mt-1 text-xs text-red-600">{errors.name.message}</p>}
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700">Phone</label>
                    <input {...register('phone')} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm border p-2" />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700">Job Title</label>
                    <input {...register('jobTitle')} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm border p-2" placeholder="e.g. Senior Nurse" />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700">System Role</label>
                    <select {...register('role')} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm border p-2">
                        <option value={UserRole.RECEPTIONIST}>Receptionist</option>
                        <option value={UserRole.NURSE}>Nurse</option>
                        <option value={UserRole.PHARMACY_MANAGER}>Pharmacy Manager</option>
                        <option value={UserRole.BRANCH_MANAGER}>Branch Manager</option>
                    </select>
                </div>
                <div className="md:col-span-2">
                    <Controller
                      name="assignedBranches"
                      control={control}
                      render={({ field }) => (
                        <BranchSelector
                          branches={BRANCHES}
                          selectedIds={field.value}
                          onChange={field.onChange}
                          error={errors.assignedBranches?.message}
                        />
                      )}
                    />
                </div>
             </div>
         </div>

         {/* Payroll */}
         <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
             <h3 className="text-lg font-bold text-gray-900 mb-4">Compensation</h3>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 <div>
                    <label className="block text-sm font-medium text-gray-700">Monthly Salary (EGP)</label>
                    <input {...register('payroll.baseSalary', { valueAsNumber: true })} type="number" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm border p-2" />
                 </div>
             </div>
         </div>

         {/* Shift Schedule */}
         <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
             <h3 className="text-lg font-bold text-gray-900 mb-4">Shift Configuration</h3>
             <ScheduleGrid 
                control={control} 
                name="schedule" 
                assignedBranchIds={assignedBranchIds} 
             />
         </div>
      </div>

      <div className="border-t border-gray-200 px-6 py-4 bg-gray-50 flex justify-end gap-3">
         <button type="button" onClick={onCancel} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">
             Cancel
         </button>
         <button 
            type="submit" 
            disabled={isSubmitting}
            className="px-6 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 flex items-center"
         >
             <Save className="w-4 h-4 mr-2" /> Save Employee
         </button>
      </div>
    </form>
  );
};
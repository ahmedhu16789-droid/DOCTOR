import React, { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { BRANCHES } from '../../constants';
import { ScheduleGrid } from './ScheduleGrid';
import { BranchSelector } from './BranchSelector';
import { User, UserRole, Department } from '../../types';
import { Save, Stethoscope, Building2, Wallet, XCircle } from 'lucide-react';

// --- Validation Schema ---
const doctorSchema = z.object({
  name: z.string().min(3, 'Name is required'),
  phone: z.string().min(10, 'Valid phone required'),
  email: z.string().email().optional().or(z.literal('')),
  specialty: z.nativeEnum(Department),
  role: z.literal(UserRole.DOCTOR),
  consultationFee: z.number().min(0),
  assignedBranches: z.array(z.string()).min(1, 'Select at least one branch'),
  payroll: z.object({
    model: z.enum(['FIXED_SALARY', 'PERCENTAGE', 'HYBRID']),
    baseSalary: z.number().min(0),
    commissionPercentage: z.number().min(0).max(100).optional(),
  }),
  schedule: z.array(z.object({
     dayOfWeek: z.number(),
     startTime: z.string(),
     endTime: z.string(),
     slotDuration: z.number(),
     branchId: z.string().optional()
  })).optional()
});

type DoctorFormValues = z.infer<typeof doctorSchema>;

interface DoctorFormProps {
  initialData?: User;
  onSave: (data: User) => void;
  onCancel: () => void;
}

export const DoctorForm: React.FC<DoctorFormProps> = ({ initialData, onSave, onCancel }) => {
  const [activeTab, setActiveTab] = useState<'BASIC' | 'SCHEDULE' | 'PAYMENT'>('BASIC');
  
  const { register, control, handleSubmit, watch, formState: { errors, isSubmitting } } = useForm<DoctorFormValues>({
    resolver: zodResolver(doctorSchema),
    defaultValues: {
      name: initialData?.name || '',
      phone: initialData?.phone || '',
      email: initialData?.email || '',
      specialty: initialData?.specialty || Department.INTERNAL_MEDICINE,
      role: UserRole.DOCTOR,
      consultationFee: initialData?.consultationFee || 0,
      assignedBranches: initialData?.assignedBranches || [],
      payroll: initialData?.payroll || { model: 'PERCENTAGE', baseSalary: 0, commissionPercentage: 0 },
      schedule: initialData?.schedule || []
    }
  });

  const paymentModel = watch('payroll.model');
  const assignedBranchIds = watch('assignedBranches');

  const onSubmit = async (data: DoctorFormValues) => {
    // In a real app, you would inject the ID here or in the backend
    const userPayload: User = {
        id: initialData?.id || Math.random().toString(),
        status: 'ACTIVE',
        ...data,
        // Ensure schedule items have IDs
        schedule: data.schedule?.map(s => ({ ...s, id: s.id || Math.random().toString(), branchId: s.branchId || assignedBranchIds[0] })) 
    } as User;
    
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 800));
    onSave(userPayload);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="h-full flex flex-col">
      {/* Tabs */}
      <div className="flex border-b border-gray-200 bg-gray-50 px-6">
        <button
            type="button"
            onClick={() => setActiveTab('BASIC')}
            className={`py-4 px-6 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'BASIC' ? 'border-primary-600 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
        >
            <Stethoscope className="w-4 h-4" /> Basic Info
        </button>
        <button
            type="button"
            onClick={() => setActiveTab('SCHEDULE')}
            className={`py-4 px-6 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'SCHEDULE' ? 'border-primary-600 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
        >
            <Building2 className="w-4 h-4" /> Branches & Schedule
        </button>
        <button
            type="button"
            onClick={() => setActiveTab('PAYMENT')}
            className={`py-4 px-6 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'PAYMENT' ? 'border-primary-600 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
        >
            <Wallet className="w-4 h-4" /> Financials
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        
        {/* Basic Info Section */}
        {activeTab === 'BASIC' && (
            <div className="max-w-2xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-2">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="col-span-2">
                        <label className="block text-sm font-medium text-gray-700">Full Name</label>
                        <input {...register('name')} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 border p-2" />
                        {errors.name && <p className="mt-1 text-xs text-red-600">{errors.name.message as string}</p>}
                    </div>
                    
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Phone Number</label>
                        <input {...register('phone')} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 border p-2" />
                        {errors.phone && <p className="mt-1 text-xs text-red-600">{errors.phone.message as string}</p>}
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700">Email (Optional)</label>
                        <input {...register('email')} type="email" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 border p-2" />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700">Specialty</label>
                        <select {...register('specialty')} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 border p-2">
                            {Object.values(Department).map(d => (
                                <option key={d} value={d}>{d}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700">Standard Consultation Fee</label>
                        <div className="relative mt-1 rounded-md shadow-sm">
                            <input 
                                {...register('consultationFee', { valueAsNumber: true })} 
                                type="number" 
                                className="block w-full rounded-md border-gray-300 pl-3 pr-12 focus:border-primary-500 focus:ring-primary-500 border p-2" 
                            />
                            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
                                <span className="text-gray-500 sm:text-sm">EGP</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        )}

        {/* Schedule Section */}
        {activeTab === 'SCHEDULE' && (
            <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-2">
                <div>
                    <h3 className="text-lg font-medium text-gray-900 mb-4">Branch Assignment</h3>
                    
                    <Controller
                      name="assignedBranches"
                      control={control}
                      render={({ field }) => (
                        <BranchSelector
                          branches={BRANCHES}
                          selectedIds={field.value}
                          onChange={field.onChange}
                          error={errors.assignedBranches?.message as string}
                        />
                      )}
                    />
                </div>

                <div className="border-t border-gray-200 pt-6">
                    <h3 className="text-lg font-medium text-gray-900 mb-4">Weekly Schedule</h3>
                    <ScheduleGrid 
                        control={control} 
                        name="schedule" 
                        assignedBranchIds={assignedBranchIds} 
                    />
                </div>
            </div>
        )}

        {/* Payment Section */}
        {activeTab === 'PAYMENT' && (
            <div className="max-w-2xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-2">
                <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
                    <label className="block text-sm font-medium text-gray-700 mb-4">Compensation Model</label>
                    <div className="grid grid-cols-3 gap-3">
                        {['FIXED_SALARY', 'PERCENTAGE', 'HYBRID'].map((model) => (
                            <label key={model} className={`
                                flex flex-col items-center justify-center p-3 border rounded-lg cursor-pointer transition-all
                                ${paymentModel === model ? 'bg-primary-50 border-primary-500 text-primary-700 ring-1 ring-primary-500' : 'bg-white border-gray-200 hover:bg-gray-50'}
                            `}>
                                <input type="radio" {...register('payroll.model')} value={model} className="sr-only" />
                                <span className="text-xs font-bold">{model.replace('_', ' ')}</span>
                            </label>
                        ))}
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {(paymentModel === 'FIXED_SALARY' || paymentModel === 'HYBRID') && (
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Monthly Base Salary</label>
                            <div className="relative mt-1 rounded-md shadow-sm">
                                <input 
                                    {...register('payroll.baseSalary', { valueAsNumber: true })} 
                                    type="number" 
                                    className="block w-full rounded-md border-gray-300 pl-3 pr-12 focus:border-primary-500 focus:ring-primary-500 border p-2" 
                                />
                                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
                                    <span className="text-gray-500 sm:text-sm">EGP</span>
                                </div>
                            </div>
                        </div>
                    )}

                    {(paymentModel === 'PERCENTAGE' || paymentModel === 'HYBRID') && (
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Commission Rate</label>
                            <div className="relative mt-1 rounded-md shadow-sm">
                                <input 
                                    {...register('payroll.commissionPercentage', { valueAsNumber: true })} 
                                    type="number" 
                                    className="block w-full rounded-md border-gray-300 pl-3 pr-12 focus:border-primary-500 focus:ring-primary-500 border p-2" 
                                />
                                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
                                    <span className="text-gray-500 sm:text-sm">%</span>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        )}
      </div>

      {/* Footer Actions */}
      <div className="border-t border-gray-200 px-6 py-4 bg-gray-50 flex justify-end gap-3">
         <button type="button" onClick={onCancel} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">
             Cancel
         </button>
         <button 
            type="submit" 
            disabled={isSubmitting}
            className="px-6 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 flex items-center"
         >
             {isSubmitting ? (
                 <>Saving...</>
             ) : (
                 <><Save className="w-4 h-4 mr-2" /> Save Doctor</>
             )}
         </button>
      </div>
    </form>
  );
};
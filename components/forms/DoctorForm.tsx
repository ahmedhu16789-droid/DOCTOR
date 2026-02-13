import React, { useMemo, useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { ScheduleGrid } from './ScheduleGrid';
import { BranchSelector } from './BranchSelector';
import { User, UserRole, Department, Branch } from '../../types';
import { Save, Stethoscope, Building2, Wallet } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { ApiDepartmentOption } from '../../services/api';

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
        id: z.string().optional(),
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
    branches: Branch[];
    departments: ApiDepartmentOption[];
    onSave: (data: User) => Promise<void> | void;
    onCancel: () => void;
}

export const DoctorForm: React.FC<DoctorFormProps> = ({ initialData, branches, departments, onSave, onCancel }) => {
    const { t, i18n } = useTranslation();
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

    const selectedBranchesCount = assignedBranchIds?.length ?? 0;
    const specialtyOptions = useMemo(
        () => departments.length
            ? departments
            : Object.values(Department).map((value) => ({ value, labelEn: value, labelAr: value })),
        [departments]
    );

    const onSubmit = async (data: DoctorFormValues) => {
        const userPayload: User = {
            id: initialData?.id || Math.random().toString(),
            status: 'ACTIVE',
            ...data,
            schedule: data.schedule?.map((shift) => ({ ...shift, id: shift.id || Math.random().toString(), branchId: shift.branchId || assignedBranchIds[0] }))
        } as User;

        await onSave(userPayload);
    };

    const tabClass = (tab: 'BASIC' | 'SCHEDULE' | 'PAYMENT') => (
        `py-4 px-5 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 ${activeTab === tab ? 'border-primary-600 text-primary-600 bg-white' : 'border-transparent text-gray-500 hover:text-gray-700'}`
    );

    return (
        <form onSubmit={handleSubmit(onSubmit)} className="h-full flex flex-col bg-gray-50/60">
            <div className="flex border-b border-gray-200 bg-gray-100 px-6 overflow-x-auto">
                <button type="button" onClick={() => setActiveTab('BASIC')} className={tabClass('BASIC')}>
                    <Stethoscope className="w-4 h-4" /> {t('basic_info')}
                </button>
                <button type="button" onClick={() => setActiveTab('SCHEDULE')} className={tabClass('SCHEDULE')}>
                    <Building2 className="w-4 h-4" /> {t('branches')} & {t('schedule')}
                </button>
                <button type="button" onClick={() => setActiveTab('PAYMENT')} className={tabClass('PAYMENT')}>
                    <Wallet className="w-4 h-4" /> {t('financial_reports')}
                </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
                {activeTab === 'BASIC' && (
                    <div className="max-w-4xl mx-auto space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            <div className="rounded-xl bg-white border border-gray-200 p-4">
                                <p className="text-xs text-gray-500">{t('department')}</p>
                                <p className="text-sm font-bold text-gray-900">{watch('specialty')}</p>
                            </div>
                            <div className="rounded-xl bg-white border border-gray-200 p-4">
                                <p className="text-xs text-gray-500">{t('branches')}</p>
                                <p className="text-sm font-bold text-gray-900">{selectedBranchesCount}</p>
                            </div>
                            <div className="rounded-xl bg-white border border-gray-200 p-4">
                                <p className="text-xs text-gray-500">{t('amount')}</p>
                                <p className="text-sm font-bold text-gray-900">{watch('consultationFee') || 0} EGP</p>
                            </div>
                        </div>

                        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-5">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="md:col-span-2">
                                    <label className="block text-sm font-medium text-gray-700">{t('full_name')}</label>
                                    <input {...register('name')} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm border p-2" />
                                    {errors.name && <p className="mt-1 text-xs text-red-600">{errors.name.message as string}</p>}
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">{t('phone_number')}</label>
                                    <input {...register('phone')} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm border p-2" placeholder="01xxxxxxxxx" />
                                    {errors.phone && <p className="mt-1 text-xs text-red-600">{errors.phone.message as string}</p>}
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Email</label>
                                    <input {...register('email')} type="email" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm border p-2" placeholder="doctor@clinic.com" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">{t('department')}</label>
                                    <select {...register('specialty')} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm border p-2">
                                        {specialtyOptions.map((option) => (
                                            <option key={option.value} value={option.value}>{i18n.language === 'ar' ? option.labelAr : option.labelEn}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">{t('consultation_fee')}</label>
                                    <input {...register('consultationFee', { valueAsNumber: true })} type="number" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm border p-2" />
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'SCHEDULE' && (
                    <div className="max-w-5xl mx-auto space-y-6">
                        <div className="bg-white rounded-xl border border-gray-200 p-5">
                            <h3 className="text-sm font-bold text-gray-800 mb-3">{t('branch_assignment')}</h3>
                            <Controller
                                name="assignedBranches"
                                control={control}
                                render={({ field }) => (
                                    <BranchSelector
                                        branches={branches}
                                        selectedIds={field.value}
                                        onChange={field.onChange}
                                        error={errors.assignedBranches?.message as string}
                                    />
                                )}
                            />
                        </div>

                        <div className="bg-white rounded-xl border border-gray-200 p-5">
                            <h3 className="text-sm font-bold text-gray-800 mb-3">{t('weekly_schedule')}</h3>
                            <ScheduleGrid control={control} name="schedule" assignedBranchIds={assignedBranchIds} branches={branches} />
                        </div>
                    </div>
                )}

                {activeTab === 'PAYMENT' && (
                    <div className="max-w-4xl mx-auto space-y-6">
                        <div className="bg-white rounded-xl border border-gray-200 p-5">
                            <label className="block text-sm font-medium text-gray-700 mb-4">{t('payroll_model')}</label>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                {['FIXED_SALARY', 'PERCENTAGE', 'HYBRID'].map((model) => (
                                    <label key={model} className={`flex flex-col items-center justify-center p-3 border rounded-lg cursor-pointer transition-all ${paymentModel === model ? 'bg-primary-50 border-primary-500 text-primary-700 ring-1 ring-primary-500' : 'bg-white border-gray-200 hover:bg-gray-50'}`}>
                                        <input type="radio" {...register('payroll.model')} value={model} className="sr-only" />
                                        <span className="text-xs font-bold">{model.replace('_', ' ')}</span>
                                    </label>
                                ))}
                            </div>
                        </div>

                        <div className="bg-white rounded-xl border border-gray-200 p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
                            {(paymentModel === 'FIXED_SALARY' || paymentModel === 'HYBRID') && (
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">{t('monthly_base_salary')}</label>
                                    <input {...register('payroll.baseSalary', { valueAsNumber: true })} type="number" className="mt-1 block w-full rounded-md border-gray-300 border p-2" />
                                </div>
                            )}

                            {(paymentModel === 'PERCENTAGE' || paymentModel === 'HYBRID') && (
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">{t('commission_rate')}</label>
                                    <input {...register('payroll.commissionPercentage', { valueAsNumber: true })} type="number" className="mt-1 block w-full rounded-md border-gray-300 border p-2" />
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            <div className="border-t border-gray-200 px-6 py-4 bg-white flex justify-end gap-3">
                <button type="button" onClick={onCancel} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">{t('cancel')}</button>
                <button type="submit" disabled={isSubmitting} className="px-6 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 disabled:opacity-50 flex items-center">
                    {isSubmitting ? t('saving') : <><Save className="w-4 h-4 mr-2 rtl:ml-2 rtl:mr-0" /> {initialData ? t('save_changes') : t('add_doctor')}</>}
                </button>
            </div>
        </form>
    );
};

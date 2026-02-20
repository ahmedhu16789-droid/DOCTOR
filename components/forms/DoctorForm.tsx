import React, { useState } from 'react';
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
    name: z.string().min(3, 'Name must be at least 3 characters'),
    phone: z.string().trim().optional().or(z.literal('')),
    // Allow empty string OR valid email
    email: z.union([z.literal(''), z.string().email('Invalid email')]).optional(),
    // Accept any string from the specialty select
    specialty: z.string().min(1, 'Specialty is required'),
    role: z.literal(UserRole.DOCTOR),
    consultationFee: z.number().min(0),
    assignedBranches: z.array(z.string()).min(1, 'Select at least one branch'),
    payroll: z.object({
        model: z.enum(['FIXED_SALARY', 'PERCENTAGE', 'HYBRID']),
        baseSalary: z.number().min(0),
        commissionPercentage: z.number().min(0).max(100).optional().nullable(),
        additionalServicesCommissionEnabled: z.boolean().optional(),
        additionalServicesCommissionPercentage: z.number().min(0).max(100).optional().nullable(),
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
    isSaving?: boolean;
}

export const DoctorForm: React.FC<DoctorFormProps> = ({ initialData, branches, departments, onSave, onCancel, isSaving }) => {
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
            payroll: initialData?.payroll || {
                model: 'PERCENTAGE',
                baseSalary: 0,
                commissionPercentage: 0,
                additionalServicesCommissionEnabled: false,
                additionalServicesCommissionPercentage: 0,
            },
            schedule: initialData?.schedule || []
        }
    });

    const paymentModel = watch('payroll.model');
    const assignedBranchIds = watch('assignedBranches');

    const onSubmit = async (data: DoctorFormValues) => {
        const userPayload: User = {
            id: initialData?.id || Math.random().toString(),
            status: 'ACTIVE',
            ...data,
            specialty: data.specialty as any,
            schedule: data.schedule?.map(s => ({ ...s, id: s.id || Math.random().toString(), branchId: s.branchId || assignedBranchIds[0] }))
        } as User;

        await onSave(userPayload);
    };

    const onValidationError = (fieldErrors: any) => {
        console.error('[DoctorForm] Zod validation failed:', JSON.stringify(fieldErrors, null, 2));
    };

    // Determine which tabs have errors to highlight them
    const basicErrors = errors.name || errors.email || errors.phone || errors.specialty || errors.consultationFee;
    const scheduleErrors = errors.assignedBranches;
    const paymentErrors = errors.payroll;
    const allErrorMessages = [
        errors.name?.message,
        errors.email?.message,
        errors.assignedBranches?.message,
        (errors.payroll as any)?.model?.message,
        (errors.payroll as any)?.baseSalary?.message,
    ].filter(Boolean);

    return (
        <form onSubmit={handleSubmit(onSubmit, onValidationError)} className="h-full flex flex-col">
            <div className="flex border-b border-gray-200 bg-gray-50 px-6">
                <button type="button" onClick={() => setActiveTab('BASIC')} className={`py-4 px-6 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'BASIC' ? 'border-primary-600 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                    <Stethoscope className="w-4 h-4" /> {t('basic_info')}
                </button>
                <button type="button" onClick={() => setActiveTab('SCHEDULE')} className={`py-4 px-6 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'SCHEDULE' ? 'border-primary-600 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                    <Building2 className="w-4 h-4" /> {t('branches')} & {t('schedule')}
                </button>
                <button type="button" onClick={() => setActiveTab('PAYMENT')} className={`py-4 px-6 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'PAYMENT' ? 'border-primary-600 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                    <Wallet className="w-4 h-4" /> {t('financial_reports')}
                </button>
            </div>

            {/* Validation error banner */}
            {allErrorMessages.length > 0 && (
                <div className="mx-6 mt-3 px-4 py-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">
                    <p className="font-bold mb-1">⚠ Please fix the following:</p>
                    <ul className="list-disc list-inside space-y-0.5">
                        {allErrorMessages.map((msg, i) => <li key={i}>{msg as string}</li>)}
                    </ul>
                    {scheduleErrors && <p className="mt-1 font-medium">Branches tab: {scheduleErrors.message as string}</p>}
                </div>
            )}

            <div className="flex-1 overflow-y-auto p-6">
                {activeTab === 'BASIC' && (
                    <div className="max-w-4xl mx-auto space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-white border border-gray-200 rounded-xl p-5">
                            <div className="col-span-2">
                                <label className="block text-sm font-medium text-gray-700">{t('full_name')}</label>
                                <input {...register('name')} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm border p-2" />
                                {errors.name && <p className="mt-1 text-xs text-red-600">{errors.name.message as string}</p>}
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">{t('phone_number')}</label>
                                <input {...register('phone')} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm border p-2" />
                                {errors.phone && <p className="mt-1 text-xs text-red-600">{errors.phone.message as string}</p>}
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">{t('email')}</label>
                                <input {...register('email')} type="email" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm border p-2" />
                                {errors.email && <p className="mt-1 text-xs text-red-600">{errors.email.message as string}</p>}
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">{t('department')}</label>
                                <select {...register('specialty')} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm border p-2">
                                    {(departments.length ? departments : Object.values(Department).map((d) => ({ value: d, labelEn: d, labelAr: d }))).map((d) => (
                                        <option key={d.value} value={d.value}>{i18n.language === 'ar' ? d.labelAr : d.labelEn}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">{t('consultation_fee')}</label>
                                <input {...register('consultationFee', { valueAsNumber: true })} type="number" min={0} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm border p-2" />
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'SCHEDULE' && (
                    <div className="max-w-4xl mx-auto space-y-8">
                        <Controller name="assignedBranches" control={control} render={({ field }) => (
                            <BranchSelector branches={branches} selectedIds={field.value} onChange={field.onChange} error={errors.assignedBranches?.message as string} />
                        )} />
                        <div className="border-t border-gray-200 pt-6">
                            <ScheduleGrid control={control} name="schedule" assignedBranchIds={assignedBranchIds} branches={branches} />
                        </div>
                    </div>
                )}

                {activeTab === 'PAYMENT' && (
                    <div className="max-w-3xl mx-auto space-y-6">
                        <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
                            <label className="block text-sm font-medium text-gray-700 mb-4">{t('payroll_model')}</label>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                {['FIXED_SALARY', 'PERCENTAGE', 'HYBRID'].map((model) => (
                                    <label key={model} className={`flex flex-col items-center justify-center p-3 border rounded-lg cursor-pointer ${paymentModel === model ? 'bg-primary-50 border-primary-500 text-primary-700' : 'bg-white border-gray-200'}`}>
                                        <input type="radio" {...register('payroll.model')} value={model} className="sr-only" />
                                        <span className="text-xs font-bold">{t(`payroll_${model.toLowerCase()}`)}</span>
                                    </label>
                                ))}
                            </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {(paymentModel === 'FIXED_SALARY' || paymentModel === 'HYBRID') && (
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">{t('base_salary')}</label>
                                    <input {...register('payroll.baseSalary', { valueAsNumber: true })} type="number" min={0} className="block w-full rounded-md border-gray-300 border p-2" />
                                </div>
                            )}
                            {(paymentModel === 'PERCENTAGE' || paymentModel === 'HYBRID') && (
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">{t('commission_percentage')}</label>
                                    <input {...register('payroll.commissionPercentage', { valueAsNumber: true })} type="number" min={0} max={100} className="block w-full rounded-md border-gray-300 border p-2" />
                                </div>
                            )}
                            {(paymentModel === 'PERCENTAGE' || paymentModel === 'HYBRID') && (
                                <div className="md:col-span-2 space-y-3 border border-gray-200 rounded-lg p-4">
                                    <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                                        <input
                                            {...register('payroll.additionalServicesCommissionEnabled')}
                                            type="checkbox"
                                            className="h-4 w-4 rounded border-gray-300"
                                        />
                                        {t('additional_services_commission_enabled')}
                                    </label>

                                    {watch('payroll.additionalServicesCommissionEnabled') && (
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">{t('additional_services_commission_percentage')}</label>
                                            <input
                                                {...register('payroll.additionalServicesCommissionPercentage', { valueAsNumber: true })}
                                                type="number"
                                                min={0}
                                                max={100}
                                                className="block w-full rounded-md border-gray-300 border p-2"
                                            />
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            <div className="border-t border-gray-200 px-6 py-4 bg-gray-50 flex justify-end gap-3">
                <button type="button" onClick={onCancel} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">{t('cancel')}</button>
                <button type="submit" disabled={isSubmitting || isSaving} className="px-6 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 disabled:opacity-50 flex items-center">
                    {(isSubmitting || isSaving) ? t('saving') : <><Save className="w-4 h-4 mr-2" /> {initialData ? t('save_changes') : t('add_doctor')}</>}
                </button>
            </div>
        </form>
    );
};

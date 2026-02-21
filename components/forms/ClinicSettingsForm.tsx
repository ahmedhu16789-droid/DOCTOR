import React, { useEffect, useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { Save, Mail, Clock, Upload } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Select } from '../common/Select';
import { ClinicSettingsPayload, getClinicSettingsFromApi, updateClinicSettingsViaApi } from '../../services/api';

export const ClinicSettingsForm: React.FC = () => {
    const { t } = useTranslation();
    const [success, setSuccess] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');
    const [isLoading, setIsLoading] = useState(true);

    const { register, control, handleSubmit, formState: { isSubmitting }, reset } = useForm<ClinicSettingsPayload>({
        defaultValues: {
            name: '',
            email: '',
            phone: '',
            website: '',
            timezone: 'Africa/Cairo',
            currency: 'EGP',
            logoUrl: '',
            commission_basis: 'PAID_AMOUNT',
            apply_on_discounted_amount: true,
            include_tax: true,
            clawback_on_refund: true,
            accrual_day_of_month: 1,
            tv_queue_display_mode: 'MASKED_NAME',
        }
    });

    useEffect(() => {
        const loadSettings = async () => {
            try {
                setIsLoading(true);
                const settings = await getClinicSettingsFromApi();
                reset(settings);
            } catch (error) {
                console.error('Failed to load clinic settings', error);
                setErrorMessage('Failed to load clinic settings');
            } finally {
                setIsLoading(false);
            }
        };

        loadSettings();
    }, [reset]);

    const onSubmit = async (data: ClinicSettingsPayload) => {
        setErrorMessage('');

        try {
            const savedSettings = await updateClinicSettingsViaApi(data);
            reset(savedSettings);
            setSuccess(true);
            setTimeout(() => setSuccess(false), 3000);
        } catch (error) {
            console.error('Failed to save clinic settings', error);
            setErrorMessage('Failed to save clinic settings');
        }
    };

    if (isLoading) {
        return <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm text-sm text-gray-500">{t('clinic_settings_loading')}</div>;
    }

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                <div className="flex justify-between items-start mb-6">
                    <div>
                        <h2 className="text-xl font-bold text-gray-900">{t('clinic_settings')}</h2>
                        <p className="text-sm text-gray-500">{t('clinic_settings_desc_form')}</p>
                    </div>
                    {success && (
                        <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-sm font-bold animate-pulse">
                            {t('settings_saved_success')}
                        </span>
                    )}
                </div>

                {errorMessage && <div className="mb-4 text-sm text-red-600">{errorMessage}</div>}

                <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
                    <div>
                        <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-4 pb-2 border-b border-gray-100">
                            {t('identity_branding')}
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-sm font-medium text-gray-700">{t('clinic_name')}</label>
                                <input {...register('name')} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm border p-2" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">{t('official_website')}</label>
                                <div className="flex mt-1">
                                    <span className="inline-flex items-center px-3 rounded-l-md border border-r-0 border-gray-300 bg-gray-50 text-gray-500 sm:text-sm">
                                        https://
                                    </span>
                                    <input {...register('website')} className="flex-1 block w-full rounded-none rounded-r-md border-gray-300 border p-2" />
                                </div>
                            </div>
                            <div className="md:col-span-2">
                                <label className="block text-sm font-medium text-gray-700">{t('logo')}</label>
                                <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-md hover:bg-gray-50 cursor-pointer">
                                    <div className="space-y-1 text-center">
                                        <Upload className="mx-auto h-12 w-12 text-gray-400" />
                                        <div className="flex text-sm text-gray-600">
                                            <label htmlFor="file-upload" className="relative cursor-pointer bg-white rounded-md font-medium text-primary-600 hover:text-primary-500 focus-within:outline-none">
                                                <span>{t('upload_file')}</span>
                                                <input id="file-upload" name="file-upload" type="file" className="sr-only" />
                                            </label>
                                            <p className="pl-1">{t('drag_drop')}</p>
                                        </div>
                                        <p className="text-xs text-gray-500">{t('upload_help_text')}</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div>
                        <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-4 pb-2 border-b border-gray-100">
                            {t('contact_info')}
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-sm font-medium text-gray-700">{t('support_email')}</label>
                                <div className="relative mt-1">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                        <Mail className="h-5 w-5 text-gray-400" />
                                    </div>
                                    <input {...register('email')} className="block w-full pl-10 rounded-md border-gray-300 border p-2" />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">{t('main_phone')}</label>
                                <input {...register('phone')} className="mt-1 block w-full rounded-md border-gray-300 border p-2 text-start direction-ltr" />
                            </div>
                        </div>
                    </div>

                    <div>
                        <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-4 pb-2 border-b border-gray-100">
                            Doctor payroll policy
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Commission basis</label>
                                <Controller name="commission_basis" control={control} render={({ field }) => (
                                    <Select value={field.value} onChange={field.onChange} options={[
                                        { value: 'PAID_AMOUNT', label: 'Paid amount' },
                                        { value: 'INVOICE_TOTAL', label: 'Invoice total' }
                                    ]} />
                                )} />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Accrual day of month</label>
                                <input type="number" min={1} max={28} {...register('accrual_day_of_month', { valueAsNumber: true })} className="mt-1 block w-full rounded-md border-gray-300 border p-2" />
                            </div>
                            <label className="flex items-center gap-2 text-sm text-gray-700">
                                <input type="checkbox" {...register('apply_on_discounted_amount')} className="rounded border-gray-300" />
                                Apply commission on discounted amount
                            </label>
                            <label className="flex items-center gap-2 text-sm text-gray-700">
                                <input type="checkbox" {...register('include_tax')} className="rounded border-gray-300" />
                                Include tax in commission basis
                            </label>
                            <label className="flex items-center gap-2 text-sm text-gray-700">
                                <input type="checkbox" {...register('clawback_on_refund')} className="rounded border-gray-300" />
                                Apply clawback on refund transactions
                            </label>
                        </div>
                    </div>

                    <div>
                        <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-4 pb-2 border-b border-gray-100">
                            {t('patient_privacy')}
                        </h3>
                        <div className="grid grid-cols-1 gap-3">
                            <label className="block text-sm font-medium text-gray-700">{t('tv_queue_display_mode_label')}</label>
                            <Controller name="tv_queue_display_mode" control={control} render={({ field }) => (
                                <Select value={field.value} onChange={field.onChange} options={[
                                    { value: 'FULL_NAME', label: t('tv_queue_display_mode_full_name') },
                                    { value: 'MASKED_NAME', label: t('tv_queue_display_mode_masked_name') }
                                ]} />
                            )} />
                            <p className="text-xs text-gray-500">{t('tv_queue_display_mode_helper')}</p>
                        </div>
                    </div>

                    <div>
                        <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-4 pb-2 border-b border-gray-100">
                            {t('localization')}
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-sm font-medium text-gray-700">{t('timezone')}</label>
                                <div className="relative mt-1">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                        <Clock className="h-5 w-5 text-gray-400" />
                                    </div>
                                    <div className="flex-1 w-full pl-8">
                                        <Controller name="timezone" control={control} render={({ field }) => (
                                            <Select value={field.value} onChange={field.onChange} options={[
                                                { value: 'Africa/Cairo', label: t('timezone_africa_cairo') },
                                                { value: 'Asia/Riyadh', label: t('timezone_asia_riyadh') },
                                                { value: 'Asia/Dubai', label: t('timezone_asia_dubai') },
                                                { value: 'Europe/London', label: t('timezone_europe_london') }
                                            ]} />
                                        )} />
                                    </div>
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">{t('default_currency')}</label>
                                <Controller name="currency" control={control} render={({ field }) => (
                                    <Select value={field.value} onChange={field.onChange} options={[
                                        { value: 'EGP', label: t('currency_egp') },
                                        { value: 'USD', label: t('currency_usd') },
                                        { value: 'SAR', label: t('currency_sar') }
                                    ]} />
                                )} />
                            </div>
                        </div>
                    </div>

                    <div className="pt-4 border-t border-gray-200 flex justify-end">
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="px-8 py-3 bg-primary-600 text-white font-bold rounded-lg shadow-md hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 flex items-center"
                        >
                            {isSubmitting ? t('saving') : <><Save className="w-5 h-5 mr-2 rtl:ml-2 rtl:mr-0" /> {t('save_changes')}</>}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

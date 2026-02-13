import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Save, Globe, Mail, Clock, ShieldCheck, Upload } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface ClinicSettings {
    name: string;
    email: string;
    phone: string;
    website: string;
    timezone: string;
    currency: string;
    logoUrl: string;
}

export const ClinicSettingsForm: React.FC = () => {
    const { t } = useTranslation();
    const [success, setSuccess] = useState(false);

    const { register, handleSubmit, formState: { isSubmitting } } = useForm<ClinicSettings>({
        defaultValues: {
            name: 'Al-Fath Clinic',
            email: 'admin@alfath-clinic.com',
            phone: '+20 123 456 7890',
            website: 'www.alfath-clinic.com',
            timezone: 'Africa/Cairo',
            currency: 'EGP',
            logoUrl: ''
        }
    });

    const onSubmit = async (data: ClinicSettings) => {
        await new Promise(resolve => setTimeout(resolve, 800));
        console.log('Settings Saved:', data);
        setSuccess(true);
        setTimeout(() => setSuccess(false), 3000);
    };

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

                <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">

                    {/* Identity */}
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

                    {/* Contact */}
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

                    {/* Localization */}
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
                                    <select {...register('timezone')} className="block w-full pl-10 rounded-md border-gray-300 border p-2 bg-white">
                                        <option value="Africa/Cairo">Africa/Cairo (GMT+2/3)</option>
                                        <option value="Asia/Riyadh">Asia/Riyadh (GMT+3)</option>
                                        <option value="Asia/Dubai">Asia/Dubai (GMT+4)</option>
                                        <option value="Europe/London">Europe/London (GMT+0)</option>
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">{t('default_currency')}</label>
                                <select {...register('currency')} className="mt-1 block w-full rounded-md border-gray-300 border p-2 bg-white">
                                    <option value="EGP">Egyptian Pound (EGP)</option>
                                    <option value="USD">US Dollar ($)</option>
                                    <option value="SAR">Saudi Riyal (SAR)</option>
                                </select>
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